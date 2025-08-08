import { HarEntry } from 'har-format';
import { SessionAnalysisResult } from '../session/types';
import {
  CorrelationMatrix,
  CorrelationScore,
  DependencyAnalysisResult,
  DependencyChain
} from './types';

class RequestCorrelationEngine {
  public buildCorrelationMatrix(requests: HarEntry[], sessionAnalysis: SessionAnalysisResult): CorrelationMatrix {
    const matrix = new CorrelationMatrix(requests.length);
    for (let i = 0; i < requests.length; i++) {
      for (let j = i + 1; j < requests.length; j++) {
        const correlation = this.calculateRequestCorrelation(
          requests[i],
          requests[j],
          sessionAnalysis
        );
        matrix.set(i, j, correlation);
      }
    }
    return matrix;
  }

  private calculateRequestCorrelation(
    req1: HarEntry,
    req2: HarEntry,
    sessionAnalysis: SessionAnalysisResult
  ): CorrelationScore {
    const factors = {
      referer: this.analyzeRefererRelationship(req1, req2),
      cookie: this.analyzeCookieDependency(req1, req2, sessionAnalysis),
      token: this.analyzeTokenDependency(req1, req2),
      temporal: this.analyzeTemporalProximity(req1, req2),
      url: this.analyzeUrlPathSimilarity(req1, req2)
    };
    return this.weightedCorrelationScore(factors);
  }

  private analyzeRefererRelationship(
    req1: HarEntry,
    req2: HarEntry
  ): number {
    const referer = req2.request.headers.find(
      (h) => h.name.toLowerCase() === 'referer'
    );
    return referer && referer.value === req1.request.url ? 1 : 0;
  }

  private analyzeCookieDependency(
    req1: HarEntry,
    req2: HarEntry,
    sessionAnalysis: SessionAnalysisResult
  ): number {
    if (!sessionAnalysis) {
      return 0;
    }

    for (const session of sessionAnalysis.sessions) {
      for (const dep of session.dependencies) {
        if (
          dep.setter.startedDateTime === req1.startedDateTime &&
          dep.getter.startedDateTime === req2.startedDateTime
        ) {
          return 1; // Found a direct dependency
        }
      }
    }

    return 0;
  }

  private analyzeTokenDependency(req1: HarEntry, req2: HarEntry): number {
    return 0;
  }

  private analyzeTemporalProximity(req1: HarEntry, req2: HarEntry): number {
    return 0;
  }

  private analyzeUrlPathSimilarity(req1: HarEntry, req2: HarEntry): number {
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
  private readonly THRESHOLD = 0.5;

  public extractDependencyChains(
    matrix: CorrelationMatrix,
    requests: HarEntry[]
  ): DependencyChain[] {
    const adj = this.buildAdjacencyList(matrix, requests);
    const chains: DependencyChain[] = [];
    for (let i = 0; i < requests.length; i++) {
      this.dfs(i, adj, [requests[i]], chains, requests);
    }
    return chains;
  }

  private buildAdjacencyList(
    matrix: CorrelationMatrix,
    requests: HarEntry[]
  ): number[][] {
    const adj: number[][] = Array(requests.length).fill(0).map(() => []);
    for (let i = 0; i < requests.length; i++) {
      for (let j = i + 1; j < requests.length; j++) {
        if (matrix.get(i, j).score > this.THRESHOLD) {
          adj[i].push(j);
        }
      }
    }
    return adj;
  }

  private dfs(
    u: number,
    adj: number[][],
    path: HarEntry[],
    chains: DependencyChain[],
    requests: HarEntry[]
  ) {
    if (adj[u].length === 0) {
      chains.push([...path]);
      return;
    }
    for (const v of adj[u]) {
      path.push(requests[v]);
      this.dfs(v, adj, path, chains, requests);
      path.pop();
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

  public analyzeDependencies(requests: HarEntry[], sessionAnalysis: SessionAnalysisResult): DependencyAnalysisResult {
    const correlationMatrix =
      this.correlationEngine.buildCorrelationMatrix(requests, sessionAnalysis);
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

  private identifyCriticalPath(chains: DependencyChain[]): HarEntry[] {
    return chains.sort((a, b) => b.length - a.length)[0] || [];
  }

  private identifyRedundantRequests(
    allRequests: HarEntry[],
    criticalPath: HarEntry[]
  ): HarEntry[] {
    const criticalPathUrls = new Set(criticalPath.map((req) => req.request.url));
    return allRequests.filter(
      (req) => !criticalPathUrls.has(req.request.url)
    );
  }
}
