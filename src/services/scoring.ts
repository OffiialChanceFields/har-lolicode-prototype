// src/services/scoring.ts

import { AnalysisMode } from './AnalysisMode';
import { HarEntry } from './types';
import { EndpointClassifier, EndpointType } from '../core/EndpointClassifier';

export interface AnalysisContext {
  allEntries: HarEntry[];
  currentIndex: number;
  criteria: AnalysisMode.FilteringCriteria;
}

/**
 * Service for scoring endpoints based on their type and other characteristics.
 */
export class EndpointScoringService {
  private classifier: EndpointClassifier;

  constructor() {
    this.classifier = new EndpointClassifier();
  }

  /**
   * Calculates a score for a given HAR entry based on the analysis mode.
   * @param entry - The HAR entry to score.
   * @param context - The analysis context, including all entries and current index.
   * @returns The HAR entry with an added `finalScore` property.
   */
  public scoreEntry(
    entry: HarEntry,
    context: AnalysisContext
  ): HarEntry & { finalScore: number } {
    const endpointType = this.classifier.classify(entry);
    let score = 0;

    switch (endpointType) {
      case EndpointType.AUTHENTICATION:
        score = 95;
        break;
      case EndpointType.API_DATA:
        score = 80;
        break;
      case EndpointType.UI_ASSET:
        score = 30;
        break;
      case EndpointType.TRACKING:
        score = 10;
        break;
      case EndpointType.UNKNOWN:
      default:
        score = 50;
        break;
    }

    // Example of contextual scoring: boost score for entries that are close to auth entries
    if (this.isNearAuthentication(context)) {
      score += 10;
    }

    const finalScore = Math.min(score, 100);

    return {
      ...entry,
      finalScore
    };
  }

  private isNearAuthentication(context: AnalysisContext): boolean {
    const { allEntries, currentIndex } = context;
    const window = 5; // Check 5 entries before and after

    for (
      let i = Math.max(0, currentIndex - window);
      i < Math.min(allEntries.length, currentIndex + window);
      i++
    ) {
      if (i !== currentIndex) {
        const otherEntry = allEntries[i];
        const otherType = this.classifier.classify(otherEntry);
        if (otherType === EndpointType.AUTHENTICATION) {
          return true;
        }
      }
    }
    return false;
  }
}
