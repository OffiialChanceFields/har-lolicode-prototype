// src/token-extraction/TokenDetectionService.ts
import { HarEntry } from '../services/types';
import {
  TokenLocation,
  DetectedToken,
  TokenExtractionResult
} from './types';

export enum TokenClassification {
  SMART = 'smart',
  CSRF_TOKEN = 'csrf_token',
  SESSION_TOKEN = 'session_token',
  JWT_ACCESS_TOKEN = 'jwt_access_token',
  JWT_REFRESH_TOKEN = 'jwt_refresh_token',
  OAUTH_STATE = 'oauth_state',
  OAUTH_CODE_VERIFIER = 'oauth_code_verifier',
  OAUTH_CODE_CHALLENGE = 'oauth_code_challenge',
  NONCE = 'nonce',
  VIEWSTATE = 'viewstate',
  EVENTVALIDATION = 'eventvalidation',
  CAPTCHA_TOKEN = 'captcha_token',
  API_KEY = 'api_key',
  BEARER_TOKEN = 'bearer_token',
  CUSTOM_HEADER_TOKEN = 'custom_header_token',
  FORM_BUILD_ID = 'form_build_id',
  DRUPAL_FORM_TOKEN = 'drupal_form_token',
  LARAVEL_TOKEN = 'laravel_token',
  DJANGO_CSRF = 'django_csrf',
  RAILS_AUTHENTICITY = 'rails_authenticity'
}

export interface TokenPattern {
  type: TokenClassification;
  pattern: RegExp;
  location: TokenLocation;
  confidenceWeight: number;
}

class PatternRecognitionEngine {
  private readonly tokenPatterns: TokenPattern[] = [
    // CSRF tokens
    {
      type: TokenClassification.CSRF_TOKEN,
      pattern: /csrf[_-]?token/i,
      location: TokenLocation.ANY,
      confidenceWeight: 0.9
    },
    {
      type: TokenClassification.CSRF_TOKEN,
      pattern: /x[_-]?csrf[_-]?token/i,
      location: TokenLocation.ANY,
      confidenceWeight: 0.9
    },
    {
      type: TokenClassification.CSRF_TOKEN,
      pattern: /authenticity[_-]?token/i,
      location: TokenLocation.ANY,
      confidenceWeight: 0.9
    },
    {
      type: TokenClassification.CSRF_TOKEN,
      pattern: /_csrf/i,
      location: TokenLocation.ANY,
      confidenceWeight: 0.85
    },
    {
      type: TokenClassification.CSRF_TOKEN,
      pattern: /csrfmiddlewaretoken/i,
      location: TokenLocation.ANY,
      confidenceWeight: 0.9
    },
    {
      type: TokenClassification.CSRF_TOKEN,
      pattern: /x[_-]?xsrf[_-]?token/i,
      location: TokenLocation.ANY,
      confidenceWeight: 0.9
    },

    // Session tokens
    {
      type: TokenClassification.SESSION_TOKEN,
      pattern: /session[_-]?id/i,
      location: TokenLocation.ANY,
      confidenceWeight: 0.85
    },
    {
      type: TokenClassification.SESSION_TOKEN,
      pattern: /sess[_-]?id/i,
      location: TokenLocation.ANY,
      confidenceWeight: 0.85
    },
    {
      type: TokenClassification.SESSION_TOKEN,
      pattern: /phpsessid/i,
      location: TokenLocation.ANY,
      confidenceWeight: 0.85
    },
    {
      type: TokenClassification.SESSION_TOKEN,
      pattern: /jsessionid/i,
      location: TokenLocation.ANY,
      confidenceWeight: 0.85
    },
    {
      type: TokenClassification.SESSION_TOKEN,
      pattern: /aspsessionid/i,
      location: TokenLocation.ANY,
      confidenceWeight: 0.85
    },
    {
      type: TokenClassification.SESSION_TOKEN,
      pattern: /asp\.net[_-]?sessionid/i,
      location: TokenLocation.ANY,
      confidenceWeight: 0.85
    },
    {
      type: TokenClassification.SESSION_TOKEN,
      pattern: /sid/i,
      location: TokenLocation.ANY,
      confidenceWeight: 0.75
    },
    {
      type: TokenClassification.SESSION_TOKEN,
      pattern: /connect\.sid/i,
      location: TokenLocation.ANY,
      confidenceWeight: 0.8
    },

    // JWT tokens
    {
      type: TokenClassification.JWT_ACCESS_TOKEN,
      pattern: /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/,
      location: TokenLocation.ANY,
      confidenceWeight: 0.95
    },
    {
      type: TokenClassification.JWT_ACCESS_TOKEN,
      pattern: /jwt/i,
      location: TokenLocation.ANY,
      confidenceWeight: 0.8
    },
    {
      type: TokenClassification.JWT_ACCESS_TOKEN,
      pattern: /id[_-]?token/i,
      location: TokenLocation.ANY,
      confidenceWeight: 0.85
    },
    {
      type: TokenClassification.JWT_ACCESS_TOKEN,
      pattern: /access[_-]?token/i,
      location: TokenLocation.ANY,
      confidenceWeight: 0.85
    },
    {
      type: TokenClassification.JWT_REFRESH_TOKEN,
      pattern: /refresh[_-]?token/i,
      location: TokenLocation.ANY,
      confidenceWeight: 0.85
    },

    // API keys
    {
      type: TokenClassification.API_KEY,
      pattern: /api[_-]?key/i,
      location: TokenLocation.ANY,
      confidenceWeight: 0.8
    },
    {
      type: TokenClassification.API_KEY,
      pattern: /apikey/i,
      location: TokenLocation.ANY,
      confidenceWeight: 0.8
    },
    {
      type: TokenClassification.API_KEY,
      pattern: /x[_-]?api[_-]?key/i,
      location: TokenLocation.ANY,
      confidenceWeight: 0.85
    },
    {
      type: TokenClassification.API_KEY,
      pattern: /api[_-]?token/i,
      location: TokenLocation.ANY,
      confidenceWeight: 0.8
    },
    {
      type: TokenClassification.API_KEY,
      pattern: /client[_-]?id/i,
      location: TokenLocation.ANY,
      confidenceWeight: 0.75
    },
    {
      type: TokenClassification.API_KEY,
      pattern: /client[_-]?secret/i,
      location: TokenLocation.ANY,
      confidenceWeight: 0.75
    },

    // Bearer tokens
    {
      type: TokenClassification.BEARER_TOKEN,
      pattern: /bearer\s+[\w-]+/i,
      location: TokenLocation.ANY,
      confidenceWeight: 0.85
    },
    {
      type: TokenClassification.BEARER_TOKEN,
      pattern: /authorization:\s*bearer/i,
      location: TokenLocation.ANY,
      confidenceWeight: 0.9
    },

    // OAuth tokens
    {
      type: TokenClassification.OAUTH_STATE,
      pattern: /oauth[_-]?token/i,
      location: TokenLocation.ANY,
      confidenceWeight: 0.8
    },
    {
      type: TokenClassification.OAUTH_STATE,
      pattern: /access[_-]?token/i,
      location: TokenLocation.ANY,
      confidenceWeight: 0.85
    },
    {
      type: TokenClassification.OAUTH_STATE,
      pattern: /refresh[_-]?token/i,
      location: TokenLocation.ANY,
      confidenceWeight: 0.85
    },
    {
      type: TokenClassification.OAUTH_CODE_VERIFIER,
      pattern: /code[_-]?verifier/i,
      location: TokenLocation.ANY,
      confidenceWeight: 0.8
    },
    {
      type: TokenClassification.OAUTH_CODE_CHALLENGE,
      pattern: /code[_-]?challenge/i,
      location: TokenLocation.ANY,
      confidenceWeight: 0.8
    },
    {
      type: TokenClassification.OAUTH_STATE,
      pattern: /state/i,
      location: TokenLocation.ANY,
      confidenceWeight: 0.75
    },
    {
      type: TokenClassification.OAUTH_STATE,
      pattern: /oauth[_-]?state/i,
      location: TokenLocation.ANY,
      confidenceWeight: 0.8
    },

    // Nonce tokens
    {
      type: TokenClassification.NONCE,
      pattern: /nonce/i,
      location: TokenLocation.ANY,
      confidenceWeight: 0.75
    },
    {
      type: TokenClassification.NONCE,
      pattern: /wp[_-]?nonce/i,
      location: TokenLocation.ANY,
      confidenceWeight: 0.8
    },

    // Viewstate tokens
    {
      type: TokenClassification.VIEWSTATE,
      pattern: /__VIEWSTATE/i,
      location: TokenLocation.ANY,
      confidenceWeight: 0.85
    },
    {
      type: TokenClassification.EVENTVALIDATION,
      pattern: /__EVENTVALIDATION/i,
      location: TokenLocation.ANY,
      confidenceWeight: 0.85
    },

    // Form build ID
    {
      type: TokenClassification.FORM_BUILD_ID,
      pattern: /form_build_id/i,
      location: TokenLocation.ANY,
      confidenceWeight: 0.8
    },

    // Framework-specific tokens
    {
      type: TokenClassification.DRUPAL_FORM_TOKEN,
      pattern: /form_token/i,
      location: TokenLocation.ANY,
      confidenceWeight: 0.85
    },
    {
      type: TokenClassification.LARAVEL_TOKEN,
      pattern: /_token/i,
      location: TokenLocation.ANY,
      confidenceWeight: 0.85
    },
    {
      type: TokenClassification.DJANGO_CSRF,
      pattern: /csrfmiddlewaretoken/i,
      location: TokenLocation.ANY,
      confidenceWeight: 0.9
    },
    {
      type: TokenClassification.RAILS_AUTHENTICITY,
      pattern: /authenticity_token/i,
      location: TokenLocation.ANY,
      confidenceWeight: 0.9
    }
  ];

  determineTokenType(
    name: string,
    value: string
  ): TokenClassification | null {
    // First check name
    for (const pattern of this.tokenPatterns) {
      if (pattern.pattern.test(name)) {
        return pattern.type;
      }
    }

    // Then check value
    for (const pattern of this.tokenPatterns) {
      if (pattern.pattern.test(value)) {
        return pattern.type;
      }
    }

    // Special case for JWT
    if (/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(value)) {
      return TokenClassification.JWT_ACCESS_TOKEN;
    }

    return null;
  }

  determineTokenTypeFromPattern(
    patternType: TokenClassification,
    value: string
  ): TokenClassification | null {
    // Special handling for JWT pattern
    if (
      patternType === TokenClassification.JWT_ACCESS_TOKEN &&
      /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(value)
    ) {
      return TokenClassification.JWT_ACCESS_TOKEN;
    }

    return patternType;
  }

  getTokenPatterns(): TokenPattern[] {
    return this.tokenPatterns;
  }
}

class ContextualTokenValidator {
  validateToken(token: DetectedToken, entry: HarEntry): number {
    let confidence = token.confidence;

    // Check if token is used in subsequent requests
    const isUsedLater = this.isTokenUsedInLaterRequests(token, entry);
    if (isUsedLater) {
      confidence = Math.min(1.0, confidence * 1.1);
    }

    // Check token format
    const formatValid = this.validateTokenFormat(token);
    if (!formatValid) {
      confidence *= 0.8;
    }

    // Check if token appears in sensitive contexts
    const isSensitiveContext = this.isInSensitiveContext(token, entry);
    if (isSensitiveContext) {
      confidence = Math.min(1.0, confidence * 1.05);
    }

    return Math.max(0.3, confidence);
  }

  private isTokenUsedInLaterRequests(
    token: DetectedToken,
    entry: HarEntry
  ): boolean {
    // In a real implementation, this would check the entire request sequence
    // For now, we'll just check if it appears in the current request's URL or body
    const entryContext = [
      entry.request.url,
      entry.request.postData?.text || '',
      ...entry.request.headers.map((h) => h.value)
    ].join('\n');

    return entryContext.includes(token.value);
  }

  private validateTokenFormat(token: DetectedToken): boolean {
    switch (token.type) {
      case TokenClassification.JWT_ACCESS_TOKEN:
        return /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(
          token.value
        );
      case TokenClassification.SESSION_TOKEN:
        return token.value.length >= 16;
      case TokenClassification.API_KEY:
        return token.value.length >= 20;
      default:
        return true; // No specific format validation for other token types
    }
  }

  private isInSensitiveContext(token: DetectedToken, entry: HarEntry): boolean {
    // Check if the request is part of an authentication flow
    return /\/(login|signin|auth|token)/i.test(entry.request.url);
  }
}

class CrossReferenceAnalyzer {
  analyzeCrossReferences(tokens: DetectedToken[]): DetectedToken[] {
    // Group tokens by value
    const tokensByValue = new Map<string, DetectedToken[]>();

    tokens.forEach((token) => {
      if (!tokensByValue.has(token.value)) {
        tokensByValue.set(token.value, []);
      }
      tokensByValue.get(token.value)!.push(token);
    });

    // For each group of tokens with the same value, determine the most appropriate type
    const results: DetectedToken[] = [];

    tokensByValue.forEach((tokenGroup) => {
      if (tokenGroup.length === 1) {
        results.push(tokenGroup[0]);
        return;
      }

      // Determine the most specific token type
      const mostSpecificToken = this.findMostSpecificToken(tokenGroup);

      // Update confidence based on cross-references
      const enhancedConfidence = Math.min(
        1.0,
        mostSpecificToken.confidence * 1.1
      );

      results.push({
        ...mostSpecificToken,
        confidence: enhancedConfidence,
        meta: {
          ...mostSpecificToken.meta,
          crossReferenceCount: tokenGroup.length,
          crossReferenceTypes: tokenGroup.map((t) => t.type)
        }
      });
    });

    return results;
  }

  private findMostSpecificToken(tokens: DetectedToken[]): DetectedToken {
    // Sort by specificity (this is a simplified version)
    const specificityOrder = [
      TokenClassification.CSRF_TOKEN,
      TokenClassification.JWT_ACCESS_TOKEN,
      TokenClassification.SESSION_TOKEN,
      TokenClassification.API_KEY,
      TokenClassification.BEARER_TOKEN,
      TokenClassification.OAUTH_STATE,
      TokenClassification.NONCE
    ];

    return tokens.sort((a, b) => {
      const aIndex = specificityOrder.indexOf(a.type);
      const bIndex = specificityOrder.indexOf(b.type);

      if (aIndex === -1 && bIndex === -1) return 0;
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;

      return aIndex - bIndex;
    })[0];
  }
}

export class TokenDetectionService {
  private readonly patternRecognitionEngine: PatternRecognitionEngine;
  private readonly contextualValidator: ContextualTokenValidator;
  private readonly crossReferenceAnalyzer: CrossReferenceAnalyzer;

  constructor() {
    this.patternRecognitionEngine = new PatternRecognitionEngine();
    this.contextualValidator = new ContextualTokenValidator();
    this.crossReferenceAnalyzer = new CrossReferenceAnalyzer();
  }

  detectTokensWithContext(
    entry: HarEntry,
    responseBody: string
  ): TokenExtractionResult {
    // Multi-layer extraction strategy
    const candidateTokens = this.performMultiLayerExtraction(
      entry,
      responseBody
    );

    // Contextual validation
    const validatedTokens = this.validateTokensInContext(
      candidateTokens,
      entry
    );

    // Cross-reference analysis
    const crossReferencedTokens =
      this.performCrossReferenceAnalysis(validatedTokens);

    // Calculate overall confidence
    const confidence = this.calculateOverallConfidence(crossReferencedTokens);

    return {
      tokens: crossReferencedTokens,
      confidence,
      meta: {
        extractionLayers: this.getExtractionLayersUsed(entry),
        validationResults: this.getTokenValidationResults(validatedTokens),
        crossReferences: this.getCrossReferenceMap(crossReferencedTokens)
      }
    };
  }

  private performMultiLayerExtraction(
    entry: HarEntry,
    responseBody: string
  ): DetectedToken[] {
    const extractionLayers = [
      this.htmlFormTokenExtraction,
      this.jsonResponseExtraction,
      this.headerTokenExtraction,
      this.cookieTokenExtraction,
      this.scriptVariableExtraction,
      this.metaTagExtraction,
      this.regexPatternExtraction
    ];

    return extractionLayers.flatMap((layer) =>
      layer.call(this, entry, responseBody)
    );
  }

  private htmlFormTokenExtraction(
    entry: HarEntry,
    responseBody: string
  ): DetectedToken[] {
    const tokens: DetectedToken[] = [];

    if (responseBody && /<form/i.test(responseBody)) {
      // Look for hidden inputs
      const hiddenInputRegex = /<input[^>]*type=["']hidden["'][^>]*>/gi;
      const matches = responseBody.match(hiddenInputRegex) || [];

      matches.forEach((match) => {
        const nameMatch = match.match(/name=["']([^"']+)["']/);
        const valueMatch = match.match(/value=["']([^"']+)["']/);

        if (nameMatch && valueMatch) {
          const name = nameMatch[1];
          const value = valueMatch[1];

          // Check if it matches token patterns
          const tokenType = this.patternRecognitionEngine.determineTokenType(
            name,
            value
          );

          if (tokenType) {
            tokens.push({
              name,
              value,
              type: tokenType,
              location: TokenLocation.RESPONSE,
              confidence: 0.9,
              meta: {
                htmlElement: 'hidden_input',
                extractionLayer: 'htmlForm'
              }
            });
          }
        }
      });
    }

    return tokens;
  }

  private jsonResponseExtraction(
    entry: HarEntry,
    responseBody: string
  ): DetectedToken[] {
    const tokens: DetectedToken[] = [];

    if (
      responseBody &&
      entry.response.content?.mimeType.includes('application/json')
    ) {
      try {
        const data = JSON.parse(responseBody);
        const flatData = this.flattenObject(data);

        Object.entries(flatData).forEach(([key, value]) => {
          if (typeof value === 'string') {
            const tokenType =
              this.patternRecognitionEngine.determineTokenType(key, value);

            if (tokenType) {
              tokens.push({
                name: key,
                value: value,
                type: tokenType,
                location: TokenLocation.RESPONSE,
                confidence: 0.85,
                meta: {
                  jsonPath: key,
                  extractionLayer: 'jsonResponse'
                }
              });
            }
          }
        });
      } catch (e) {
        // Not valid JSON
      }
    }

    return tokens;
  }

  private headerTokenExtraction(
    entry: HarEntry,
    responseBody: string
  ): DetectedToken[] {
    const tokens: DetectedToken[] = [];
    const headers = [...entry.request.headers, ...entry.response.headers];

    headers.forEach((header) => {
      const tokenType = this.patternRecognitionEngine.determineTokenType(
        header.name,
        header.value
      );

      if (tokenType) {
        tokens.push({
          name: header.name,
          value: header.value,
          type: tokenType,
          location: TokenLocation.HEADER,
          confidence: 0.75,
          meta: {
            headerName: header.name,
            extractionLayer: 'header'
          }
        });
      }
    });

    return tokens;
  }

  private cookieTokenExtraction(
    entry: HarEntry,
    responseBody: string
  ): DetectedToken[] {
    const tokens: DetectedToken[] = [];
    const cookies = [...entry.request.cookies, ...entry.response.cookies];

    cookies.forEach((cookie) => {
      const tokenType = this.patternRecognitionEngine.determineTokenType(
        cookie.name,
        cookie.value
      );

      if (tokenType) {
        tokens.push({
          name: cookie.name,
          value: cookie.value,
          type: tokenType,
          location: TokenLocation.COOKIE,
          confidence: 0.8,
          meta: {
            domain: cookie.domain,
            path: cookie.path,
            secure: cookie.secure,
            httpOnly: cookie.httpOnly,
            extractionLayer: 'cookie'
          }
        });
      }
    });

    return tokens;
  }

  private scriptVariableExtraction(
    entry: HarEntry,
    responseBody: string
  ): DetectedToken[] {
    const tokens: DetectedToken[] = [];

    if (responseBody && /<script/i.test(responseBody)) {
      // Look for script variables
      const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
      let scriptMatch;

      while ((scriptMatch = scriptRegex.exec(responseBody)) !== null) {
        const scriptContent = scriptMatch[1];

        // Look for token assignments
        const tokenAssignRegex = /(\w+)\s*=\s*['"]([^'"]+)['"]/g;
        let tokenMatch;

        while ((tokenMatch = tokenAssignRegex.exec(scriptContent)) !== null) {
          const varName = tokenMatch[1];
          const varValue = tokenMatch[2];

          const tokenType =
            this.patternRecognitionEngine.determineTokenType(
              varName,
              varValue
            );

          if (tokenType) {
            tokens.push({
              name: varName,
              value: varValue,
              type: tokenType,
              location: TokenLocation.RESPONSE,
              confidence: 0.7,
              meta: {
                extractionLayer: 'scriptVariable',
                variableName: varName
              }
            });
          }
        }
      }
    }

    return tokens;
  }

  private metaTagExtraction(
    entry: HarEntry,
    responseBody: string
  ): DetectedToken[] {
    const tokens: DetectedToken[] = [];

    if (responseBody) {
      // Look for meta tags
      const metaRegex =
        /<meta[^>]*name=["']([^"']+)["'][^>]*content=["']([^"']+)["'][^>]*>/gi;
      let metaMatch;

      while ((metaMatch = metaRegex.exec(responseBody)) !== null) {
        const name = metaMatch[1];
        const value = metaMatch[2];

        const tokenType = this.patternRecognitionEngine.determineTokenType(
          name,
          value
        );

        if (tokenType) {
          tokens.push({
            name,
            value,
            type: tokenType,
            location: TokenLocation.RESPONSE,
            confidence: 0.65,
            meta: {
              htmlElement: 'meta_tag',
              extractionLayer: 'metaTag'
            }
          });
        }
      }
    }

    return tokens;
  }

  private regexPatternExtraction(
    entry: HarEntry,
    responseBody: string
  ): DetectedToken[] {
    const tokens: DetectedToken[] = [];
    const tokenPatterns = this.patternRecognitionEngine.getTokenPatterns();

    // Search in all relevant areas
    const searchAreas = [
      entry.request.url,
      entry.request.postData?.text || '',
      entry.response.content?.text || '',
      ...entry.request.headers.map((h) => `${h.name}: ${h.value}`),
      ...entry.response.headers.map((h) => `${h.name}: ${h.value}`)
    ].join('\n');

    tokenPatterns.forEach((pattern) => {
      const matches = searchAreas.match(new RegExp(pattern.pattern, 'gi'));

      if (matches) {
        matches.forEach((match) => {
          const tokenType =
            this.patternRecognitionEngine.determineTokenTypeFromPattern(
              pattern.type,
              match
            );

          if (tokenType) {
            tokens.push({
              name: pattern.type,
              value: match,
              type: tokenType,
              location: TokenLocation.BODY,
              confidence: pattern.confidenceWeight,
              meta: {
                pattern: pattern.pattern.toString(),
                extractionLayer: 'regex'
              }
            });
          }
        });
      }
    });

    return tokens;
  }

  private validateTokensInContext(
    tokens: DetectedToken[],
    entry: HarEntry
  ): DetectedToken[] {
    return tokens.map((token) => ({
      ...token,
      confidence: this.contextualValidator.validateToken(token, entry)
    }));
  }

  private performCrossReferenceAnalysis(
    tokens: DetectedToken[]
  ): DetectedToken[] {
    return this.crossReferenceAnalyzer.analyzeCrossReferences(tokens);
  }

  private calculateOverallConfidence(tokens: DetectedToken[]): number {
    if (tokens.length === 0) return 0;

    const totalConfidence = tokens.reduce(
      (sum, token) => sum + token.confidence,
      0
    );
    return totalConfidence / tokens.length;
  }

  private getExtractionLayersUsed(entry: HarEntry): string[] {
    const layers: string[] = [];

    if (
      entry.response.content?.text &&
      /<form/i.test(entry.response.content.text)
    ) {
      layers.push('htmlForm');
    }

    if (entry.response.content?.mimeType.includes('application/json')) {
      layers.push('jsonResponse');
    }

    if (entry.request.headers.length > 0 || entry.response.headers.length > 0) {
      layers.push('header');
    }

    if (entry.request.cookies.length > 0 || entry.response.cookies.length > 0) {
      layers.push('cookie');
    }

    if (
      entry.response.content?.text &&
      /<script/i.test(entry.response.content.text)
    ) {
      layers.push('scriptVariable');
    }

    if (entry.response.content?.text) {
      layers.push('metaTag');
    }

    layers.push('regex');

    return layers;
  }

  private getTokenValidationResults(
    tokens: DetectedToken[]
  ): Record<string, boolean> {
    return tokens.reduce((results, token) => {
      results[token.name] = token.confidence > 0.5;
      return results;
    }, {} as Record<string, boolean>);
  }

  private getCrossReferenceMap(
    tokens: DetectedToken[]
  ): Record<string, string[]> {
    const crossReferences: Record<string, string[]> = {};

    tokens.forEach((token) => {
      crossReferences[token.name] = tokens
        .filter((t) => t !== token && t.value === token.value)
        .map((t) => t.name);
    });

    return crossReferences;
  }

  private flattenObject(obj: unknown, prefix = ''): Record<string, unknown> {
    const flattened: Record<string, unknown> = {};
    if (obj && typeof obj === 'object') {
      Object.entries(obj).forEach(([key, value]) => {
        const newKey = prefix ? `${prefix}.${key}` : key;
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          Object.assign(flattened, this.flattenObject(value, newKey));
        } else if (Array.isArray(value)) {
          value.forEach((item, index) => {
            if (typeof item === 'object') {
              Object.assign(
                flattened,
                this.flattenObject(item, `${newKey}[${index}]`)
              );
            } else {
              flattened[`${newKey}[${index}]`] = item;
            }
          });
        } else {
          flattened[newKey] = value;
        }
      });
    }
    return flattened;
  }
}
