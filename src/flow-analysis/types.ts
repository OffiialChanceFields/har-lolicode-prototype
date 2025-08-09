// src/flow-analysis/types.ts
import { HarEntry } from '../types';
import { EndpointScores } from '../services/EndpointScoringService';
import { DetectedToken } from '../services/TokenDetector';
import { PatternMatch } from './BehavioralPatternMatcher';

/**
 * Extends a standard HAR entry with its calculated scores.
 */
export interface ScoredHarEntry extends HarEntry {
  scores: EndpointScores;
}

/**
 * A comprehensive container for the results of the entire analysis pipeline.
 * This object is the primary output of the AsyncHarProcessor and the input
 * to the OB2SyntaxComplianceEngine.
 */
export interface FlowContextResult {
  allRequests: HarEntry[];
  scoredRequests: ScoredHarEntry[];
  criticalPath: ScoredHarEntry[];
  redundantRequests: ScoredHarEntry[];

  detectedTokens: DetectedToken[];
  matchedPatterns: PatternMatch[];

  metrics: {
    totalRequests: number;
    criticalRequests: number;
    processingTime: number; // in milliseconds
  };

  warnings: string[];
}

export interface StateTransition {
  fromState: string;
  toState: string;
  trigger: HarEntry;
  confidence: number;
}
