// src/services/AnalysisMode.ts
import { HarRequest } from '../types';

// Predefined configuration profiles
export enum Predefined {
  AUTOMATIC = 'automatic'
}

// Resource types for classification
export enum ResourceType {
  AUTHENTICATION = 'authentication',
  API_ENDPOINT = 'api_endpoint',
  FORM_SUBMISSION = 'form_submission',
  GRAPHQL = 'graphql',
  REST_API = 'rest_api',
  HTML_DOCUMENT = 'html_document',
  FILE_UPLOAD = 'file_upload',
  WEBSOCKET = 'websocket',
  THIRD_PARTY = 'third_party',
  TRACKING = 'tracking',
  STATIC_ASSET = 'static_asset',
  SESSION_MANAGEMENT = 'session_management'
}

// Token detection scopes
export enum TokenDetectionScope {
  COMPREHENSIVE_SCAN = 'comprehensive',
  SESSION_MANAGEMENT_FOCUSED = 'session_focused',
  USER_CONFIGURED = 'user_configured',
  MINIMAL = 'minimal'
}

// Code template types
export enum CodeTemplateType {
  SINGLE_REQUEST_TEMPLATE = 'single_request',
  AUTHENTICATION_FAILURE_TEMPLATE = 'auth_failure',
  AUTHENTICATION_SUCCESS_TEMPLATE = 'auth_success',
  MULTI_STEP_FLOW_TEMPLATE = 'multi_step_flow',
  GENERIC_TEMPLATE = 'generic'
}

// Parameter types for endpoint analysis
export enum ParameterType {
  JWT = 'jwt',
  API_KEY = 'api_key',
  OAUTH_STATE = 'oauth_state',
  SESSION_ID = 'session_id',
  USERNAME = 'username',
  PASSWORD = 'password',
  EMAIL = 'email',
  BOOLEAN = 'boolean',
  NUMBER = 'number',
  STRING = 'string'
}

// Endpoint characteristics
export interface EndpointCharacteristics {
  hasAuthentication: boolean;
  hasStateChange: boolean;
  hasDataSubmission: boolean;
  hasSensitiveData: boolean;
  isIdempotent: boolean;
  httpMethods: string[];
  parameterTypes: ParameterType[];
}

// Behavioral pattern for stateful analysis
export interface BehavioralPattern {
  id: string;
  sequence: {
    type: ResourceType,
    characteristics: Partial<EndpointCharacteristics>
  }[];
  trigger: (requests: HarRequest[]) => boolean;
}

// Contextual rule for advanced filtering
export interface ContextualFilterRule {
  id: string;
  condition: (request: HarRequest, context: HarRequest[]) => boolean;
  action: 'include' | 'exclude' | 'adjust_score';
  scoreAdjustment?: number;
}
// Filtering configuration
export interface FilteringConfig {
  // Various filtering parameters
  [key: string]: unknown;
}

// Back-compat alias for modules still referencing the old name
export type FilteringCriteria = FilteringConfig;[];
  };
  resourceTypeWeights: Map<ResourceType, number>;
  contextualRules: ContextualFilterRule[];
  behavioralPatterns: BehavioralPattern[];
  scoreThresholds: {
    minimum: number;
    optimal: number;
    includeThreshold: number;
  };
}

// Back-compat: some modules still reference the old name
export type FilteringCriteria = FilteringConfig;

// Token detection configuration
export interface TokenDetectionConfig {
  scope: TokenDetectionScope;
  customPatterns?: RegExp[];
}

export interface AnalysisConfiguration {
  filtering: FilteringConfig;
  tokenDetection: TokenDetectionConfig;
  // ... other configuration aspects
}

// --- AnalysisModeService ---
export class AnalysisModeService {
  private static configurations: Map<Predefined, AnalysisConfiguration> = new Map();

  static {
    this.initializeConfigurations();
  }

  private static initializeConfigurations(): void {
    // Default: Automatic Configuration
    this.configurations.set(Predefined.AUTOMATIC, {
      filtering: {
          endpointPatterns: {
              include: [/api/i, /auth/i],
              exclude: [/\.css$/, /\.js$/, /\.svg$/, /\.png$/],
              priorityPatterns: [
                  { pattern: /login/i, weight: 10 },
                  { pattern: /token/i, weight: 10 }
              ]
          },
          resourceTypeWeights: new Map(),
          contextualRules: [],
          behavioralPatterns: [],
          scoreThresholds: { minimum: 5, optimal: 20, includeThreshold: 10 }
      },
      tokenDetection: { scope: TokenDetectionScope.COMPREHENSIVE_SCAN }
    });
  }

  public static getConfiguration(mode: Predefined): AnalysisConfiguration | undefined {
    return this.configurations.get(mode);
  }

  public static getDefaultConfiguration(): AnalysisConfiguration {
    return this.configurations.get(Predefined.AUTOMATIC)!;
  }
}

// FilteringCriteria type alias for compatibility elsewhere
export type FilteringCriteria = FilteringConfig;