import { Entry } from 'har-format';
import {
  CorrelationMatrix,
  CorrelationScore,
  DependencyAnalysisResult,
  DependencyChain
} from './types';

class RequestCorrelationEngine {
  public buildCorrelationMatrix(requests: Entry[]): CorrelationMatrix {
    const matrix = new CorrelationMatrix(requests.length);
    for (let i = 0; i < requests.length; i++) {
      for (let j = i + 1; j < requests.length; j++) {
        const correlation = this.calculateRequestCorrelation(
          requests[i],
          requests[j]
        );
        matrix.set(i, j, correlation);
      }
    }
    return matrix;
  }

  private calculateRequestCorrelation(
    req1: Entry,
    req2: Entry
  ): CorrelationScore {
    const factors = {
      referer: this.analyzeRefererRelationship(req1, req2),
      cookie: this.analyzeCookieDependency(req1, req2),
      token: this.analyzeTokenDependency(req1, req2),
      temporal: this.analyzeTemporalProximity(req1, req2),
      url: this.analyzeUrlPathSimilarity(req1, req2)
    };
    return this.weightedCorrelationScore(factors);
  }

  private analyzeRefererRelationship(
    req1: Entry,
    req2: Entry
  ): number {
    const referer = req2.request.headers.find(
      (h) => h.name.toLowerCase() === 'referer'
    );
    return referer && referer.value === req1.request.url ? 1 : 0;
  }

  private analyzeCookieDependency(req1: Entry, req2: Entry): number {
    return 0;
  }

  private analyzeTokenDependency(req1: Entry, req2: Entry): number {
    return 0;
  }

  private analyzeTemporalProximity(req1: Entry, req2: Entry): number {
    return 0;
  }

  private analyzeUrlPathSimilarity(req1: Entry, req2: Entry): number {
    return 0;
  }

  private weightedCorrelationScore(factors: Record<string, number>): CorrelationScore {
    const weights = {
      referer: 0.5,
      cookie: 0.2,
      token: 0.2,
      temporal: 0.05,
      url: 0.05
    };
    const score = Object.entries(factors).reduce(
      (acc, [key, value]) => acc + value * (weights[key] || 0),
      0
    );
    return { score, factors };
  }
}

class DependencyMapper {
  private readonly SIMILARITY_THRESHOLD = 0.8;

  public extractDependencyChains(
    matrix: CorrelationMatrix,
    requests: Entry[]
  ): DependencyChain[] {
    const chains: DependencyChain[] = [];
    const visited = new Array(matrix.getSize()).fill(false);

    for (let i = 0; i < matrix.getSize(); i++) {
      if (!visited[i]) {
        const currentChain: Entry[] = [];
        this.dfs(i, visited, requests, matrix, currentChain);
        if (currentChain.length > 1) {
          chains.push(currentChain);
        }
      }
    }

    return chains;
  }

  private dfs(
    u: number,
    visited: boolean[],
    requests: Entry[],
    correlationMatrix: CorrelationMatrix,
    currentChain: Entry[]
  ) {
    visited[u] = true;
    currentChain.push(requests[u]);

    for (let v = 0; v < correlationMatrix.getSize(); v++) {
      if (
        u !== v &&
        !visited[v] &&
        correlationMatrix.get(u, v)?.score > this.SIMILARITY_THRESHOLD
      ) {
        this.dfs(v, visited, requests, correlationMatrix, currentChain);
      }
    }
  }
}

export class RequestDependencyAnalyzer {
  private readonly correlationEngine: RequestCorrelationEngine;
  private readonly dependencyMapper: DependencyMapper;

  constructor() {
    this.correlationEngine = new RequestCorrelationEngine();
    this.dependencyMapper = new DependencyMapper();
  }

  public analyzeDependencies(requests: Entry[]): DependencyAnalysisResult {
    const correlationMatrix =
      this.correlationEngine.buildCorrelationMatrix(requests);
    const dependencyChains =
      this.dependencyMapper.extractDependencyChains(correlationMatrix, requests);
    const criticalPath = this.identifyCriticalPath(dependencyChains);
    const redundantRequests = this.identifyRedundantRequests(
      requests,
      criticalPath
    );

    return {
      correlationMatrix,
      dependencyChains,
      criticalPath,
      redundantRequests
    };
  }

  private identifyCriticalPath(chains: DependencyChain[]): Entry[] {
    if (chains.length === 0) {
      return [];
    }

    let criticalPath: Entry[] = [];
    let maxTotalTime = 0;

    for (const chain of chains) {
      const totalTime = this.calculateTotalLength(chain);
      if (totalTime > maxTotalTime) {
        maxTotalTime = totalTime;
        criticalPath = chain;
      }
    }

    return criticalPath;
  }

  private calculateTotalLength(chain: DependencyChain): number {
    return chain.reduce((total, req) => total + req.time, 0);
  }

  private identifyRedundantRequests(
    allRequests: Entry[],
    criticalPath: Entry[]
  ): Entry[] {
    const criticalPathUrls = new Set(criticalPath.map((req) => req.request.url));
    return allRequests.filter(
      (req) => !criticalPathUrls.has(req.request.url)
    );
  }
}
