// src/pattern-library/AuthenticationPatternLibrary.ts
import { HarEntry } from '../types';
import { XMLParser } from 'fast-xml-parser';

/**
 * Enhanced pattern matching that handles more flexible authentication flows
 * - More forgiving URL patterns
 * - Broader HTTP method support
 * - Flexible status code ranges
 * - Looser timing constraints
 */
export enum AuthenticationPatternId {
  OAUTH2_AUTH_CODE = 'oauth2_auth_code',
  FORM_AUTH_CSRF = 'form_auth_csrf',
  JWT_API_AUTH = 'jwt_api_auth',
  SAML_AUTH = 'saml_auth',
  BASIC_AUTH = 'basic_auth',
  API_KEY_AUTH = 'api_key_auth',
  BEARER_TOKEN_AUTH = 'bearer_token_auth',
  DIGEST_AUTH = 'digest_auth',
  OPENID_CONNECT = 'openid_connect',
  FORM_AUTH_NO_CSRF = 'form_auth_no_csrf',
  SESSION_COOKIE_AUTH = 'session_cookie_auth',
  MFA_SMS = 'mfa_sms',
  MFA_TOTP = 'mfa_totp',
  MFA_PUSH = 'mfa_push',
  MFA_WEBAUTHN = 'mfa_webauthn',
  SESSION_ELEVATION = 'session_elevation',
  MFA_SEQUENCE = 'mfa_sequence'
}

export interface CompositeAuthenticationPattern {
  id: string;
  name: string;
  sequence: AuthenticationPatternId[];
  confidence: number;
}

// Common patterns for authentication endpoints
const AUTH_ENDPOINT_PATTERNS = [
  // General keywords in path
  /\/(login|signin|auth|authenticate|session|token|account|access|oauth|oauth2|sso|saml)/i,
  // Keywords as the main part of the path
  /login|auth|token|sso/i,
  // API-specific paths, with optional versioning
  /\/api\/v?\d*\/(auth|login|token|oauth|oauth2)/i,
  // Identity server patterns
  /identity\/connect/i,
  // User-centric paths
  /\/users\/(login|signin|auth|session)/i,
  // End of URL patterns
  /\.sso$/,
  /\.auth$/,
];

// Common patterns for response status codes
const SUCCESS_STATUS_CODES = [200, 201, 204, 301, 302, 303, 307, 308];
const ERROR_STATUS_CODES = [400, 401, 403, 429];

// Flexible timing constraints
const FLEXIBLE_TIMING = { minDelaySeconds: 0, maxDelaySeconds: 15 };

export interface AuthenticationPattern {
  id: AuthenticationPatternId;
  name: string;
  confidence: number;
  pattern: Array<Partial<RequestPattern>>;
  extract?: (matches: HarEntry[]) => Record<string, unknown>;
  tokenPatterns?: Array<{
    name: string;
    pattern: RegExp;
    location: 'url' | 'header' | 'body' | 'response';
  }>;
}
interface RequestPattern {
  urlPattern?: RegExp | RegExp[];
  methodPattern?: string[];
  statusPattern?: number[];
  headerPattern?: Record<string, RegExp>;
  bodyPattern?: RegExp;
  timing?: {
    minDelaySeconds?: number;
    maxDelaySeconds?: number;
  };
  isOptional?: boolean;
}

export class AuthenticationPatternLibrary {
  private readonly patterns: Map<AuthenticationPatternId, AuthenticationPattern>;
  private readonly compositePatterns: CompositeAuthenticationPattern[];

  constructor() {
    this.patterns = new Map();
    this.compositePatterns = [];
    this.initializePatternDatabase(); // Initialize with flexible patterns
    this.initializeCompositePatterns();
  }
  
  private initializePatternDatabase(): void {
    // OAuth 2.0 Authorization Code Flow
    this.patterns.set(AuthenticationPatternId.OAUTH2_AUTH_CODE, {
      id: AuthenticationPatternId.OAUTH2_AUTH_CODE,
      name: 'OAuth 2.0 Flexible Authorization Flow',
      confidence: 0.95,
      pattern: [
        {
          urlPattern: [/\/oauth\/authorize/, /\/connect\/authorize/],
          methodPattern: ['GET', 'POST'],
          statusPattern: SUCCESS_STATUS_CODES,
          timing: FLEXIBLE_TIMING
        },
        {
          urlPattern: [/\/callback/, /\/redirect/, /\/oauth2\/callback/],
          methodPattern: ['GET', 'POST'],
          statusPattern: SUCCESS_STATUS_CODES,
          timing: FLEXIBLE_TIMING
        },
        {
          urlPattern: [/\/oauth\/token/, /\/token/, /\/connect\/token/],
          methodPattern: ['POST'],
          statusPattern: SUCCESS_STATUS_CODES,
          timing: FLEXIBLE_TIMING
        }
      ],
      extract: (matches) => ({
        authorizationEndpoint: matches[0]?.request.url,
        callbackEndpoint: matches[1]?.request.url,
        tokenEndpoint: matches[2]?.request.url,
        details: {
          state: this.extractOAuthState(matches),
        }
      }),
      tokenPatterns: [
        { name: 'state', pattern: /state=([^&]+)/, location: 'url' },
        { name: 'code', pattern: /code=([^&]+)/, location: 'url' },
        { name: 'access_token', pattern: /"access_token":"([^"]+)"/, location: 'response' },
        { name: 'refresh_token', pattern: /"refresh_token":"([^"]+)"/, location: 'response' }
      ]
    });
    
    // OpenID Connect (OIDC) Authorization Code Flow
    this.patterns.set(AuthenticationPatternId.OPENID_CONNECT, {
      id: AuthenticationPatternId.OPENID_CONNECT,
      name: 'OpenID Connect (OIDC) Authorization Code Flow',
      confidence: 0.96, // Higher than OAuth2 due to specificity
      pattern: [
        {
          urlPattern: [
            /\/oauth\/authorize.*scope=.*openid/,
            /\/connect\/authorize.*scope=.*openid/,
            /\/as\/authorize.*scope=.*openid/,
            /login.*scope=.*openid/
          ],
          methodPattern: ['GET', 'POST'],
          statusPattern: SUCCESS_STATUS_CODES,
          timing: FLEXIBLE_TIMING
        },
        {
          urlPattern: [/\/callback/, /\/redirect/, /\/oauth2\/callback/],
          methodPattern: ['GET', 'POST'],
          statusPattern: SUCCESS_STATUS_CODES,
          timing: FLEXIBLE_TIMING
        },
        {
          urlPattern: [/\/oauth\/token/, /\/token/, /\/connect\/token/],
          methodPattern: ['POST'],
          statusPattern: SUCCESS_STATUS_CODES,
          timing: FLEXIBLE_TIMING
        },
        {
          urlPattern: [/\/userinfo/, /\/connect\/userinfo/, /\/me/],
          methodPattern: ['GET', 'POST'],
          headerPattern: {
            'authorization': /^Bearer\s+[A-Za-z0-9._-]+/
          },
          statusPattern: SUCCESS_STATUS_CODES,
          timing: FLEXIBLE_TIMING,
          isOptional: true
        }
      ],
      extract: (matches) => {
        const tokenMatch = matches.find(m => m.request.url.includes('/token'));
        return {
          authorizationEndpoint: matches[0]?.request.url,
          callbackEndpoint: matches[1]?.request.url,
          tokenEndpoint: tokenMatch?.request.url,
          userInfoEndpoint: matches.find(m => m.request.url.includes('/userinfo'))?.request.url || 'N/A',
          details: {
            state: this.extractOAuthState(matches),
            id_token: tokenMatch ? this.extractJwtToken(tokenMatch, 'id_token') : null
          }
        };
      },
      tokenPatterns: [
        { name: 'state', pattern: /state=([^&]+)/, location: 'url' },
        { name: 'code', pattern: /code=([^&]+)/, location: 'url' },
        { name: 'access_token', pattern: /"access_token":"([^"]+)"/, location: 'response' },
        { name: 'id_token', pattern: /"id_token":"([^"]+)"/, location: 'response' },
        { name: 'refresh_token', pattern: /"refresh_token":"([^"]+)"/, location: 'response' }
      ]
    });

    // Form-based Authentication with CSRF
    this.patterns.set(AuthenticationPatternId.FORM_AUTH_CSRF, {
      id: AuthenticationPatternId.FORM_AUTH_CSRF,
      name: 'Flexible Form-based Authentication',
      confidence: 0.90,
      pattern: [
        {
          urlPattern: AUTH_ENDPOINT_PATTERNS,
          methodPattern: ['GET'],
          statusPattern: SUCCESS_STATUS_CODES,
          timing: FLEXIBLE_TIMING
        },
        {
          urlPattern: AUTH_ENDPOINT_PATTERNS,
          methodPattern: ['POST', 'PUT'],
          statusPattern: SUCCESS_STATUS_CODES,
          timing: FLEXIBLE_TIMING
        }
      ],
      extract: (matches) => ({
        loginFormEndpoint: matches[0]?.request.url,
        authenticationEndpoint: matches[1]?.request.url,
        credentials: this.extractCredentials(matches[1]),
        details: {
          cookies: matches[1]?.response.headers.filter(h => h.name.toLowerCase() === 'set-cookie')
        }
      }),
      tokenPatterns: [
        { name: '_token', pattern: /name="_token" value="([^"]+)"/, location: 'response' },
        { name: 'csrf_token', pattern: /csrf_token['"]\s*:\s*['"]([^'"]+)['"]/, location: 'response' },
        { name: 'session_id', pattern: /set-cookie:\s*sessionid=([^;]+)/i, location: 'header' }
      ]
    });
    
    // JWT-based API Authentication
    this.patterns.set(AuthenticationPatternId.JWT_API_AUTH, {
      id: AuthenticationPatternId.JWT_API_AUTH,
      name: 'Flexible JWT-based Authentication',
      confidence: 0.88,
      pattern: [
        {
          urlPattern: [
            /\/api\/auth\/login/,
            /\/api\/v?\d+\/(auth|login|token)/,
            /\/login/,
            /\/token/
          ],
          methodPattern: ['POST', 'GET'],
          statusPattern: SUCCESS_STATUS_CODES,
          timing: FLEXIBLE_TIMING
        }
      ],
      extract: (matches) => ({
        loginEndpoint: matches[0]?.request.url,
        accessToken: this.extractJwtToken(matches[0], 'access_token'),
        refreshToken: this.extractJwtToken(matches[0], 'refresh_token'),
        details: {
          responseBody: matches[0]?.response.content.text
        }
      }),
      tokenPatterns: [
        { name: 'access_token', pattern: /"access_token":"([^"]+)"/, location: 'response' },
        { name: 'refresh_token', pattern: /"refresh_token":"([^"]+)"/, location: 'response' }
      ]
    });
    
    // SAML Authentication Flow
    this.patterns.set(AuthenticationPatternId.SAML_AUTH, {
      id: AuthenticationPatternId.SAML_AUTH,
      name: 'Flexible SAML Authentication',
      confidence: 0.85,
      pattern: [
        {
          urlPattern: [
            /\/saml\/login/,
            /\/sso\/login/,
            /\/auth\/saml/
          ],
          methodPattern: ['GET', 'POST'],
          statusPattern: SUCCESS_STATUS_CODES,
          timing: FLEXIBLE_TIMING
        },
        {
          urlPattern: [
            /\/saml\/acs/,
            /\/saml\/callback/,
            /\/sso\/callback/
          ],
          methodPattern: ['POST'],
          statusPattern: SUCCESS_STATUS_CODES,
          timing: FLEXIBLE_TIMING
        }
      ],
      extract: (matches) => {
        const samlData = this.extractSamlResponse(matches[1]);
        return {
          loginEndpoint: matches[0]?.request.url,
          assertionConsumerService: matches[1]?.request.url,
          samlResponse: samlData?.decoded,
          samlAssertion: samlData?.parsed,
          details: {
            requestBody: matches[1]?.request.postData?.text,
            isMfaRequired: this.isMfaRequired(matches[1]),
            mfaDetails: this.extractMfaDetails(matches[1])
          }
        };
      },
      tokenPatterns: [
        {
          name: 'saml_response',
          pattern: /name="SAMLResponse"\s+value="([^"]+)"/,
          location: 'body'
        },
        {
          name: 'relay_state',
          pattern: /name="RelayState"\s+value="([^"]+)"/,
          location: 'body'
        }
      ]
    });
    
    // Basic Authentication
    this.patterns.set(AuthenticationPatternId.BASIC_AUTH, {
      id: AuthenticationPatternId.BASIC_AUTH,
      name: 'Flexible Basic Authentication',
      confidence: 0.80,
      pattern: [
        {
          headerPattern: {
            'authorization': /^Basic\s+[A-Za-z0-9+/=]+/
          },
          statusPattern: SUCCESS_STATUS_CODES.concat(ERROR_STATUS_CODES),
          timing: FLEXIBLE_TIMING
        }
      ],
      extract: (matches) => ({
        authHeader: matches[0]?.request.headers.find(h => 
          h.name.toLowerCase() === 'authorization'
        ),
        details: {
          decodedCredentials: atob(matches[0]?.request.headers.find(h => h.name.toLowerCase() === 'authorization')?.value.split(' ')[1] || '')
        }
      }),
      tokenPatterns: [
        { name: 'credentials', pattern: /^Basic\s+([A-Za-z0-9+/=]+)/, location: 'header' }
      ]
    });
    
    // API Key Authentication
    this.patterns.set(AuthenticationPatternId.API_KEY_AUTH, {
      id: AuthenticationPatternId.API_KEY_AUTH,
      name: 'Flexible API Key Authentication',
      confidence: 0.82,
      pattern: [
        {
          headerPattern: {
            'x-api-key': /.+/,
            'authorization': /^Bearer\s+[A-Za-z0-9._-]+/
          },
          timing: FLEXIBLE_TIMING
        }
      ],
      extract: (matches) => ({
        apiKeyHeader: matches[0]?.request.headers.find(h => 
          h.name.toLowerCase() === 'x-api-key'
        ),
        details: {
          headers: matches[0]?.request.headers
        }
      }),
      tokenPatterns: [
        { name: 'api_key', pattern: /x-api-key:\s*([^\s]+)/i, location: 'header' }
      ]
    });
    
    // Bearer Token Authentication
    this.patterns.set(AuthenticationPatternId.BEARER_TOKEN_AUTH, {
      id: AuthenticationPatternId.BEARER_TOKEN_AUTH,
      name: 'Flexible Bearer Token Authentication',
      confidence: 0.83,
      pattern: [
        {
          headerPattern: {
            'authorization': /^Bearer\s+[A-Za-z0-9._-]+/
          },
          timing: FLEXIBLE_TIMING
        }
      ],
      extract: (matches) => ({
        authHeader: matches[0]?.request.headers.find(h => 
          h.name.toLowerCase() === 'authorization'
        ),
        details: {
          token: matches[0]?.request.headers.find(h => h.name.toLowerCase() === 'authorization')?.value.split(' ')[1]
        }
      }),
      tokenPatterns: [
        { name: 'access_token', pattern: /Bearer\s+([A-Za-z0-9._-]+)/, location: 'header' }
      ]
    });
    
    // Form-based Authentication without CSRF
    this.patterns.set(AuthenticationPatternId.FORM_AUTH_NO_CSRF, {
      id: AuthenticationPatternId.FORM_AUTH_NO_CSRF,
      name: 'Flexible Form-based Authentication (No CSRF)',
      confidence: 0.75,
      pattern: [
        {
          urlPattern: AUTH_ENDPOINT_PATTERNS,
          methodPattern: ['GET'],
          statusPattern: SUCCESS_STATUS_CODES,
          timing: FLEXIBLE_TIMING
        },
        {
          urlPattern: AUTH_ENDPOINT_PATTERNS,
          methodPattern: ['POST', 'PUT'],
          statusPattern: SUCCESS_STATUS_CODES,
          timing: FLEXIBLE_TIMING
        }
      ],
      extract: (matches) => ({
        loginFormEndpoint: matches[0]?.request.url,
        authenticationEndpoint: matches[1]?.request.url,
        credentials: this.extractCredentials(matches[1]),
        details: {
          cookies: matches[1]?.response.headers.filter(h => h.name.toLowerCase() === 'set-cookie')
        }
      }),
      tokenPatterns: [
        { name: 'session_id', pattern: /set-cookie:\s*sessionid=([^;]+)/i, location: 'header' }
      ]
    });
    
    // Session Cookie Authentication
    this.patterns.set(AuthenticationPatternId.SESSION_COOKIE_AUTH, {
      id: AuthenticationPatternId.SESSION_COOKIE_AUTH,
      name: 'Flexible Session Cookie Authentication',
      confidence: 0.85,
      pattern: [
        {
          headerPattern: {
            'cookie': /sessionid=[^;]+|auth=[^;]+|token=[^;]+/i
          },
          timing: FLEXIBLE_TIMING
        }
      ],
      extract: (matches) => ({
        sessionId: this.extractSessionId(matches[0])
      }),
      tokenPatterns: [
        { name: 'session_id', pattern: /sessionid=([^;]+)/i, location: 'header' }
      ]
    });
    
    // MFA SMS Authentication
    this.patterns.set(AuthenticationPatternId.MFA_SMS, {
      id: AuthenticationPatternId.MFA_SMS,
      name: 'Flexible MFA (SMS)',
      confidence: 0.78,
      pattern: [
        {
          urlPattern: AUTH_ENDPOINT_PATTERNS,
          methodPattern: ['POST', 'PUT'],
          statusPattern: SUCCESS_STATUS_CODES,
          timing: FLEXIBLE_TIMING
        },
        {
          urlPattern: [
            /\/mfa\/sms/,
            /\/sms\/verify/,
            /\/2fa\/sms/
          ],
          methodPattern: ['GET', 'POST'],
          statusPattern: SUCCESS_STATUS_CODES,
          timing: FLEXIBLE_TIMING
        },
        {
          urlPattern: [
            /\/mfa\/verify/,
            /\/2fa\/verify/,
            /\/code\/verify/
          ],
          methodPattern: ['POST', 'PUT'],
          statusPattern: SUCCESS_STATUS_CODES,
          timing: FLEXIBLE_TIMING
        }
      ],
      extract: (matches) => ({
        loginEndpoint: matches[0]?.request.url,
        mfaSmsEndpoint: matches[1]?.request.url,
        verificationEndpoint: matches[2]?.request.url,
        details: {
          mfaToken: this.extractJwtToken(matches[1], 'mfa_token')
        }
      }),
      tokenPatterns: [
        { name: 'mfa_token', pattern: /"mfa_token":"([^"]+)"/, location: 'response' },
        { name: 'verification_code', pattern: /name="code" value="([^"]+)"/, location: 'response' }
      ]
    });
    
    // MFA TOTP Authentication
    this.patterns.set(AuthenticationPatternId.MFA_TOTP, {
      id: AuthenticationPatternId.MFA_TOTP,
      name: 'Flexible MFA (TOTP)',
      confidence: 0.80,
      pattern: [
        {
          urlPattern: AUTH_ENDPOINT_PATTERNS,
          methodPattern: ['POST', 'PUT'],
          statusPattern: SUCCESS_STATUS_CODES,
          timing: FLEXIBLE_TIMING
        },
        {
          urlPattern: [
            /\/mfa\/totp/,
            /\/totp\/verify/,
            /\/2fa\/totp/
          ],
          methodPattern: ['GET', 'POST'],
          statusPattern: SUCCESS_STATUS_CODES,
          timing: FLEXIBLE_TIMING
        },
        {
          urlPattern: [
            /\/mfa\/verify/,
            /\/2fa\/verify/,
            /\/code\/verify/
          ],
          methodPattern: ['POST', 'PUT'],
          statusPattern: SUCCESS_STATUS_CODES,
          timing: FLEXIBLE_TIMING
        }
      ],
      extract: (matches) => ({
        loginEndpoint: matches[0]?.request.url,
        mfaTotpEndpoint: matches[1]?.request.url,
        verificationEndpoint: matches[2]?.request.url,
        details: {
          mfaToken: this.extractJwtToken(matches[1], 'mfa_token')
        }
      }),
      tokenPatterns: [
        { name: 'mfa_token', pattern: /"mfa_token":"([^"]+)"/, location: 'response' },
        { name: 'totp_code', pattern: /name="code" value="([^"]+)"/, location: 'response' }
      ]
    });

    // Session Elevation
    this.patterns.set(AuthenticationPatternId.SESSION_ELEVATION, {
      id: AuthenticationPatternId.SESSION_ELEVATION,
      name: 'Session Elevation (Step-up Authentication)',
      confidence: 0.9,
      pattern: [
        {
          // Step 1: Access Denied
          statusPattern: [401, 403, 302, 307],
          // A generic pattern for a sensitive resource, could be improved with heuristics
          urlPattern: [/.*/]
        },
        {
          // Step 2: Re-authentication (e.g., password re-entry)
          urlPattern: AUTH_ENDPOINT_PATTERNS,
          methodPattern: ['POST'],
          statusPattern: SUCCESS_STATUS_CODES,
          timing: FLEXIBLE_TIMING
        },
        {
          // Step 3: Access Granted
          statusPattern: [200, 201, 204],
          urlPattern: [/.*/] // Should match the URL of the first request
        }
      ],
      extract: (matches) => ({
        sensitiveResource: matches[0]?.request.url,
        reauthenticationFlow: matches.slice(1, -1), // The intermediate steps
        successfulAccess: matches[matches.length - 1]?.request.url
      })
    });

    // MFA WebAuthn Authentication
    this.patterns.set(AuthenticationPatternId.MFA_WEBAUTHN, {
      id: AuthenticationPatternId.MFA_WEBAUTHN,
      name: 'MFA (WebAuthn/FIDO2)',
      confidence: 0.85,
      pattern: [
        {
          // Step 1: Get Challenge
          urlPattern: [
            /\/webauthn\/challenge/,
            /\/fido2\/challenge/,
            /\/login\/start/
          ],
          methodPattern: ['GET', 'POST'],
          statusPattern: SUCCESS_STATUS_CODES
        },
        {
          // Step 2: Verify Assertion
          urlPattern: [
            /\/webauthn\/verify/,
            /\/fido2\/verify/,
            /\/login\/finish/
          ],
          methodPattern: ['POST'],
          statusPattern: SUCCESS_STATUS_CODES,
          bodyPattern: /"response":\s*\{.*"clientDataJSON":/
        }
      ],
      extract: (matches) => ({
        challengeEndpoint: matches[0]?.request.url,
        verificationEndpoint: matches[1]?.request.url,
        webauthnCredential: this.extractWebAuthnCredential(matches[1])
      }),
      tokenPatterns: [
        {
          name: 'challenge',
          pattern: /"challenge":"([^"]+)"/,
          location: 'response'
        }
      ]
    });
  }
  
  getAllPatterns(): Map<AuthenticationPatternId, AuthenticationPattern> {
    return this.patterns;
  }

  getCompositePatterns(): CompositeAuthenticationPattern[] {
    return this.compositePatterns;
  }
  
  getPattern(id: AuthenticationPatternId): AuthenticationPattern | undefined {
    return this.patterns.get(id);
  }
  
  private extractOAuthState(matches: HarEntry[]): string | null {
    for (const match of matches) {
      try {
        const url = new URL(match.request.url);
        const stateParam = url.searchParams.get('state');
        if (stateParam) return stateParam;
      } catch (e) {
        // Invalid URL
      }
    }
    return null;
  }
  
  private extractCredentials(entry: HarEntry): Record<string, string> | null {
    if (!entry.request.postData?.text) return null;
    
    try {
      // Try JSON
      const data = JSON.parse(entry.request.postData.text);
      return {
        username: data.username || data.email || '',
        password: data.password || ''
      };
    } catch (e) {
      // Not JSON, try form data
      const formData = new URLSearchParams(entry.request.postData.text);
      return {
        username: formData.get('username') || formData.get('email') || '',
        password: formData.get('password') || ''
      };
    }
  }
  
  private extractJwtToken(entry: HarEntry, tokenType: string): string | null {
    if (!entry.response.content?.text) return null;
    
    try {
      const data = JSON.parse(entry.response.content.text);
      return data[tokenType] || null;
    } catch (e) {
      return null;
    }
  }
  
  private extractSamlResponse(
    entry: HarEntry
  ): { raw: string; decoded: string; parsed: any } | null {
    if (!entry.request.postData?.text) return null;

    try {
      const formData = new URLSearchParams(entry.request.postData.text);
      const samlResponse = formData.get('SAMLResponse');
      if (!samlResponse) return null;

      const decoded = atob(samlResponse);
      const parser = new XMLParser();
      const parsed = parser.parse(decoded);

      return {
        raw: samlResponse,
        decoded,
        parsed
      };
    } catch (e) {
      console.error('Failed to parse SAML response:', e);
      return null;
    }
  }
  private isMfaRequired(entry: HarEntry): boolean {
    // Enhanced logic to detect MFA requirement from response headers or content
    const mfaHeader = entry.response.headers.find(
      (h) => h.name.toLowerCase() === 'x-mfa-required'
    );
    if (mfaHeader && mfaHeader.value === 'true') {
      return true;
    }

    if (entry.response.content.text) {
      const text = entry.response.content.text.toLowerCase();
      return (
        text.includes('multi-factor') ||
        text.includes('2fa') ||
        text.includes('verify your identity')
      );
    }

    return false;
  }
  private extractMfaDetails(entry: HarEntry): Record<string, any> | null {
    if (!this.isMfaRequired(entry)) return null;

    // Extract details about the MFA challenge
    // This could be from response body, headers, etc.
    // Example:
    const mfaToken = this.extractJwtToken(entry, 'mfa_token');
    return {
      mfaToken,
      challengeType: entry.response.headers.find(
        (h) => h.name.toLowerCase() === 'x-mfa-challenge'
      )?.value
    };
  }
  private extractSessionId(entry: HarEntry): string | null {
    const cookieHeader = entry.request.headers.find(
      (h) => h.name.toLowerCase() === 'cookie'
    );

    if (!cookieHeader) return null;

    const sessionIdMatch = cookieHeader.value.match(/sessionid=([^;]+)/);
    return sessionIdMatch ? sessionIdMatch[1] : null;
  }

  private extractWebAuthnCredential(
    entry: HarEntry
  ): Record<string, any> | null {
    if (!entry.request.postData?.text) return null;

    try {
      const data = JSON.parse(entry.request.postData.text);
      return data;
    } catch (e) {
      return null;
    }
  }

  private initializeCompositePatterns(): void {
    this.compositePatterns.push(
      {
        id: 'mfa_sequence_totp',
        name: 'MFA Sequence (TOTP)',
        sequence: [
          AuthenticationPatternId.FORM_AUTH_CSRF,
          AuthenticationPatternId.MFA_TOTP
        ],
        confidence: 0.95
      },
      {
        id: 'mfa_sequence_sms',
        name: 'MFA Sequence (SMS)',
        sequence: [
          AuthenticationPatternId.FORM_AUTH_CSRF,
          AuthenticationPatternId.MFA_SMS
        ],
        confidence: 0.95
      },
      {
        id: 'mfa_sequence_webauthn',
        name: 'MFA Sequence (WebAuthn)',
        sequence: [
          AuthenticationPatternId.FORM_AUTH_CSRF,
          AuthenticationPatternId.MFA_WEBAUTHN
        ],
        confidence: 0.98
      }
    );
  }
}
