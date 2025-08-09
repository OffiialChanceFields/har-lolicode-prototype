import { Entry } from 'har-format';
import {
  CorrelationMatrix,
  CorrelationScore,
  DependencyAnalysisResult,
  DependencyChain
} from './types';

/**
 * Calculates correlation scores between pairs of HAR entries based on various factors.
 */
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

<<<<<<< HEAD
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
=======
  private analyzeCookieDependency(req1: HarEntry, req2: HarEntry): number {
    const setCookieHeaders = req1.response.headers.filter(
      (h) => h.name.toLowerCase() === 'set-cookie'
    );
    if (setCookieHeaders.length === 0) return 0;

    const requestCookies = req2.request.headers.find(
      (h) => h.name.toLowerCase() === 'cookie'
    );
    if (!requestCookies) return 0;

    for (const setCookieHeader of setCookieHeaders) {
      const cookieName = setCookieHeader.value.split('=')[0];
      if (requestCookies.value.includes(cookieName + '=')) {
        return 1; // Found a strong cookie dependency
      }
    }
    return 0;
  }

  private analyzeTokenDependency(req1: HarEntry, req2: HarEntry): number {
    const responseBody = req1.response.content?.text;
    if (!responseBody) return 0;

    let token = '';
    try {
      // Heuristic for JSON responses
      const jsonBody = JSON.parse(responseBody);
      token = jsonBody.access_token || jsonBody.token || '';
    } catch (e) {
      // Heuristic for non-JSON or malformed JSON
      const match = responseBody.match(/"(access_token|token)":"([^"]+)"/);
      if (match && match[2]) {
        token = match[2];
      }
    }

    if (!token) return 0;

    const authHeader = req2.request.headers.find(
      (h) => h.name.toLowerCase() === 'authorization'
    );
    if (authHeader && authHeader.value.includes(token)) {
      return 1; // Strong signal: token from response is used in next request's auth header
    }

    return 0;
  }

  private analyzeTemporalProximity(req1: HarEntry, req2: HarEntry): number {
    const time1 = new Date(req1.startedDateTime).getTime();
    const time2 = new Date(req2.startedDateTime).getTime();
    const diffSeconds = Math.abs(time2 - time1) / 1000;

    const MAX_RELEVANT_SECONDS = 10;
    if (diffSeconds >= 0 && diffSeconds <= MAX_RELEVANT_SECONDS) {
      // Inverse relationship: closer requests get higher scores
      return 1 - diffSeconds / MAX_RELEVANT_SECONDS;
    }
    return 0;
  }

  private analyzeUrlPathSimilarity(req1: HarEntry, req2: HarEntry): number {
    try {
      const url1 = new URL(req1.request.url);
      const url2 = new URL(req2.request.url);

      if (url1.hostname !== url2.hostname) return 0;

      const path1 = url1.pathname;
      const path2 = url2.pathname;

      if (path1 === path2) return 1;
      if (path1.startsWith(path2) || path2.startsWith(path1)) return 0.5;
    } catch (e) {
      return 0;
    }
>>>>>>> dd39f50 (Removed AnalysisMode file as its not needed due to all the modes are now consolidated into one file.)
    return 0;
  }

  private weightedCorrelationScore(
    factors: Record<string, number>
  ): CorrelationScore {
    const weights = {
      referer: 0.5,
      cookie: 0.8, // High weight, strong indicator
      token: 0.9, // Very high weight, very strong indicator
      temporal: 0.2,
      url: 0.1
    };
    const score = Object.entries(factors).reduce(
      (acc, [key, value]) => acc + value * (weights[key] || 0),
      0
    );
    return { score: Math.min(score, 1.0), factors }; // Cap score at 1.0
  }
}

/**
 * Traverses the correlation matrix to identify chains of dependent requests.
 */
class DependencyMapper {
  private readonly SIMILARITY_THRESHOLD = 0.8;

  public extractDependencyChains(
    matrix: CorrelationMatrix,
<<<<<<< HEAD
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
=======
    requests: HarEntry[]
  ): DependencyChain[] {
    const CORRELATION_THRESHOLD = 0.4; // A lower threshold to allow more potential links
    const adj: number[][] = Array(matrix.size)
      .fill(0)
      .map(() => []);

    for (let i = 0; i < matrix.size; i++) {
      for (let j = i + 1; j < matrix.size; j++) {
        const score = matrix.get(i, j)?.score;
        if (score && score >= CORRELATION_THRESHOLD) {
          adj[i].push(j);
>>>>>>> dd39f50 (Removed AnalysisMode file as its not needed due to all the modes are now consolidated into one file.)
        }
      }
    }

<<<<<<< HEAD
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
=======
    const allPaths: number[][] = [];
    const path: number[] = [];

    const dfs = (u: number) => {
      path.push(u);
      let isLeaf = true;
      if (adj[u]) {
        for (const v of adj[u]) {
          isLeaf = false;
          dfs(v);
        }
      }
      if (isLeaf) {
        allPaths.push([...path]);
      }
      path.pop();
    };

    const inDegree = new Array(matrix.size).fill(0);
    for (let i = 0; i < matrix.size; i++) {
      if (adj[i]) {
        for (const j of adj[i]) {
          inDegree[j]++;
        }
      }
    }

    for (let i = 0; i < matrix.size; i++) {
      if (inDegree[i] === 0) {
        dfs(i);
      }
    }

    return allPaths
      .filter((p) => p.length > 1)
      .map((p) => {
        const chainRequests = p.map((index) => requests[index]);
        const strength =
          p.reduce((sum, _, i) => {
            if (i === 0) return 0;
            const prev = p[i - 1];
            const curr = p[i];
            return sum + (matrix.get(prev, curr)?.score || 0);
          }, 0) / (p.length - 1);

        return {
          start: p[0],
          end: p[p.length - 1],
          requests: chainRequests,
          strength: strength,
          length: p.length
        };
      });
>>>>>>> dd39f50 (Removed AnalysisMode file as its not needed due to all the modes are now consolidated into one file.)
  }
}

/**
 * Analyzes HAR entries to determine request dependencies, critical paths, and redundancies.
 */
export class RequestDependencyAnalyzer {
  private readonly correlationEngine: RequestCorrelationEngine;
  private readonly dependencyMapper: DependencyMapper;

  constructor() {
    this.correlationEngine = new RequestCorrelationEngine();
    this.dependencyMapper = new DependencyMapper();
  }

<<<<<<< HEAD
  public analyzeDependencies(requests: Entry[]): DependencyAnalysisResult {
    const correlationMatrix =
      this.correlationEngine.buildCorrelationMatrix(requests);
    const dependencyChains =
      this.dependencyMapper.extractDependencyChains(correlationMatrix, requests);
    const criticalPath = this.identifyCriticalPath(dependencyChains);
=======
  public analyzeDependencies(requests: HarEntry[]): DependencyAnalysisResult {
    if (requests.length === 0) {
        return {
            correlationMatrix: new CorrelationMatrix(0),
            dependencyChains: [],
            criticalPath: [],
            redundantRequests: []
        };
    }
    
    const correlationMatrix =
      this.correlationEngine.buildCorrelationMatrix(requests);
    const dependencyChains = this.dependencyMapper.extractDependencyChains(
      correlationMatrix,
      requests
    );
    const criticalPath = this.identifyCriticalPath(dependencyChains, requests);
>>>>>>> dd39f50 (Removed AnalysisMode file as its not needed due to all the modes are now consolidated into one file.)
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

<<<<<<< HEAD
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
=======
  private identifyCriticalPath(
    chains: DependencyChain[],
    requests: HarEntry[]
  ): HarEntry[] {
    if (chains.length === 0) {
      // Fallback: if no chains are found, maybe just return all requests?
      // Or perhaps those with high scores from the scoring service.
      // For now, returning empty is consistent with "no path found".
      // A better fallback might be to find the single most "important" request.
      const authRequestIndex = requests.findIndex(r => r.request.url.toLowerCase().includes('auth'));
      if(authRequestIndex !== -1) return [requests[authRequestIndex]];
      return [];
    }
    // Critical path is the longest chain. This is a heuristic.
    // A better heuristic could be longest chain with highest average strength.
    chains.sort((a, b) => b.length - a.length);
    return chains[0].requests || [];
  }

  private identifyRedundantRequests(
    allRequests: HarEntry[],
    criticalPath: HarEntry[]
  ): HarEntry[] {
    const criticalPathUrls = new Set(
      criticalPath.map((req) => req.request.url)
    );
>>>>>>> dd39f50 (Removed AnalysisMode file as its not needed due to all the modes are now consolidated into one file.)
    return allRequests.filter(
      (req) => !criticalPathUrls.has(req.request.url)
    );
  }
}