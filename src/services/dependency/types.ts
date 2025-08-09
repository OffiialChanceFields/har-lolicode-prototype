import { Entry } from 'har-format';

export interface CorrelationScore {
  score: number;
  factors: Record<string, number>;
}

export class CorrelationMatrix {
  private matrix: CorrelationScore[][];
  private size: number;

  constructor(size: number) {
    this.size = size;
    this.matrix = Array(size)
      .fill(null)
      .map(() =>
        Array(size)
          .fill(null)
          .map(() => ({ score: 0, factors: {} }))
      );
  }

  set(i: number, j: number, score: CorrelationScore) {
    this.matrix[i][j] = score;
    this.matrix[j][i] = score; // Assuming symmetric correlation
  }

  get(i: number, j: number): CorrelationScore {
    return this.matrix[i][j];
  }

  getSize(): number {
    return this.size;
  }
}

export type DependencyChain = Entry[];

export interface DependencyAnalysisResult {
  correlationMatrix: CorrelationMatrix;
  dependencyChains: DependencyChain[];
  criticalPath: Entry[];
  redundantRequests: Entry[];
}
