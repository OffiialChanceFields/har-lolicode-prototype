// src/core/StreamingHarParser.ts
import { EventEmitter } from '../lib/event-emitter';
import { CircularBuffer } from '../lib/CircularBuffer';
import { HarEntry, Har, HarCookie } from '../services/types';
import { ParameterExtractionService } from '../services/parameter/ParameterExtractionService';

export interface ParserOptions {
  batchSize?: number;
  validateEntries?: boolean;
  maxEntrySize?: number;
  parseTimeout?: number;
  includeTiming?: boolean;
  includeCache?: boolean;
  skipLargeResponses?: boolean;
  largeResponseThreshold?: number;
}

export interface ParseProgress {
  bytesProcessed: number;
  totalBytes: number;
  entriesParsed: number;
  entriesSkipped: number;
  currentBatch: number;
  estimatedTotal: number;
  percentComplete: number;
}

export interface ParseError {
  message: string;
  position: number;
  entry?: Partial<HarEntry>;
  phase: 'parsing' | 'validation' | 'processing';
}

export interface ParseStatistics {
  totalEntries: number;
  validEntries: number;
  skippedEntries: number;
  parseErrors: number;
  averageEntrySize: number;
  largestEntry: number;
  processingTimeMs: number;
  memoryUsed: number;
  correlationAnalysisTimeMs?: number;
  criticalPathTimeMs?: number;
  estimatedTotal?: number;
}

export class StreamingHarParser extends EventEmitter {
  private static readonly DEFAULT_BATCH_SIZE = 100;
  private static readonly MAX_ENTRY_SIZE = 10 * 1024 * 1024; // 10MB
  private static readonly LARGE_RESPONSE_THRESHOLD = 1024 * 1024; // 1MB
  private static readonly PARSE_TIMEOUT = 60000; // 60 seconds
  private static readonly CORRELATION_MATRIX_THRESHOLD = 0.7;

  private options: Required<ParserOptions>;
  private statistics: ParseStatistics;
  private parseStartTime: number = 0;
  private correlationMatrix: number[][] | null = null;
  public criticalPath: number[] | null = null;
  private abortController: AbortController;

  constructor(options: ParserOptions = {}) {
    super();
    this.options = {
      batchSize: options.batchSize || StreamingHarParser.DEFAULT_BATCH_SIZE,
      validateEntries: options.validateEntries !== false,
      maxEntrySize: options.maxEntrySize || StreamingHarParser.MAX_ENTRY_SIZE,
      parseTimeout: options.parseTimeout || StreamingHarParser.PARSE_TIMEOUT,
      includeTiming: options.includeTiming !== false,
      includeCache: options.includeCache !== false,
      skipLargeResponses: options.skipLargeResponses || false,
      largeResponseThreshold:
        options.largeResponseThreshold ||
        StreamingHarParser.LARGE_RESPONSE_THRESHOLD
    };
    this.statistics = {
      totalEntries: 0,
      validEntries: 0,
      skippedEntries: 0,
      parseErrors: 0,
      averageEntrySize: 0,
      largestEntry: 0,
      processingTimeMs: 0,
      memoryUsed: 0
    };
    this.abortController = new AbortController();
  }

  // Synchronous parsing with event emission
  parse(harContent: string): void {
    this.parseStartTime = performance.now();
    try {
      this.emit('start', { totalBytes: harContent.length });
      // Validate HAR structure
      const har = this.validateAndParseHar(harContent);
      // Process entries
      const entries = har.log.entries;
      this.statistics.estimatedTotal = entries.length;
      let processedCount = 0;
      const batchBuffer: HarEntry[] = [];
      const totalBytes = harContent.length;

      for (let i = 0; i < entries.length; i++) {
        if (this.abortController.signal.aborted) {
          throw new Error('Parsing aborted');
        }
        try {
          const entry = this.processEntry(entries[i], i);
          if (entry) {
            batchBuffer.push(entry);
            this.statistics.validEntries++;
            // Emit individual entry
            this.emit('entry', entry);
            // Process batch if full
            if (batchBuffer.length >= this.options.batchSize) {
              this.emit('batch', [...batchBuffer]);
              batchBuffer.length = 0;
            }
          } else {
            this.statistics.skippedEntries++;
          }
          processedCount++;
          // Emit progress
          if (processedCount % 10 === 0) {
            this.emitProgress(
              processedCount,
              entries.length,
              Math.floor((processedCount / entries.length) * totalBytes),
              totalBytes
            );
          }
        } catch (error) {
          this.handleEntryError(error as Error, i, entries[i]);
        }
      }

      // Process remaining entries
      if (batchBuffer.length > 0) {
        this.emit('batch', batchBuffer);
      }

      // Finalize statistics
      this.finalizeStatistics();
      this.emit('end', this.statistics);
    } catch (error) {
      this.emit('error', this.createParseError(error as Error, 0, 'parsing'));
    }
  }

  // Asynchronous streaming parser
  async *parseHarEntriesAsync(harContent: string): AsyncGenerator<HarEntry[]> {
    const entriesBuffer = new CircularBuffer<HarEntry>(this.options.batchSize);
    const jsonStream = this.createJsonStream(harContent);
    this.parseStartTime = performance.now();
    this.emit('start', { totalBytes: harContent.length });

    try {
      for await (const entry of jsonStream) {
        if (this.abortController.signal.aborted) {
          throw new Error('Parsing aborted');
        }
        entriesBuffer.push(entry);
        this.emit('entry', entry);

        if (entriesBuffer.length >= this.options.batchSize) {
          const batch = entriesBuffer.toArray();
          yield batch;
          this.emit('batch', batch);
          entriesBuffer.clear();
        }
      }

      // Yield remaining entries
      if (entriesBuffer.length > 0) {
        const finalBatch = entriesBuffer.toArray();
        yield finalBatch;
        this.emit('batch', finalBatch);
      }

      this.finalizeStatistics();
      this.emit('end', this.statistics);
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  // Enhanced correlation analysis
  async analyzeCorrelations(entries: HarEntry[]): Promise<number[][]> {
    const correlationStartTime = performance.now();
    const correlationMatrix = this.buildCorrelationMatrix(entries);
    this.correlationMatrix = correlationMatrix;

    // Identify critical path
    this.criticalPath = this.identifyCriticalPath(correlationMatrix, entries);

    this.statistics.correlationAnalysisTimeMs =
      performance.now() - correlationStartTime;
    return correlationMatrix;
  }

  private buildCorrelationMatrix(entries: HarEntry[]): number[][] {
    const matrix = Array(entries.length)
      .fill(0)
      .map(() => Array(entries.length).fill(0));

    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const correlation = this.calculateRequestCorrelation(
          entries[i],
          entries[j]
        );
        matrix[i][j] = correlation;
        matrix[j][i] = correlation; // Symmetric
      }
    }

    return matrix;
  }

  private calculateRequestCorrelation(
    req1: HarEntry,
    req2: HarEntry
  ): number {
    const factors = [
      this.analyzeRefererRelationship(req1, req2) * 0.25,
      this.analyzeCookieDependency(req1, req2) * 0.2,
      this.analyzeTokenDependency(req1, req2) * 0.2,
      this.analyzeTemporalProximity(req1, req2) * 0.2,
      this.analyzeUrlPathSimilarity(req1.request.url, req2.request.url) * 0.15
    ];

    return factors.reduce((sum, factor) => sum + factor, 0);
  }

  private analyzeRefererRelationship(
    req1: HarEntry,
    req2: HarEntry
  ): number {
    const refererHeader = req2.request.headers.find(
      (h) =>
        h.name.toLowerCase() === 'referer' ||
        h.name.toLowerCase() === 'referrer'
    );

    if (!refererHeader) return 0;

    try {
      const refererUrl = new URL(refererHeader.value);
      const req1Url = new URL(req1.request.url);

      // Exact match
      if (refererUrl.href === req1Url.href) return 1.0;

      // Same domain
      if (refererUrl.hostname === req1Url.hostname) {
        // Similar path
        const pathSimilarity = this.calculatePathSimilarity(
          refererUrl.pathname,
          req1Url.pathname
        );
        return 0.7 + pathSimilarity * 0.3;
      }

      return 0;
    } catch (e) {
      return 0;
    }
  }

  private analyzeCookieDependency(req1: HarEntry, req2: HarEntry): number {
    const cookiesBefore = new Set(req1.response.cookies.map((c) => c.name));
    const cookiesAfter = new Set(req2.request.cookies.map((c) => c.name));

    let matchingCount = 0;
    cookiesBefore.forEach((cookie) => {
      if (cookiesAfter.has(cookie)) matchingCount++;
    });

    return Math.min(1.0, matchingCount / Math.max(1, cookiesBefore.size));
  }

  private analyzeTokenDependency(req1: HarEntry, req2: HarEntry): number {
    const tokensInReq1 = new Set<string>();

    // Extract tokens from response
    if (req1.response.content?.text) {
      // Look for common token patterns
      const tokenPatterns = [
        /csrf[_-]?token/i,
        /session[_-]?id/i,
        /jwt/i,
        /access[_-]?token/i,
        /refresh[_-]?token/i
      ];

      tokenPatterns.forEach((pattern) => {
        const matches = req1.response.content!.text!.match(
          new RegExp(pattern.source, 'gi')
        );
        if (matches) {
          matches.forEach((match) => tokensInReq1.add(match));
        }
      });
    }

    // Check if tokens appear in req2
    let foundCount = 0;
    const searchAreas = [
      req2.request.url,
      req2.request.postData?.text || '',
      ...req2.request.headers.map((h) => h.value)
    ].join(' ');

    tokensInReq1.forEach((token) => {
      if (searchAreas.includes(token)) foundCount++;
    });

    return Math.min(1.0, foundCount / Math.max(1, tokensInReq1.size));
  }

  private analyzeTemporalProximity(
    req1: HarEntry,
    req2: HarEntry
  ): number {
    const time1 = new Date(req1.startedDateTime).getTime();
    const time2 = new Date(req2.startedDateTime).getTime();
    const diffMs = Math.abs(time2 - time1);

    // If requests are within 1 second of each other, high correlation
    if (diffMs < 1000) return 1.0;

    // Linear decay up to 10 seconds
    if (diffMs < 10000) return 1.0 - diffMs / 10000;

    // Beyond 10 seconds, low correlation
    return 0.1;
  }

  private analyzeUrlPathSimilarity(url1: string, url2: string): number {
    try {
      const path1 = new URL(url1).pathname.split('/').filter((p) => p);
      const path2 = new URL(url2).pathname.split('/').filter((p) => p);

      // Calculate Levenshtein distance or similar
      let commonSegments = 0;
      for (let i = 0; i < Math.min(path1.length, path2.length); i++) {
        if (path1[i] === path2[i]) commonSegments++;
      }

      return commonSegments / Math.max(path1.length, path2.length);
    } catch (e) {
      return 0;
    }
  }

  private calculatePathSimilarity(path1: string, path2: string): number {
    const segments1 = path1.split('/').filter((p) => p);
    const segments2 = path2.split('/').filter((p) => p);
    const set1 = new Set(segments1);
    const intersection = new Set(segments2.filter((p) => set1.has(p)));
    const union = new Set([...segments1, ...segments2]);
    return intersection.size / union.size;
  }

  private identifyCriticalPath(
    correlationMatrix: number[][],
    entries: HarEntry[]
  ): number[] {
    const criticalPath: number[] = [];
    const visited = new Set<number>();

    // Start with authentication requests
    const authIndices = entries
      .map((e, i) => ({ index: i, score: this.calculateAuthRelevance(e) }))
      .filter((item) => item.score > 0.5)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.index);

    if (authIndices.length === 0) {
      // Fallback: use first request as starting point
      criticalPath.push(0);
      visited.add(0);
    } else {
      // Start with highest auth relevance
      criticalPath.push(authIndices[0]);
      visited.add(authIndices[0]);
    }

    // Build path using correlation matrix
    let current = criticalPath[0];
    while (criticalPath.length < Math.min(20, entries.length)) {
      let nextIndex = -1;
      let maxCorrelation = StreamingHarParser.CORRELATION_MATRIX_THRESHOLD;

      for (let i = 0; i < entries.length; i++) {
        if (visited.has(i) || i === current) continue;

        if (correlationMatrix[current][i] > maxCorrelation) {
          maxCorrelation = correlationMatrix[current][i];
          nextIndex = i;
        }
      }

      if (nextIndex === -1) break;

      criticalPath.push(nextIndex);
      visited.add(nextIndex);
      current = nextIndex;
    }

    return criticalPath;
  }

  private calculateAuthRelevance(entry: HarEntry): number {
    let score = 0;

    // Check URL
    if (/\/(login|signin|auth|token|session)/i.test(entry.request.url))
      score += 0.4;

    // Check method
    if (
      entry.request.method === 'POST' &&
      /\/(login|signin|auth|token)/i.test(entry.request.url)
    )
      score += 0.3;

    // Check response
    if (
      entry.response.status === 200 &&
      /session|auth|token/i.test(entry.response.content?.text || '')
    )
      score += 0.3;

    return Math.min(1.0, score);
  }

  private identifyRedundantRequests(
    correlationMatrix: number[][],
    criticalPath: number[]
  ): number[] {
    const redundant: number[] = [];
    const criticalSet = new Set(criticalPath);

    for (let i = 0; i < correlationMatrix.length; i++) {
      if (criticalSet.has(i)) continue;

      let isRedundant = true;
      for (const criticalIndex of criticalPath) {
        if (
          correlationMatrix[i][criticalIndex] <
          StreamingHarParser.CORRELATION_MATRIX_THRESHOLD
        ) {
          isRedundant = false;
          break;
        }
      }

      if (isRedundant) redundant.push(i);
    }

    return redundant;
  }

  // Abort ongoing parsing
  abort(): void {
    this.abortController.abort();
    this.emit('abort');
  }

  // Get current statistics
  getStatistics(): ParseStatistics {
    return { ...this.statistics };
  }

  private validateAndParseHar(harContent: string): Har {
    if (!harContent || typeof harContent !== 'string') {
      throw new Error('HAR content must be a non-empty string');
    }
    let har: Har;
    try {
      har = JSON.parse(harContent);
    } catch (error) {
      throw new Error(`Invalid JSON in HAR file: ${(error as Error).message}`);
    }
    // Validate HAR structure
    if (!har || typeof har !== 'object') {
      throw new Error('HAR file must contain a valid JSON object');
    }
    if (!har.log) {
      throw new Error('HAR file must contain a "log" property');
    }
    if (!Array.isArray(har.log.entries)) {
      throw new Error('HAR log must contain an "entries" array');
    }
    // Validate HAR version
    if (har.log.version) {
      const version = har.log.version;
      if (!['1.1', '1.2'].includes(version)) {
        this.emit(
          'warning',
          `HAR version ${version} may not be fully supported`
        );
      }
    }
    return har;
  }

  private async *createJsonStream(
    harContent: string
  ): AsyncGenerator<HarEntry> {
    const har = this.validateAndParseHar(harContent);
    const entries = har.log.entries;
    let processedBytes = 0;
    const totalBytes = harContent.length;

    for (let i = 0; i < entries.length; i++) {
      if (this.abortController.signal.aborted) {
        break;
      }
      // Estimate progress
      processedBytes = Math.floor((i / entries.length) * totalBytes);
      if (i % 10 === 0) {
        this.emitProgress(i, entries.length, processedBytes, totalBytes);
      }
      try {
        const processedEntry = this.processEntry(entries[i], i);
        if (processedEntry) {
          yield processedEntry;
          this.statistics.validEntries++;
        } else {
          this.statistics.skippedEntries++;
        }
      } catch (error) {
        this.handleEntryError(error as Error, i, entries[i]);
      }
      // Allow event loop to process other tasks
      if (i % 100 === 0) {
        await this.delay(0);
      }
    }
  }

  private processEntry(rawEntry: Record<string, unknown>, index: number): HarEntry | null {
    try {
      // Validate entry structure
      if (!this.isValidEntry(rawEntry)) {
        this.emit('warning', `Invalid entry at index ${index}`);
        return null;
      }
      // Check entry size
      const entrySize = JSON.stringify(rawEntry).length;
      if (entrySize > this.options.maxEntrySize) {
        this.emit(
          'warning',
          `Entry at index ${index} exceeds size limit (${entrySize} bytes)`
        );
        return null;
      }
      // Update statistics
      this.statistics.totalEntries++;
      this.statistics.largestEntry = Math.max(
        this.statistics.largestEntry,
        entrySize
      );
      this.statistics.averageEntrySize =
        (this.statistics.averageEntrySize *
          (this.statistics.totalEntries - 1) +
          entrySize) /
        this.statistics.totalEntries;
      // Process request
      const request = this.processRequest(rawEntry.request as Record<string, unknown>);
      // Process response
      const response = this.processResponse(rawEntry.response as Record<string, unknown>);
      // Check if we should skip large responses
      if (
        this.options.skipLargeResponses &&
        response.content.size > this.options.largeResponseThreshold
      ) {
        response.content.text = '[Content truncated due to size]';
      }
      // Create processed entry
      const entry: HarEntry = {
        startedDateTime: rawEntry.startedDateTime as string,
        time: rawEntry.time as number || 0,
        request,
        response,
        cache: this.options.includeCache ? rawEntry.cache as Record<string, unknown> : {},
        timings: this.options.includeTiming ? rawEntry.timings as Record<string, unknown> : {},
        serverIPAddress: rawEntry.serverIPAddress as string,
        connection: rawEntry.connection as string,
        comment: rawEntry.comment as string
      };

      // Attach extracted parameters
      entry.parameters = ParameterExtractionService.extract(entry);

      return entry;
    } catch (error) {
      throw new Error(
        `Failed to process entry at index ${index}: ${(error as Error).message}`
      );
    }
  }

  private processRequest(rawRequest: Record<string, unknown>): HarEntry['request'] {
    return {
      method: (rawRequest.method as string) || 'GET',
      url: (rawRequest.url as string) || '',
      httpVersion: (rawRequest.httpVersion as string) || 'HTTP/1.1',
      headers: this.processHeaders(rawRequest.headers as Record<string, unknown>[]),
      queryString: (rawRequest.queryString as { name: string, value: string }[]) || [],
      cookies: this.processCookies(rawRequest.cookies as Record<string, unknown>[]) as HarCookie[],
      headersSize: (rawRequest.headersSize as number) || -1,
      bodySize: (rawRequest.bodySize as number) || -1,
      postData: rawRequest.postData
        ? this.processPostData(rawRequest.postData as Record<string, unknown>)
        : undefined
    };
  }

  private processResponse(rawResponse: Record<string, unknown>): HarEntry['response'] {
    return {
      status: (rawResponse.status as number) || 0,
      statusText: (rawResponse.statusText as string) || '',
      httpVersion: (rawResponse.httpVersion as string) || 'HTTP/1.1',
      headers: this.processHeaders(rawResponse.headers as Record<string, unknown>[]),
      cookies: this.processCookies(rawResponse.cookies as Record<string, unknown>[]),
      content: this.processContent(rawResponse.content as Record<string, unknown>),
      redirectURL: (rawResponse.redirectURL as string) || '',
      headersSize: (rawResponse.headersSize as number) || -1,
      bodySize: (rawResponse.bodySize as number) || -1
    };
  }

  private processHeaders(rawHeaders: Record<string, unknown>[]): { name: string, value: string }[] {
    if (!Array.isArray(rawHeaders)) return [];
    return rawHeaders
      .filter((h) => h && typeof h === 'object' && h.name && h.value !== undefined)
      .map((h) => ({
        name: String(h.name),
        value: String(h.value)
      }));
  }

  private processCookies(rawCookies: Record<string, unknown>[]): HarCookie[] {
    if (!Array.isArray(rawCookies)) return [];
    return rawCookies
      .filter((c) => c && typeof c === 'object' && c.name)
      .map((c) => ({
        name: String(c.name),
        value: String(c.value || ''),
        path: c.path as string,
        domain: c.domain as string,
        expires: c.expires as string,
        httpOnly: Boolean(c.httpOnly),
        secure: Boolean(c.secure),
        sameSite: c.sameSite as string
      } as HarCookie));
  }

  private processPostData(rawPostData: Record<string, unknown>): HarEntry['request']['postData'] {
    const mimeType = (rawPostData.mimeType as string) || 'application/octet-stream';
    const text = rawPostData.text as string;
    let params = Array.isArray(rawPostData.params) ? rawPostData.params as { name: string, value: string }[] : undefined;

    // x-www-form-urlencoded: build params from text if missing/empty
    if (
      mimeType.includes('application/x-www-form-urlencoded') &&
      (!params || params.length === 0) &&
      text
    ) {
      try {
        const searchParams = new URLSearchParams(text);
        params = [];
        searchParams.forEach((value, name) => {
          params!.push({ name, value });
        });
      } catch (e) {
        // ignore errors
      }
    }

    // application/json: flatten and build params if missing/empty
    if (
      mimeType.includes('application/json') &&
      (!params || params.length === 0) &&
      text
    ) {
      try {
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === 'object') {
          // Flatten 1-level deep, stringifying non-primitives
          const flatten = (obj: Record<string, unknown>, prefix = ''): Record<string, string> => {
            const result: Record<string, string> = {};
            for (const [key, value] of Object.entries(obj)) {
              const flatKey = prefix ? `${prefix}.${key}` : key;
              if (typeof value === 'object' && value !== null) {
                result[flatKey] = JSON.stringify(value);
              } else {
                result[flatKey] = String(value);
              }
            }
            return result;
          };
          const flat = flatten(parsed);
          params = Object.entries(flat).map(([name, value]) => ({ name, value }));
        }
      } catch (e) {
        // ignore errors
      }
    }

    return {
      mimeType,
      text,
      params
    };
  }

  private processContent(rawContent: Record<string, unknown>): HarEntry['response']['content'] {
    if (!rawContent || typeof rawContent !== 'object') {
      return {
        size: 0,
        mimeType: 'application/octet-stream'
      };
    }
    return {
      size: (rawContent.size as number) || 0,
      compression: rawContent.compression as number,
      mimeType: (rawContent.mimeType as string) || 'application/octet-stream',
      text: rawContent.text as string,
      encoding: rawContent.encoding as string
    };
  }

  private isValidEntry(entry: Record<string, unknown>): boolean {
    if (!entry || typeof entry !== 'object') return false;
    if (!entry.request || typeof entry.request !== 'object') return false;
    if (!entry.response || typeof entry.response !== 'object') return false;
    if (!(entry.request as Record<string, unknown>).url || typeof (entry.request as Record<string, unknown>).url !== 'string') return false;
    if (!entry.startedDateTime) return false;
    if (this.options.validateEntries) {
      // Additional validation
      if (!(entry.request as Record<string, unknown>).method || typeof (entry.request as Record<string, unknown>).method !== 'string')
        return false;
      if (typeof (entry.response as Record<string, unknown>).status !== 'number') return false;
      if (!Array.isArray((entry.request as Record<string, unknown>).headers)) return false;
      if (!Array.isArray((entry.response as Record<string, unknown>).headers)) return false;
    }
    return true;
  }

  private handleEntryError(error: Error, index: number, rawEntry: Record<string, unknown>): void {
    this.statistics.parseErrors++;
    const parseError: ParseError = {
      message: error.message || 'Unknown error',
      position: index,
      entry: rawEntry
        ? {
            startedDateTime: rawEntry.startedDateTime as string,
            request: {
              url: (rawEntry.request as Record<string, unknown>)?.url as string,
              method: (rawEntry.request as Record<string, unknown>)?.method as string
            }
          }
        : undefined,
      phase: 'processing'
    };
    this.emit('entryError', parseError);
  }

  private emitProgress(
    current: number,
    total: number,
    bytesProcessed: number,
    totalBytes: number
  ): void {
    const progress: ParseProgress = {
      bytesProcessed,
      totalBytes,
      entriesParsed: this.statistics.validEntries,
      entriesSkipped: this.statistics.skippedEntries,
      currentBatch: Math.floor(current / this.options.batchSize),
      estimatedTotal: total,
      percentComplete: Math.round((current / total) * 100)
    };
    this.emit('progress', progress);
  }

  private finalizeStatistics(): void {
    this.statistics.processingTimeMs = performance.now() - this.parseStartTime;
    // this.statistics.memoryUsed = process.memoryUsage?.().heapUsed || 0;
  }

  private createParseError(
    error: Error,
    position: number,
    phase: ParseError['phase']
  ): ParseError {
    return {
      message: error.message || 'Unknown parse error',
      position,
      phase
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Specialized parser for very large HAR files
export class LargeFileHarParser extends StreamingHarParser {
  private static readonly CHUNK_SIZE = 1024 * 1024; // 1MB chunks

  async *parseFileInChunks(
    fileReader: AsyncIterable<string>
  ): AsyncGenerator<HarEntry[]> {
    let buffer = '';
    let inEntries = false;
    let depth = 0;
    let entryStart = -1;
    const batch: HarEntry[] = [];

    for await (const chunk of fileReader) {
      buffer += chunk;
      // Look for entries array
      if (!inEntries) {
        const entriesMatch = buffer.match(/"entries"\s*:\s*\[/);
        if (entriesMatch) {
          inEntries = true;
          buffer = buffer.substring(
            entriesMatch.index! + entriesMatch[0].length
          );
        } else {
          // Keep last part of buffer for next iteration
          buffer = buffer.slice(-100);
          continue;
        }
      }

      // Parse entries from buffer
      let i = 0;
      while (i < buffer.length) {
        const char = buffer[i];
        if (char === '{' && depth === 0) {
          entryStart = i;
        }
        if (char === '{') depth++;
        else if (char === '}') depth--;
        if (char === '}' && depth === 0 && entryStart !== -1) {
          // Found complete entry
          const entryJson = buffer.substring(entryStart, i + 1);
          try {
            const rawEntry = JSON.parse(entryJson);
            const entry = this.processEntry(rawEntry, batch.length);
            if (entry) {
              batch.push(entry);
              this.emit('entry', entry);
              if (batch.length >= this.options.batchSize) {
                yield [...batch];
                batch.length = 0;
              }
            }
          } catch (error) {
            this.emit('warning', `Failed to parse entry: ${(error as Error).message}`);
          }
          entryStart = -1;
        }
        if (char === ']' && depth === 0) {
          // End of entries array
          inEntries = false;
          break;
        }
        i++;
      }
      // Keep unparsed part for next iteration
      if (entryStart !== -1) {
        buffer = buffer.substring(entryStart);
      } else {
        buffer = buffer.substring(i);
      }
    }
    // Yield remaining entries
    if (batch.length > 0) {
      yield batch;
    }
  }
}

// Helper function to create a parser with specific options
export function createHarParser(options?: ParserOptions): StreamingHarParser {
  return new StreamingHarParser(options);
}
