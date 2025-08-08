import { HarEntry } from 'har-format';
import { DependencyAnalysisResult } from '../dependency/types';
import { SequenceRules, Prerequisite, TimingRequirement } from './types';

export class RequestSequencer {
  public analyzeSequence(
    entries: HarEntry[],
    dependencyAnalysis: DependencyAnalysisResult
  ): SequenceRules {
    return {
      prerequisites: this.findPrerequisites(dependencyAnalysis.criticalPath),
      parallelizable: this.findParallelizable(entries, dependencyAnalysis),
      timingRequirements: this.analyzeTimingPatterns(entries),
    };
  }

  private findPrerequisites(criticalPath: HarEntry[]): Prerequisite[] {
    const prerequisites: Prerequisite[] = [];
    for (let i = 1; i < criticalPath.length; i++) {
      prerequisites.push({
        request: criticalPath[i],
        prerequisites: criticalPath.slice(0, i),
      });
    }
    return prerequisites;
  }

  private findParallelizable(
    entries: HarEntry[],
    dependencyAnalysis: DependencyAnalysisResult
  ): HarEntry[][] {
    // For now, we'll consider all redundant requests as potentially parallelizable.
    // A more advanced implementation would group them based on their own dependencies.
    if (dependencyAnalysis.redundantRequests.length > 0) {
      return [dependencyAnalysis.redundantRequests];
    }
    return [];
  }

  private analyzeTimingPatterns(entries: HarEntry[]): TimingRequirement[] {
    const requirements: TimingRequirement[] = [];
    const THRESHOLD_MS = 1000; // 1 second

    for (let i = 1; i < entries.length; i++) {
      const prevEntry = entries[i - 1];
      const currentEntry = entries[i];

      const prevEndTime = new Date(prevEntry.startedDateTime).getTime() + prevEntry.time;
      const currentTime = new Date(currentEntry.startedDateTime).getTime();
      const delay = currentTime - prevEndTime;

      if (delay > THRESHOLD_MS) {
        requirements.push({
          from: prevEntry,
          to: currentEntry,
          delayMs: delay,
        });
      }
    }
    return requirements;
  }
}
