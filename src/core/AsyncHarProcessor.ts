// src/core/AsyncHarProcessor.ts

import { Har } from '../types';
import { EventEmitter } from '../lib/event-emitter';
import { throwError, ErrorType } from '../error-handling';
import { EndpointScoringService } from '../services/EndpointScoringService';
import { ProductionTokenDetector } from '../services/TokenDetector';
import { BehavioralPatternMatcher } from '../flow-analysis/BehavioralPatternMatcher';
import { AuthenticationPatternLibrary } from '../pattern-library/AuthenticationPatternLibrary';
import { FlowContextResult, ScoredHarEntry } from '../flow-analysis/types';
import { OB2SyntaxComplianceEngine } from '../syntax-compliance/OB2SyntaxComplianceEngine';
import { OB2ConfigurationResult } from '../services/types';

// Define the events that the new AsyncHarProcessor can emit
export interface HarProcessorEvents {
  onProgress: (progress: number) => void;
  onStatusUpdate: (status: string) => void;
  onError: (error: Error) => void;
  onComplete: (result: OB2ConfigurationResult) => void;
}

/**
 * A sophisticated HAR processor that orchestrates a multi-stage analysis pipeline.
 * It reads a HAR file, scores endpoints, detects tokens and patterns, and
 * produces a comprehensive analysis result.
 */
export class AsyncHarProcessor extends EventEmitter<HarProcessorEvents> {
  private file: File;
  private scoringService: EndpointScoringService;
  private tokenDetector: ProductionTokenDetector;
  private patternMatcher: BehavioralPatternMatcher;
  private syntaxEngine: OB2SyntaxComplianceEngine;

  constructor(file: File) {
    super();
    this.file = file;
    this.scoringService = new EndpointScoringService();
    this.tokenDetector = new ProductionTokenDetector();
    this.patternMatcher = new BehavioralPatternMatcher(new AuthenticationPatternLibrary());
    this.syntaxEngine = new OB2SyntaxComplianceEngine();
  }

  /**
   * Starts the HAR file processing and analysis pipeline.
   */
  public async process(): Promise<void> {
    const startTime = Date.now();
    try {
      this.emit('onStatusUpdate', 'Reading HAR file...');
      const fileContent = await this.readFileWithProgress();
      
      this.emit('onStatusUpdate', 'Parsing HAR content...');
      const har = this.parseAndValidateHar(fileContent);
      const allRequests = har.log.entries;

      this.emit('onStatusUpdate', 'Scoring endpoints...');
      const scoredRequests: ScoredHarEntry[] = allRequests.map(entry => ({
        ...entry,
        scores: this.scoringService.scoreRequest(entry, allRequests),
      }));
      this.emit('onProgress', 33);

      this.emit('onStatusUpdate', 'Identifying critical path...');
      const { criticalPath, redundantRequests } = this.identifyCriticalPath(scoredRequests);
      this.emit('onProgress', 66);

      this.emit('onStatusUpdate', 'Detecting tokens and patterns...');
      const detectedTokens = await this.tokenDetector.detectDynamicTokens(criticalPath);
      const matchedPatterns = this.patternMatcher.matchPatterns(criticalPath);
      this.emit('onProgress', 100);

      const processingTime = Date.now() - startTime;

      this.emit('onStatusUpdate', 'Generating LoliCode...');
      const analysisResult: FlowContextResult = {
        allRequests,
        scoredRequests,
        criticalPath,
        redundantRequests,
        detectedTokens,
        matchedPatterns,
        metrics: {
          totalRequests: allRequests.length,
          criticalRequests: criticalPath.length,
          processingTime,
        },
        warnings: [], // Placeholder for future implementation
      };

      const loliCodeResult = this.syntaxEngine.generateCompliantLoliCode(analysisResult);

      this.emit('onStatusUpdate', 'Analysis complete.');
      this.emit('onComplete', loliCodeResult);

    } catch (error) {
      this.emit('onError', error as Error);
    }
  }

  /**
   * Identifies the critical path by filtering high-scoring requests.
   * A simple percentile-based threshold is used for now.
   */
  private identifyCriticalPath(scoredRequests: ScoredHarEntry[]): { criticalPath: ScoredHarEntry[], redundantRequests: ScoredHarEntry[] } {
    if (scoredRequests.length === 0) {
      return { criticalPath: [], redundantRequests: [] };
    }

    const scores = scoredRequests.map(r => r.scores.finalScore).sort((a, b) => a - b);
    const percentileIndex = Math.floor(scores.length * 0.25);
    const scoreThreshold = scores[percentileIndex] || 0;

    const criticalPath: ScoredHarEntry[] = [];
    const redundantRequests: ScoredHarEntry[] = [];

    for (const request of scoredRequests) {
      if (request.scores.finalScore >= scoreThreshold && request.response.status < 400) {
        criticalPath.push(request);
      } else {
        redundantRequests.push(request);
      }
    }

    // Ensure the critical path is sorted chronologically
    criticalPath.sort((a, b) => new Date(a.startedDateTime).getTime() - new Date(b.startedDateTime).getTime());

    return { criticalPath, redundantRequests };
  }

  /**
   * Reads the file content and emits progress updates.
   */
  private readFileWithProgress(): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(throwError(ErrorType.HAR_PARSING_ERROR, 'Error reading the file.'));
      
      reader.onprogress = (event) => {
        if (event.lengthComputable) {
          // This progress is for reading the file, which is only part of the first stage.
          // We'll cap it at 10% of the total progress bar.
          const progress = Math.round((event.loaded / event.total) * 10);
          this.emit('onProgress', progress);
        }
      };

      reader.readAsText(this.file);
    });
  }

  /**
   * Parses the HAR content and validates its structure.
   */
  private parseAndValidateHar(content: string): Har {
    if (!content) {
      throwError(ErrorType.EMPTY_HAR);
    }

    try {
      const har = JSON.parse(content);

      if (!har.log || !Array.isArray(har.log.entries)) {
        throwError(ErrorType.INVALID_HAR_FORMAT);
      }
      
      if (har.log.entries.length === 0) {
        throwError(ErrorType.NO_REQUESTS_FOUND);
      }

      return har;

    } catch (e) {
      throwError(ErrorType.HAR_PARSING_ERROR, 'The file is not a valid JSON.');
    }
  }
}
