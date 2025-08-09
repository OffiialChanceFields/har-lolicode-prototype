
// Type definitions based on the context provided
export interface HarEntry {
  request: {
    method: string;
    url: string;
    headers: { name: string; value: string; }[];
    postData?: {
      text?: string;
    };
  };
  response: {
    headers: { name: string; value: string; }[];
    content: {
      text: string;
    };
  };
  startedDateTime: string;
}

export interface DetectedToken {
  name: string;
  value: string;
  extractionMethod: ExtractionMethod;
  confidence: number;
  metadata: {
    tokenType: string;
    framework: string;
    validationStrength: number;
  };
}

export interface ExtractionMethod {
  type: 'regex' | 'json' | 'header';
  pattern?: string;
  confidence: number;
}

export interface DetectionContext {
  sourceHTML: string;
  targetPayload: string;
  requestHeaders: { name: string; value: string; }[];
  responseHeaders: { name: string; value: string; }[];
  urlContext: URL;
  temporalDistance: number;
}

export interface TokenPattern {
    regex: RegExp;
    optimized: string;
    confidence: number;
    framework: string;
    validationStrength: number;
}

export interface TokenDetectionStrategy {
  detect(entry: HarEntry, context: DetectionContext): Promise<DetectedToken[]>;
  confidence: number;
  priority: number;
}

class CSRFTokenStrategy implements TokenDetectionStrategy {
  confidence = 0.9;
  priority = 1;

  async detect(entry: HarEntry, context: DetectionContext): Promise<DetectedToken[]> {
    const postParams = this.parsePostData(entry.request.postData?.text || '');
    const detectedTokens: DetectedToken[] = [];

    for (const [paramName, paramValue] of Object.entries(postParams)) {
      if (this.isCredentialField(paramName) || (paramValue as string).length < 8) continue;

      const patterns = this.generateContextualPatterns(paramName, paramValue as string, context);
      
      for (const pattern of patterns) {
        const match = context.sourceHTML.match(pattern.regex);
        if (match && match[1] === paramValue) {
          detectedTokens.push({
            name: paramName,
            value: paramValue as string,
            extractionMethod: {
              type: 'regex',
              pattern: pattern.optimized,
              confidence: pattern.confidence
            },
            confidence: this.calculateConfidence(pattern, context),
            metadata: {
              tokenType: 'csrf',
              framework: pattern.framework,
              validationStrength: pattern.validationStrength
            }
          });
          break;
        }
      }
    }

    return detectedTokens;
  }

  private isCredentialField(fieldName: string): boolean {
    const credentialKeywords = ['user', 'pass', 'login', 'email', 'pwd'];
    return credentialKeywords.some(kw => fieldName.toLowerCase().includes(kw));
  }
  
  private parsePostData(postData: string): { [key: string]: unknown } {
    try {
        return JSON.parse(postData);
    } catch (e) {
        const params = new URLSearchParams(postData);
        const result: { [key: string]: string } = {};
        for (const [key, value] of params.entries()) {
            result[key] = value;
        }
        return result;
    }
  }

  private generateContextualPatterns(
    tokenName: string,
    tokenValue: string,
    context: DetectionContext
  ): TokenPattern[] {
    const patterns: TokenPattern[] = [];
    
    const frameworkPatterns: {[key: string]: Omit<TokenPattern, 'optimized' | 'validationStrength'> & {regex: RegExp}} = {
      laravel: {
        regex: new RegExp(`name="_token"[^>]*value="([^"]+)"`),
        confidence: 0.95,
        framework: 'Laravel'
      },
      rails: {
        regex: new RegExp(`name="authenticity_token"[^>]*value="([^"]+)"`),
        confidence: 0.93,
        framework: 'Ruby on Rails'
      },
      django: {
        regex: new RegExp(`name="csrfmiddlewaretoken"[^>]*value="([^"]+)"`),
        confidence: 0.91,
        framework: 'Django'
      },
      aspnet: {
        regex: new RegExp(`name="__RequestVerificationToken"[^>]*value="([^"]+)"`),
        confidence: 0.89,
        framework: 'ASP.NET'
      }
    };

    patterns.push({
      regex: new RegExp(`name="${this.escapeRegex(tokenName)}"[^>]*value="([^"]+)"`),
      optimized: `name="${tokenName}"[^>]*value="([a-zA-Z0-9\\-_./+=]+)"`,
      confidence: 0.85,
      framework: 'Generic',
      validationStrength: this.assessTokenStrength(tokenValue)
    });
    
    return [...Object.values(frameworkPatterns).map(p => ({...p, optimized: '', validationStrength: 0})), ...patterns];
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private calculateConfidence(pattern: TokenPattern, context: DetectionContext): number {
    let confidence = pattern.confidence;
    if (context.temporalDistance < 5000) { // 5 seconds
        confidence += 0.05;
    }
    return Math.min(confidence, 1.0);
  }

  private assessTokenStrength(token: string): number {
      let strength = 0;
      if (token.length > 32) strength += 0.2;
      if (/[A-Z]/.test(token) && /[a-z]/.test(token)) strength += 0.1;
      if (/\d/.test(token)) strength += 0.1;
      if (/[^A-Za-z0-9]/.test(token)) strength += 0.1;
      return Math.min(strength, 1.0);
  }
}

class StateTokenStrategy implements TokenDetectionStrategy {
    confidence = 0.85;
    priority = 2;

    async detect(entry: HarEntry, context: DetectionContext): Promise<DetectedToken[]> {
        const url = new URL(entry.request.url);
        const stateToken = url.searchParams.get('state') || url.searchParams.get('session_state');

        if (stateToken && this.isValidStateToken(stateToken)) {
            return [{
                name: 'state',
                value: stateToken,
                extractionMethod: { type: 'regex', pattern: '[?&]state=([^&]+)', confidence: 0.9 },
                confidence: this.confidence,
                metadata: {
                    tokenType: 'state',
                    framework: 'OAuth/OIDC',
                    validationStrength: this.assessTokenStrength(stateToken)
                }
            }];
        }
        return [];
    }

    private isValidStateToken(token: string): boolean {
        // Base64 or hex, at least 16 chars
        return (token.length > 16 && ( /^[a-zA-Z0-9-_]+=*$/.test(token) || /^[a-fA-F0-9]+$/.test(token)));
    }
    
    private assessTokenStrength(token: string): number {
      let strength = 0;
      if (token.length > 32) strength += 0.2;
      if (/[A-Z]/.test(token) && /[a-z]/.test(token)) strength += 0.1;
      if (/\d/.test(token)) strength += 0.1;
      if (/[^A-Za-z0-9]/.test(token)) strength += 0.1;
      return Math.min(strength, 1.0);
  }
}

class NonceTokenStrategy implements TokenDetectionStrategy {
    confidence = 0.8;
    priority = 3;

    async detect(entry: HarEntry, context: DetectionContext): Promise<DetectedToken[]> {
        const nonceRegex = /name=["']nonce["'][^>]*value=["']([^"']+)["']/i;
        const match = context.sourceHTML.match(nonceRegex);

        if (match && match[1]) {
            const nonce = match[1];
            return [{
                name: 'nonce',
                value: nonce,
                extractionMethod: { type: 'regex', pattern: nonceRegex.source, confidence: 0.85 },
                confidence: this.confidence,
                metadata: {
                    tokenType: 'nonce',
                    framework: 'Generic',
                    validationStrength: this.assessTokenStrength(nonce)
                }
            }];
        }
        return [];
    }
    
    private assessTokenStrength(token: string): number {
      let strength = 0;
      if (token.length > 20) strength += 0.2;
      if (/[A-Z]/.test(token) && /[a-z]/.test(token)) strength += 0.1;
      if (/\d/.test(token)) strength += 0.1;
      if (/[^A-Za-z0-9]/.test(token)) strength += 0.1;
      return Math.min(strength, 1.0);
  }
}

class CustomHeaderTokenStrategy implements TokenDetectionStrategy {
    confidence = 0.9;
    priority = 1;

    async detect(entry: HarEntry, context: DetectionContext): Promise<DetectedToken[]> {
        const detectedTokens: DetectedToken[] = [];
        const customHeaderKeywords = ['x-csrf-token', 'x-xsrf-token', 'x-auth-token', 'authorization'];

        for (const header of context.requestHeaders) {
            if (customHeaderKeywords.includes(header.name.toLowerCase())) {
                const tokenValue = header.value;
                detectedTokens.push({
                    name: header.name,
                    value: tokenValue,
                    extractionMethod: {
                        type: 'header',
                        confidence: 0.95
                    },
                    confidence: this.confidence,
                    metadata: {
                        tokenType: 'header',
                        framework: 'Unknown',
                        validationStrength: this.assessTokenStrength(tokenValue)
                    }
                });
            }
        }
        return detectedTokens;
    }

    private assessTokenStrength(token: string): number {
        let strength = 0;
        if (token.length > 32) strength += 0.2;
        if (/[A-Z]/.test(token) && /[a-z]/.test(token)) strength += 0.1;
        if (/\d/.test(token)) strength += 0.1;
        if (/[^A-Za-z0-9]/.test(token)) strength += 0.1;

        // Check for JWT format
        if (/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_.+/=]*$/.test(token)) {
            strength += 0.3;
        }
        return Math.min(strength, 1.0);
    }
}
class JavaScriptVariableStrategy implements TokenDetectionStrategy {
    confidence = 0.75;
    priority = 4;

    async detect(entry: HarEntry, context: DetectionContext): Promise<DetectedToken[]> {
        const detectedTokens: DetectedToken[] = [];
        const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
        let scriptMatch;

        while ((scriptMatch = scriptRegex.exec(context.sourceHTML)) !== null) {
            const scriptContent = scriptMatch[1];
            const tokenRegex = /(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*['"]([a-zA-Z0-9-_]+)['"]/g;
            let tokenMatch;

            while ((tokenMatch = tokenRegex.exec(scriptContent)) !== null) {
                const varName = tokenMatch[1];
                const varValue = tokenMatch[2];

                if (this.isPotentialToken(varName, varValue)) {
                    detectedTokens.push({
                        name: varName,
                        value: varValue,
                        extractionMethod: {
                            type: 'regex',
                            pattern: tokenRegex.source,
                            confidence: 0.8
                        },
                        confidence: this.confidence,
                        metadata: {
                            tokenType: 'js_variable',
                            framework: 'Unknown',
                            validationStrength: this.assessTokenStrength(varValue)
                        }
                    });
                }
            }
        }
        return detectedTokens;
    }

    private isPotentialToken(name: string, value: string): boolean {
        const tokenKeywords = ['token', 'csrf', 'nonce', 'auth', 'session'];
        return tokenKeywords.some(kw => name.toLowerCase().includes(kw)) && value.length > 16;
    }

    private assessTokenStrength(token: string): number {
        let strength = 0;
        if (token.length > 32) strength += 0.2;
        if (/[A-Z]/.test(token) && /[a-z]/.test(token)) strength += 0.1;
        if (/\d/.test(token)) strength += 0.1;
        if (/[^A-Za-z0-9]/.test(token)) strength += 0.1;
        return Math.min(strength, 1.0);
    }
}
class MetaTagTokenStrategy implements TokenDetectionStrategy {
    confidence = 0.9;
    priority = 2;

    async detect(entry: HarEntry, context: DetectionContext): Promise<DetectedToken[]> {
        const detectedTokens: DetectedToken[] = [];
        const metaTagRegex = /<meta\s+name=["'](csrf-token|xsrf-token)["']\s+content=["']([^"']+)["']/gi;
        let match;

        while ((match = metaTagRegex.exec(context.sourceHTML)) !== null) {
            const tokenName = match[1];
            const tokenValue = match[2];

            detectedTokens.push({
                name: tokenName,
                value: tokenValue,
                extractionMethod: {
                    type: 'regex',
                    pattern: metaTagRegex.source,
                    confidence: 0.95
                },
                confidence: this.confidence,
                metadata: {
                    tokenType: 'meta',
                    framework: 'Unknown',
                    validationStrength: this.assessTokenStrength(tokenValue)
                }
            });
        }
        return detectedTokens;
    }

    private assessTokenStrength(token: string): number {
        let strength = 0;
        if (token.length > 32) strength += 0.2;
        if (/[A-Z]/.test(token) && /[a-z]/.test(token)) strength += 0.1;
        if (/\d/.test(token)) strength += 0.1;
        if (/[^A-Za-z0-9]/.test(token)) strength += 0.1;
        return Math.min(strength, 1.0);
    }
}


export class ProductionTokenDetector {
  private readonly strategies: TokenDetectionStrategy[] = [
    new CSRFTokenStrategy(),
    new StateTokenStrategy(),
    new NonceTokenStrategy(),
    new CustomHeaderTokenStrategy(),
    new JavaScriptVariableStrategy(),
    new MetaTagTokenStrategy()
  ];

  async detectDynamicTokens(criticalPath: HarEntry[]): Promise<Array<{
    name: string;
    value: string;
    sourceResponse: string;
    extractionMethod: ExtractionMethod;
    confidence: number;
  }>> {
    if (criticalPath.length < 2) return [];

    const [loginPage, loginSubmission] = criticalPath;
    const detectionContext = this.createDetectionContext(loginPage, loginSubmission);
    
    const detectionResults = await Promise.allSettled(
      this.strategies.map(strategy => strategy.detect(loginSubmission, detectionContext))
    );
    
    const candidateTokens = this.consolidateDetectionResults(detectionResults);
    return this.validateAndRankTokens(candidateTokens, detectionContext);
  }

  private createDetectionContext(
    loginPage: HarEntry,
    loginSubmission: HarEntry
  ): DetectionContext {
    return {
      sourceHTML: loginPage.response.content.text,
      targetPayload: loginSubmission.request.postData?.text || '',
      requestHeaders: loginSubmission.request.headers,
      responseHeaders: loginPage.response.headers,
      urlContext: new URL(loginPage.request.url),
      temporalDistance: this.calculateTemporalDistance(loginPage, loginSubmission)
    };
  }

  private calculateTemporalDistance(entry1: HarEntry, entry2: HarEntry): number {
    const time1 = new Date(entry1.startedDateTime).getTime();
    const time2 = new Date(entry2.startedDateTime).getTime();
    return Math.abs(time2 - time1);
  }

  private consolidateDetectionResults(results: PromiseSettledResult<DetectedToken[]>[]): DetectedToken[] {
      const allTokens: DetectedToken[] = [];
      results.forEach(result => {
          if (result.status === 'fulfilled' && result.value) {
              allTokens.push(...result.value);
          }
      });
      return allTokens;
  }

  private validateAndRankTokens(
      tokens: DetectedToken[],
      context: DetectionContext
  ): DetectedToken[] {
      // Add sourceResponse to metadata for context
      const rankedTokens = tokens.map(token => {
        (token.metadata as any).sourceResponse = context.sourceHTML;
        return token;
      });

      return rankedTokens.sort((a, b) => b.confidence - a.confidence);
  }
}
