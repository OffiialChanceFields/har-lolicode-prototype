import { EndpointScoringService, AnalysisContext } from './scoring';
import {
  StreamingHarParser,
  ParseStatistics
} from '../core/StreamingHarParser';
import { AnalysisMode } from './AnalysisMode';
import { SmartTokenDetector } from '../token-extraction/SmartTokenDetector';
import { OB2SyntaxComplianceEngine } from '../syntax-compliance/OB2SyntaxComplianceEngine';
import { FlowAnalysisEngine } from '../flow-analysis/FlowAnalysisEngine';
import { AuthenticationPatternLibrary } from '../pattern-library/AuthenticationPatternLibrary';
import { EndpointClassifier } from '../core/EndpointClassifier';
import { RequestDependencyAnalyzer } from './dependency/RequestDependencyAnalyzer';
import { RequestOptimizationEngine } from './optimization/RequestOptimizationEngine';
import { MFAFlowAnalyzer } from './mfa/MFAFlowAnalyzer';
import { SessionManager } from './session/SessionManager';
import { RequestSequencer } from './sequencing/RequestSequencer';
import { SequenceRules } from './sequencing/types';

import { HarEntry, HarAnalysisResult, DetectedToken, TokenInstance } from './types';

export class AsyncHarProcessor {
  public static async processHarFileStreaming(
    harContent: string,
    config: AnalysisMode.AnalysisConfiguration,
    progressCallback?: (progress: number, stage: string) => void
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

    // 1. Contextual Scoring & Filtering
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

    if (scoredEntries.length === 0) {
      throw new Error(
        'No relevant requests found in the HAR file after filtering. Please check the analysis mode configuration or try a different HAR file.'
      );
    }

    // 2. Session Analysis
    progressCallback?.(15, 'session-analysis');
    const sessionManager = new SessionManager();
    const sessionAnalysis = sessionManager.analyze(scoredEntries);

    // 3. Dependency Analysis
    progressCallback?.(20, 'dependency-analysis');
    const dependencyAnalyzer = new RequestDependencyAnalyzer();
    const dependencyAnalysis =
      dependencyAnalyzer.analyzeDependencies(scoredEntries, sessionAnalysis);

    // 4. Request Sequencing
    progressCallback?.(30, 'request-sequencing');
    const sequencer = new RequestSequencer();
    const sequenceRules = sequencer.analyzeSequence(scoredEntries, dependencyAnalysis);

    console.log('--- Dependency Analysis Output (Critical Path) ---');
    console.log(JSON.stringify(dependencyAnalysis.criticalPath.map(e => ({url: e.request.url, method: e.request.method})), null, 2));

    // Create indices from the critical path entries
    const criticalPathIndices = dependencyAnalysis.criticalPath.map(entry =>
      scoredEntries.findIndex(e => e.startedDateTime === entry.startedDateTime && e.request.url === entry.request.url)
    ).filter(index => index !== -1);

    // 3. Behavioral Analysis
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

    console.log('--- Flow Analysis Output (Flow Context) ---');
    console.log(JSON.stringify(flowContext, null, 2));

    // 4. Request Optimization
    progressCallback?.(45, 'optimization');
    const optimizationEngine = new RequestOptimizationEngine();
    const optimizedFlow = optimizationEngine.optimizeRequestFlow(
      dependencyAnalysis.criticalPath
    );

    // 5. MFA Analysis
    progressCallback?.(60, 'mfa-analysis');
    const mfaAnalyzer = new MFAFlowAnalyzer();
    const mfaAnalysis = mfaAnalyzer.analyzeMFAFlow(
      optimizedFlow.optimizedRequests
    );

    // 6. Token Detection
    progressCallback?.(75, 'token-detection');

    const tokenDetector = new SmartTokenDetector();
    const detectedTokens = tokenDetector.detectTokens(optimizedFlow.optimizedRequests);

    // 7. Code Generation
    progressCallback?.(90, 'code-generation');

    const codeGenerator = new OB2SyntaxComplianceEngine();
    const codeGenResult = codeGenerator.generateCompliantLoliCode(flowContext, 'MULTI_STEP_FLOW_TEMPLATE');

    const analysisResult: HarAnalysisResult = {
      requests: optimizedFlow.optimizedRequests,
      metrics: {
        totalRequests: parseStats.totalEntries,
        significantRequests: scoredEntries.length,
        processingTime: parseStats.processingTimeMs,
        filteringTime: 0, // Placeholder
        scoringTime: 0, // Placeholder
        tokenDetectionTime: 0, // Placeholder
        codeGenerationTime: 0, // Placeholder
        correlationAnalysisTime: 0, // Placeholder
        averageScore: scoredEntries.reduce((acc, e) => acc + (e.finalScore || 0), 0) / (scoredEntries.length || 1),
        resourceTypeDistribution: new Map(), // Placeholder
        detectedPatterns: flowContext.matchedPatterns.map(p => p.patternId),
      },
      loliCode: codeGenResult.loliCode,
      detectedTokens: detectedTokens.reduce((m, t: DetectedToken) => {
        const key = t.name;
        if (!m.has(key)) m.set(key, []);
        m.get(key)!.push(t);
        return m;
      }, new Map<string, DetectedToken[]>()),
      behavioralFlows: flowContext.matchedPatterns,
      warnings: [], // Placeholder
      sessionAnalysis,
      sequenceRules,
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
