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
    const compositePatterns = this.patternLibrary.getCompositePatterns();
    const sortedMatches = [...existingMatches].sort(
      (a, b) =>
        new Date(a.steps[0].startedDateTime).getTime() -
        new Date(b.steps[0].startedDateTime).getTime()
    );

    // MFA sequences
    for (const compositePattern of compositePatterns) {
      for (let i = 0; i < sortedMatches.length; i++) {
        if (sortedMatches[i].patternId === compositePattern.sequence[0]) {
          let sequenceFound = true;
          const sequenceMatches = [sortedMatches[i]];
          let lastMatchIndex = i;

          for (let j = 1; j < compositePattern.sequence.length; j++) {
            const nextPatternId = compositePattern.sequence[j];
            const nextMatch = sortedMatches
              .slice(lastMatchIndex + 1)
              .find((match) => match.patternId === nextPatternId);

            if (nextMatch) {
              sequenceMatches.push(nextMatch);
              lastMatchIndex = sortedMatches.indexOf(nextMatch);
            } else {
              sequenceFound = false;
              break;
            }
          }

          if (sequenceFound) {
            const allSteps = sequenceMatches.flatMap((m) => m.steps);
            const combinedExtractedData = sequenceMatches.reduce(
              (acc, m) => ({ ...acc, ...m.extractedData }),
              {}
            );
            compositeMatches.push({
              patternId: compositePattern.id,
              confidence: compositePattern.confidence,
              steps: allSteps,
              extractedData: {
                ...combinedExtractedData,
                sequence: sequenceMatches.map((m) => m.patternId)
              }
            });
          }
        }
      }
    }

    // Session Elevation
    const sessionElevationPattern = this.patternLibrary.getPattern(
      'session_elevation' as any
    );
    if (sessionElevationPattern) {
      for (let i = 0; i < requests.length; i++) {
        if (
          this.entryMatchesPattern(
            requests[i],
            sessionElevationPattern.pattern[0] as PatternStep
          )
        ) {
          for (const match of existingMatches) {
            if (match.steps[0].startedDateTime > requests[i].startedDateTime) {
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
                    ) * 0.9;
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

    // Try to find sequences that match the pattern
    for (let i = 0; i < requests.length; i++) {
      const sequence: HarEntry[] = [];
      let patternIndex = 0;

      for (
        let j = i;
        j < requests.length && patternIndex < pattern.pattern.length;
        j++
      ) {
        if (
          this.entryMatchesPattern(requests[j], pattern.pattern[patternIndex])
        ) {
          sequence.push(requests[j]);
          patternIndex++;

          // Check timing constraints
          if (
            (pattern.pattern[patternIndex - 1] as PatternStep).timing &&
            sequence.length > 1
          ) {
            const prevTime = new Date(
              sequence[sequence.length - 2].startedDateTime
            ).getTime();
            const currTime = new Date(
              sequence[sequence.length - 1].startedDateTime
            ).getTime();
            const delaySeconds = (currTime - prevTime) / 1000;

            const timing = (pattern.pattern[patternIndex - 1] as PatternStep).timing;
            if (
              timing.minDelaySeconds &&
              delaySeconds < timing.minDelaySeconds
            ) {
              // Timing constraint violated
              break;
            }
            if (
              timing.maxDelaySeconds &&
              delaySeconds > timing.maxDelaySeconds
            ) {
              // Timing constraint violated
              break;
            }
          }
        }
      }

      if (sequence.length === pattern.pattern.length) {
        matches.push(sequence);
      }
    }

    return matches;
  }

  private entryMatchesPattern(entry: HarEntry, pattern: PatternStep): boolean {
    if (pattern.urlPattern && !pattern.urlPattern.test(entry.request.url)) {
      return false;
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
