import { SemanticHarEntry, TokenInstance, TokenCandidate } from './types';
import { TokenClassification } from './TokenDetectionService';
import { TokenLocation } from './types';

/**
 * Smart Token Detector - No ML Required
 * Detects tokens through pattern analysis and usage tracking
 */
export class SmartTokenDetector {
  private readonly MIN_ENTROPY_THRESHOLD = 3.5;
  private readonly MIN_TOKEN_LENGTH = 20;

  detectTokens(entries: SemanticHarEntry[]): TokenInstance[] {
    const tokens: TokenInstance[] = [];

    entries.forEach((entry, index) => {
      // Check request headers
      if (entry.request.headers) {
        entry.request.headers.forEach((header) => {
          if (this.isHighEntropyString(header.value) && this.isReusedInLaterRequests(header.value, entries, index)) {
            tokens.push({
              name: header.name,
              value: header.value,
              type: TokenClassification.SMART,
              location: TokenLocation.HEADER,
              confidence: this.calculateConfidence(header.value, entries, index),
              meta: {
                extractionLayer: 'SmartDetector'
              },
              firstSeenIndex: index,
            });
          }
        });
      }

      // Check request body
      if (entry.request.postData?.text) {
        const bodyTokens = this.extractFromBody(entry.request.postData.text);
        bodyTokens.forEach(token => {
          if (this.isReusedInLaterRequests(token.value, entries, index)) {
            tokens.push({
              name: token.key,
              value: token.value,
              type: TokenClassification.SMART,
              location: TokenLocation.BODY,
              confidence: this.calculateConfidence(token.value, entries, index),
              meta: {
                extractionLayer: 'SmartDetector',
                jsonPath: token.location,
              },
              firstSeenIndex: index,
              key: token.key,
            });
          }
        });
      }

      // Check response body for tokens that will be used later
      if (entry.response.content?.text) {
        const responseTokens = this.extractFromBody(entry.response.content.text);
        responseTokens.forEach(token => {
          if (this.isUsedInLaterRequests(token.value, entries, index)) {
            tokens.push({
              name: token.key,
              value: token.value,
              type: TokenClassification.SMART,
              location: TokenLocation.RESPONSE,
              confidence: this.calculateConfidence(token.value, entries, index),
              meta: {
                extractionLayer: 'SmartDetector',
                jsonPath: token.location,
              },
              firstSeenIndex: index,
              isGenerated: true,
              key: token.key,
            });
          }
        });
      }
    });

    return this.deduplicateAndRank(tokens);
  }

  private isHighEntropyString(str: string): boolean {
    if (str.length < this.MIN_TOKEN_LENGTH) return false;
    const entropy = this.calculateEntropy(str);
    return entropy > this.MIN_ENTROPY_THRESHOLD;
  }

  private calculateEntropy(str: string): number {
    const freq: Record<string, number> = {};
    for (const char of str) {
      freq[char] = (freq[char] || 0) + 1;
    }

    let entropy = 0;
    const len = str.length;
    Object.values(freq).forEach(count => {
      const p = count / len;
      entropy -= p * Math.log2(p);
    });

    return entropy;
  }

  private isReusedInLaterRequests(
    value: string,
    entries: SemanticHarEntry[],
    afterIndex: number
  ): boolean {
      return this.isUsedInLaterRequests(value, entries, afterIndex);
  }

  private isUsedInLaterRequests(
    value: string,
    entries: SemanticHarEntry[],
    afterIndex: number
  ): boolean {
    for (let i = afterIndex + 1; i < entries.length; i++) {
      const entry = entries[i];
      const entryString = JSON.stringify(entry.request);
      if(entryString.includes(value)){
          return true;
      }
    }

    return false;
  }

  private calculateConfidence(value: string, entries: SemanticHarEntry[], index: number) : number {
      // very basic confidence calculation
      let confidence = 0.5;
      if(this.isHighEntropyString(value)) confidence += 0.2;
      if(this.hasTokenLikeStructure(value)) confidence += 0.2;
      if(this.isReusedInLaterRequests(value, entries, index)) confidence += 0.2;
      return Math.min(1.0, confidence);
  }

  private extractFromBody(body: string): TokenCandidate[] {
    const candidates: TokenCandidate[] = [];

    try {
      const json = JSON.parse(body);
      this.extractTokensFromJson(json, '', candidates);
    } catch {
      const patterns = [
        /"([^"]+)"\s*:\s*"([^"]+)"/g,  // JSON-like
        /(\w+)=([^&\s]+)/g,            // URL encoded
        /<(\w+)>([^<]+)<\/\1>/g        // XML-like
      ];

      patterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(body)) !== null) {
          const [, key, value] = match;
          if (this.looksLikeToken(key, value)) {
            candidates.push({
              type: 'body',
              location: `body.${key}`,
              value: value,
              key: key
            });
          }
        }
      });
    }

    return candidates;
  }

  private extractTokensFromJson(json: any, prefix: string, candidates: TokenCandidate[]): void {
      for(const key in json) {
          const value = json[key];
          const newPrefix = prefix ? `${prefix}.${key}` : key;
          if(typeof value === 'string' && this.looksLikeToken(key, value)) {
              candidates.push({
                  type: 'body',
                  location: `body.${newPrefix}`,
                  value: value,
                  key: key
              });
          } else if (typeof value === 'object' && value !== null) {
              this.extractTokensFromJson(value, newPrefix, candidates);
          }
      }
  }

  private looksLikeToken(key: string, value: string): boolean {
    const tokenKeywords = [
      'token', 'auth', 'session', 'jwt', 'bearer',
      'api', 'key', 'secret', 'credential', 'access',
      'refresh', 'csrf', 'xsrf', 'nonce'
    ];

    const keyLower = key.toLowerCase();
    const hasTokenKeyword = tokenKeywords.some(kw => keyLower.includes(kw));
    const hasHighEntropy = this.isHighEntropyString(value);
    const hasTokenStructure = this.hasTokenLikeStructure(value);

    return hasTokenKeyword || (hasHighEntropy && hasTokenStructure);
  }

  private hasTokenLikeStructure(value: string): boolean {
    if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) {
      return true;
    }
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
      return true;
    }
    if (/^[A-Za-z0-9+/]+=*$/.test(value) && value.length >= 32) {
      return true;
    }
    if (/^[0-9a-f]+$/i.test(value) && value.length >= 32) {
      return true;
    }
    return false;
  }

  private deduplicateAndRank(tokens: TokenInstance[]): TokenInstance[] {
      const uniqueTokens = new Map<string, TokenInstance>();
      for(const token of tokens) {
          if(!uniqueTokens.has(token.value) || uniqueTokens.get(token.value)!.confidence < token.confidence) {
              uniqueTokens.set(token.value, token);
          }
      }
      return Array.from(uniqueTokens.values()).sort((a, b) => b.confidence - a.confidence);
  }
}
