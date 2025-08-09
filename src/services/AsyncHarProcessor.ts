import { performance } from 'perf_hooks';
import { EndpointScoringService, AnalysisContext } from './scoring';
import {
  StreamingHarParser,
  ParseStatistics
} from '../core/StreamingHarParser';
import { AnalysisMode } from './AnalysisMode';
import { TokenDetectionService } from '../token-extraction/TokenDetectionService';
import { OB2SyntaxComplianceEngine } from '../syntax-compliance/OB2SyntaxComplianceEngine';
import { FlowAnalysisEngine } from '../flow-analysis/FlowAnalysisEngine';
import { AuthenticationPatternLibrary } from '../pattern-library/AuthenticationPatternLibrary';
import { EndpointClassifier } from '../core/EndpointClassifier';
import { RequestDependencyAnalyzer } from './dependency/RequestDependencyAnalyzer';
import { RequestOptimizationEngine } from './optimization/RequestOptimizationEngine';
import { MFAFlowAnalyzer } from './mfa/MFAFlowAnalyzer';

import { HarEntry, HarAnalysisResult, DetectedToken } from './types';

export class AsyncHarProcessor {
  public static async processHarFileStreaming(
    harContent: string,
    config: AnalysisMode.AnalysisConfiguration,
    progressCallback?: (progress: number, stage:string) => void
  ): Promise<HarAnalysisResult> {
    this.validateHarContent(harContent);

    const allEntries: HarEntry[] = [];
    const parser = new StreamingHarParser({
      validateEntries: true,
      skipLargeResponses: true
    });

    parser.on('progress', (progress) => {
      // Pass along parsing progress if needed
    });

    parser.on('error', (error) => {
      if (error instanceof Error) {
        throw new Error(`Failed to parse HAR file: ${error.message}`);
      }
      throw new Error('An unknown error occurred during HAR parsing.');
    });

    // Use the new asynchronous parser
    for await (const batch of parser.parseHarEntriesAsync(harContent)) {
      allEntries.push(...batch);
    }
    const parseStats = parser.getStatistics();

    if (allEntries.length === 0) {
      throw new Error(
        'The HAR file is valid, but it contains no network requests.'
      );
    }

    const warnings: string[] = [];
    const timings = {
      scoringAndFiltering: 0,
      dependency: 0,
      behavioral: 0,
      optimization: 0,
      mfa: 0,
      tokenDetection: 0,
      codeGeneration: 0
    };

    // 1. Contextual Scoring & Filtering
    let start = performance.now();
    progressCallback?.(0, 'scoring');
    const scoringService = new EndpointScoringService();
    const analysisContext: Omit<AnalysisContext, 'currentIndex'> = {
      allEntries,
      criteria: config.filtering
    };

    const scoredEntries = allEntries
      .map((entry, index) =>
        scoringService.scoreEntry(entry, {
          ...analysisContext,
          currentIndex: index
        })
      )
      .filter((entry) => entry.finalScore > 0);
    timings.scoringAndFiltering = performance.now() - start;

    if (scoredEntries.length === 0) {
      throw new Error(
        'No relevant requests found in the HAR file after filtering. Please check the analysis mode configuration or try a different HAR file.'
      );
    }

    // 2. Dependency Analysis
    start = performance.now();
    progressCallback?.(15, 'dependency-analysis');
    const dependencyAnalyzer = new RequestDependencyAnalyzer();
    const dependencyAnalysis =
      dependencyAnalyzer.analyzeDependencies(scoredEntries);
    timings.dependency = performance.now() - start;

    console.log('--- Dependency Analysis Output (Critical Path) ---');
    console.log(
      JSON.stringify(
        dependencyAnalysis.criticalPath.map((e) => ({
          url: e.request.url,
          method: e.request.method
        })),
        null,
        2
      )
    );

    // Create indices from the critical path entries
    const criticalPathIndices = dependencyAnalysis.criticalPath
      .map((entry) =>
        scoredEntries.findIndex(
          (e) =>
            e.startedDateTime === entry.startedDateTime &&
            e.request.url === entry.request.url
        )
      )
      .filter((index) => index !== -1);

    // 3. Behavioral Analysis
    start = performance.now();
    progressCallback?.(30, 'behavioral-analysis');
    const behavioralAnalyzer = new FlowAnalysisEngine(
      new AuthenticationPatternLibrary(),
      new EndpointClassifier()
    );

    const flowContext = behavioralAnalyzer.analyzeFlowContext(
      scoredEntries,
      await parser.analyzeCorrelations(scoredEntries),
      criticalPathIndices
    );
    timings.behavioral = performance.now() - start;

    console.log('--- Flow Analysis Output (Flow Context) ---');
    console.log(JSON.stringify(flowContext, null, 2));

    // 4. Request Optimization
    start = performance.now();
    progressCallback?.(45, 'optimization');
    const optimizationEngine = new RequestOptimizationEngine();
    const optimizedFlow = optimizationEngine.optimizeRequestFlow(
      dependencyAnalysis.criticalPath
    );
    timings.optimization = performance.now() - start;

    // 5. MFA Analysis
    start = performance.now();
    progressCallback?.(60, 'mfa-analysis');
    const mfaAnalyzer = new MFAFlowAnalyzer();
    const mfaAnalysis = mfaAnalyzer.analyzeMFAFlow(
      optimizedFlow.optimizedRequests
    );
    timings.mfa = performance.now() - start;

    // 6. Token Detection
    start = performance.now();
    progressCallback?.(75, 'token-detection');

    const tokenDetector = new TokenDetectionService();
    const tokenExtractionResults = optimizedFlow.optimizedRequests.map(
      (entry) => {
        const responseBody = entry.response.content?.text || '';
        return tokenDetector.detectTokensWithContext(entry, responseBody);
      }
    );
    timings.tokenDetection = performance.now() - start;

    // 7. Code Generation
    start = performance.now();
    progressCallback?.(90, 'code-generation');

    const codeGenerator = new OB2SyntaxComplianceEngine();
    const codeGenResult = codeGenerator.generateCompliantLoliCode(
      flowContext,
      'MULTI_STEP_FLOW_TEMPLATE'
    );
    timings.codeGeneration = performance.now() - start;

    // Calculate resource type distribution
    const resourceTypeDistribution = scoredEntries.reduce((acc, entry) => {
      const resourceType = entry._resourceType || 'unknown';
      acc.set(resourceType, (acc.get(resourceType) || 0) + 1);
      return acc;
    }, new Map<string, number>());

    // Generate warnings for failed requests in the final flow
    optimizedFlow.optimizedRequests.forEach((entry) => {
      if (entry.response.status >= 400) {
        warnings.push(
          `Request to ${entry.request.url} failed with status ${entry.response.status}.`
        );
      }
    });

    const analysisResult: HarAnalysisResult = {
      requests: optimizedFlow.optimizedRequests,
      metrics: {
        totalRequests: parseStats.totalEntries,
        significantRequests: scoredEntries.length,
        processingTime: parseStats.processingTimeMs,
        filteringTime: timings.scoringAndFiltering,
        scoringTime: timings.scoringAndFiltering, // Merged for simplicity
        tokenDetectionTime: timings.tokenDetection,
        codeGenerationTime: timings.codeGeneration,
        correlationAnalysisTime: timings.dependency, // It's part of dependency analysis
        averageScore:
          scoredEntries.reduce(
            (acc, e) => acc + (e.finalScore || 0),
            0
          ) / (scoredEntries.length || 1),
        resourceTypeDistribution: resourceTypeDistribution,
        detectedPatterns: flowContext.matchedPatterns.map((p) => p.patternId)
      },
      loliCode: codeGenResult.loliCode,
      detectedTokens: tokenExtractionResults
        .flatMap((r) => r.tokens)
        .reduce((m, t) => {
          if (!m.has(t.name)) m.set(t.name, []);
          m.get(t.name)!.push(t);
          return m;
        }, new Map<string, DetectedToken[]>()),
      behavioralFlows: flowContext.matchedPatterns,
      warnings: warnings
    };

    progressCallback?.(100, 'complete');

    return analysisResult;
  }

  private static validateHarContent(harContent: string): void {
    if (!harContent.trim()) {
      throw new Error('The HAR file is empty. Please upload a valid HAR file.');
    }
    try {
      const har = JSON.parse(harContent);
      if (!har.log || !Array.isArray(har.log.entries)) {
        throw new Error(
          "Invalid HAR file format. The file must contain a 'log' object with an 'entries' array."
        );
      }
    } catch (error) {
      throw new Error(
        'Failed to parse HAR file. The file may be malformed or not in valid JSON format.'
      );
    }
  }
}