import { HarEntry } from 'har-format';

export interface Prerequisite {
  request: HarEntry;
  prerequisites: HarEntry[];
}

export interface TimingRequirement {
  from: HarEntry;
  to: HarEntry;
  delayMs: number;
}

export interface SequenceRules {
  prerequisites: Prerequisite[];
  parallelizable: HarEntry[][];
  timingRequirements: TimingRequirement[];
}
