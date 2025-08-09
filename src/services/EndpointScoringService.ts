// src/services/EndpointScoringService.ts

import { HarEntry } from './types';

/**
 * Defines the weights for the different scoring dimensions.
 * This allows for tuning the scoring algorithm.
 */
export interface ScoreWeights {
  relevance: number;
  security: number;
  businessLogic: number;
  contextual: number;
}

/**
 * Holds the scores for each dimension and the final aggregated score.
 */
export interface EndpointScores {
  relevance: number;
  security: number;
  businessLogic: number;
  contextual: number;
  finalScore: number;
}

/**
 * Implements the multi-dimensional scoring system described in the blueprint.
 * This service replaces the simplistic EndpointClassifier.
 */
export class EndpointScoringService {
  private weights: ScoreWeights;

  constructor(weights?: Partial<ScoreWeights>) {
    // Default weights can be overridden for different analysis strategies
    this.weights = {
      relevance: 1.0,
      security: 1.5,
      businessLogic: 1.2,
      contextual: 0.8,
      ...weights,
    };
  }

  /**
   * Scores a single HAR entry within the context of the entire HAR file.
   * @param entry The HAR entry to score.
   * @param context All other HAR entries, for contextual analysis.
   * @returns The calculated scores for the entry.
   */
  public scoreRequest(entry: HarEntry, context: HarEntry[]): EndpointScores {
    const relevance = this.calculateRelevanceScore(entry);
    const security = this.calculateSecurityScore(entry);
    const businessLogic = this.calculateBusinessLogicScore(entry);
    const contextual = this.calculateContextualScore(entry, context);

    // The final score is a weighted sum of the individual scores.
    const finalScore =
      relevance * this.weights.relevance +
      security * this.weights.security +
      businessLogic * this.weights.businessLogic +
      contextual * this.weights.contextual;

    return {
      relevance,
      security,
      businessLogic,
      contextual,
      finalScore,
    };
  }

  /**
   * Calculates the relevance score based on resource type and URL patterns.
   */
  private calculateRelevanceScore(entry: HarEntry): number {
    let score = 0;
    const url = entry.request.url.toLowerCase();
    const mimeType = entry.response.content.mimeType.toLowerCase();

    // Penalize non-relevant resource types
    if (/\.(css|js|png|jpg|jpeg|gif|svg|woff|ttf|ico)$/.test(url) || /font|image|style/.test(mimeType)) {
      score -= 0.5;
    }

    // Boost relevant resource types
    if (/html|json|xml|text/.test(mimeType)) {
      score += 0.5;
    }

    // Boost based on URL keywords
    if (/\/api\/|graphql/.test(url)) {
      score += 0.8;
    }

    return Math.max(0, score);
  }

  /**
   * Calculates the security score based on authentication, state changes, and sensitive data.
   */
  private calculateSecurityScore(entry: HarEntry): number {
    let score = 0;
    const request = entry.request;
    const response = entry.response;

    // Boost for requests containing authentication tokens
    if (request.headers.some(h => h.name.toLowerCase() === 'authorization') || request.cookies.some(c => /auth|token|session/i.test(c.name))) {
      score += 0.8;
    }

    // Boost for state-changing methods
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
      score += 0.6;
    }

    // Boost for requests containing sensitive data patterns
    if (request.postData?.text && /password|token|key|secret|credential/i.test(request.postData.text)) {
      score += 1.0;
    }

    // Boost for responses that set cookies
    if (response.headers.some(h => h.name.toLowerCase() === 'set-cookie')) {
      score += 0.7;
    }

    return Math.max(0, score);
  }

  /**
   * Calculates the business logic score based on API calls and form submissions.
   */
  private calculateBusinessLogicScore(entry: HarEntry): number {
    let score = 0;
    const request = entry.request;
    const response = entry.response;
    const mimeType = request.postData?.mimeType?.toLowerCase();

    // Boost for form submissions
    if (mimeType && /form-urlencoded|multipart\/form-data/.test(mimeType)) {
      score += 0.8;
    }

    // Boost for API calls (inferred from content type)
    if (mimeType && /json|xml/.test(mimeType)) {
      score += 0.7;
    }

    // Boost for redirects, as they often connect steps in a business flow
    if (response.status >= 300 && response.status < 400) {
        score += 0.5;
    }

    return Math.max(0, score);
  }

  /**
   * Calculates the contextual score based on the request's relationship to other requests.
   */
  private calculateContextualScore(entry: HarEntry, context: HarEntry[]): number {
    let score = 0;
    const entryTime = new Date(entry.startedDateTime).getTime();

    // Boost if the request is close in time to a state-changing request
    const previousRequest = context.find(e => new Date(e.startedDateTime).getTime() < entryTime);
    if (previousRequest && ['POST', 'PUT', 'DELETE'].includes(previousRequest.request.method)) {
        const timeDiff = entryTime - new Date(previousRequest.startedDateTime).getTime();
        if (timeDiff < 2000) { // Within 2 seconds
            score += 0.5;
        }
    }

    // Boost if this request is part of a redirect chain
    const isRedirectTarget = context.some(e =>
        e.response.redirectURL === entry.request.url
    );
    if(isRedirectTarget){
        score += 0.8;
    }

    return Math.max(0, score);
  }
}
