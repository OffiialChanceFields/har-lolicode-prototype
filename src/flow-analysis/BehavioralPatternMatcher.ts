// src/flow-analysis/BehavioralPatternMatcher.ts
import { HarEntry, DetectedToken } from '../services/types';
import {
  AuthenticationPatternLibrary,
  AuthenticationPattern
} from '../pattern-library/AuthenticationPatternLibrary';

export interface PatternMatch {
  patternId: string;
  confidence: number;
  steps: HarEntry[];
  extractedData: Record<string, unknown>;
}

export interface PatternStep {
    urlPattern?: RegExp;
    methodPattern?: string[];
    statusPattern?: number[];
    headerPattern?: Record<string, RegExp>;
    bodyPattern?: RegExp;
    timing?: {
        minDelaySeconds?: number;
        maxDelaySeconds?: number;
    };
}

export class BehavioralPatternMatcher {
  private readonly patternLibrary: AuthenticationPatternLibrary;

  constructor(patternLibrary: AuthenticationPatternLibrary) {
    this.patternLibrary = patternLibrary;
  }

  matchPatterns(requests: HarEntry[]): PatternMatch[] {
    const matches: PatternMatch[] = [];
    const patterns = this.patternLibrary.getAllPatterns();

    for (const [patternId, pattern] of patterns) {
      const patternMatches = this.findPatternMatches(requests, pattern);

      for (const match of patternMatches) {
        const extractedData = pattern.extract ? pattern.extract(match) : {};
        const confidence = this.calculateConfidence(match, pattern);

        matches.push({
          patternId,
          confidence,
          steps: match,
          extractedData
        });
      }
    }

    // Post-process to identify composite patterns like session elevation
    const compositeMatches = this.findCompositePatterns(requests, matches);

    // Combine and sort
    const allMatches = [...matches, ...compositeMatches];
    return allMatches.sort((a, b) => b.confidence - a.confidence);
  }

  private findCompositePatterns(
    requests: HarEntry[],
    existingMatches: PatternMatch[]
  ): PatternMatch[] {
    const compositeMatches: PatternMatch[] = [];

    // Example: Session Elevation
    const sessionElevationPattern = this.patternLibrary.getPattern(
      'session_elevation' as any
    );
    if (sessionElevationPattern) {
      for (let i = 0; i < requests.length; i++) {
        // Step 1: Denied request
        if (
          this.entryMatchesPattern(
            requests[i],
            sessionElevationPattern.pattern[0] as PatternStep
          )
        ) {
          // Step 2: Look for a successful auth pattern match after the denied request
          for (const match of existingMatches) {
            if (match.steps[0].startedDateTime > requests[i].startedDateTime) {
              // Step 3: Look for a successful request to the same resource
              for (let j = i + 1; j < requests.length; j++) {
                if (
                  requests[j].request.url === requests[i].request.url &&
                  this.entryMatchesPattern(
                    requests[j],
                    sessionElevationPattern.pattern[2] as PatternStep
                  )
                ) {
                  const steps = [requests[i], ...match.steps, requests[j]];
                  const confidence =
                    this.calculateConfidence(
                      steps,
                      sessionElevationPattern
                    ) * 0.9; // Adjust confidence for composite
                  compositeMatches.push({
                    patternId: 'session_elevation',
                    confidence,
                    steps,
                    extractedData: {
                      deniedRequest: requests[i],
                      authFlow: match,
                      successfulRequest: requests[j]
                    }
                  });
                }
              }
            }
          }
        }
      }
    }

    return compositeMatches;
  }

  private findPatternMatches(
    requests: HarEntry[],
    pattern: AuthenticationPattern
  ): HarEntry[][] {
    const matches: HarEntry[][] = [];

    for (let i = 0; i < requests.length; i++) {
      const sequence: HarEntry[] = [];
      let patternIndex = 0;
      let requestIndex = i;

      while (patternIndex < pattern.pattern.length && requestIndex < requests.length) {
        const patternStep = pattern.pattern[patternIndex] as PatternStep;
        const request = requests[requestIndex];

        if (this.entryMatchesPattern(request, patternStep)) {
          sequence.push(request);

          // Check timing constraints
          const timing = (pattern.pattern[patternIndex] as PatternStep).timing;
          if (timing && sequence.length > 1) {
            const prevTime = new Date(
              sequence[sequence.length - 2].startedDateTime
            ).getTime();
            const currTime = new Date(
              sequence[sequence.length - 1].startedDateTime
            ).getTime();
            const delaySeconds = (currTime - prevTime) / 1000;

            if (
              (timing.minDelaySeconds && delaySeconds < timing.minDelaySeconds) ||
              (timing.maxDelaySeconds && delaySeconds > timing.maxDelaySeconds)
            ) {
              // Timing constraint violated, break the sequence match
              break;
            }
          }

          // It's a match, advance both
          patternIndex++;
          requestIndex++;
        } else if (patternStep.isOptional) {
          // Not a match, but the pattern step is optional.
          // Advance the pattern index and try to match the same request against the next step.
          patternIndex++;
        } else {
          // Not a match and the step is mandatory. This sequence has failed.
          break; // Exit the while loop
        }
      }

      // After the loop, check if we found a valid match.
      // A valid match means we have processed all pattern steps.
      // If the last steps are optional and unmatched, we still need to increment patternIndex for them.
      while (
        patternIndex < pattern.pattern.length &&
        (pattern.pattern[patternIndex] as PatternStep).isOptional
      ) {
        patternIndex++;
      }

      if (patternIndex === pattern.pattern.length) {
        // We have successfully matched all mandatory steps.
        matches.push(sequence);
      }
    }

    return matches;
  }

  private entryMatchesPattern(entry: HarEntry, pattern: PatternStep): boolean {
    if (pattern.urlPattern) {
      const patterns = Array.isArray(pattern.urlPattern)
        ? pattern.urlPattern
        : [pattern.urlPattern];
      if (!patterns.some((p) => p.test(entry.request.url))) {
        return false;
      }
    }

    if (
      pattern.methodPattern &&
      !pattern.methodPattern.includes(entry.request.method)
    ) {
      return false;
    }

    if (
      pattern.statusPattern &&
      !pattern.statusPattern.includes(entry.response.status)
    ) {
      return false;
    }

    if (pattern.headerPattern) {
      for (const [headerName, headerPattern] of Object.entries(
        pattern.headerPattern
      )) {
        const header = entry.request.headers.find(
          (h) => h.name.toLowerCase() === headerName.toLowerCase()
        );

        if (!header || !(headerPattern as RegExp).test(header.value)) {
          return false;
        }
      }
    }

    if (pattern.bodyPattern && entry.request.postData?.text) {
      if (!pattern.bodyPattern.test(entry.request.postData.text)) {
        return false;
      }
    }

    return true;
  }

  private calculateConfidence(
    entries: HarEntry[],
    pattern: AuthenticationPattern
  ): number {
    let confidence = pattern.confidence || 0.8;

    // Favor more specific patterns
    if (pattern.pattern.length > 1) {
      confidence *= 1.1;
    }
    if (
      pattern.id.includes('mfa') ||
      pattern.id.includes('oauth') ||
      pattern.id.includes('saml')
    ) {
      confidence *= 1.2;
    }

    // Adjust based on timing consistency
    if (entries.length > 1) {
      const timings: number[] = [];
      for (let i = 1; i < entries.length; i++) {
        const prevTime = new Date(entries[i - 1].startedDateTime).getTime();
        const currTime = new Date(entries[i].startedDateTime).getTime();
        timings.push(currTime - prevTime);
      }

      const avgTiming =
        timings.reduce((a, b) => a + b, 0) / timings.length;
      const variance =
        timings.reduce((sum, t) => sum + Math.pow(t - avgTiming, 2), 0) /
        timings.length;
      const stdDev = Math.sqrt(variance);

      if (stdDev > avgTiming * 0.5) {
        confidence *= 0.9; // Less penalty
      }
    }

    // Boost confidence if tokens are detected
    const hasDetectedTokens = entries.some(
      (e) =>
        (e as HarEntry & { detectedTokens: DetectedToken[] }).detectedTokens
          ?.length > 0
    );
    if (hasDetectedTokens) {
      confidence *= 1.15;
    }

    return Math.min(1.0, confidence);
  }
}
