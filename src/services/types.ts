import { MatchedPattern } from '../flow-analysis/types';
import { SessionAnalysisResult } from './session/types';
import { SequenceRules } from './sequencing/types';
import { ExtractionStrategy } from './extraction/types';
import { AnalysisMode } from './AnalysisMode';

// Basic HAR Interfaces

// Root HAR object interface
export interface Har {
  log: {
    version?: string;
    creator?: unknown;
    browser?: unknown;
    pages?: unknown[];
    entries: HarEntry[];
  };
}

export interface HarHeader {
  name: string;
  value: string;
}

export interface HarCookie {
  name: string;
  value: string;
  path?: string;
  domain?: string;
  expires?: string;
  httpOnly?: boolean;
  secure?: boolean;
}

export interface HarPostData {
  mimeType: string;
  text?: string;
  params?: { name: string; value: string }[];
}

export interface HarRequest {
  method: string;
  url: string;
  httpVersion: string;
  headers: HarHeader[];
  queryString: { name: string; value: string }[];
  cookies: HarCookie[];
  headersSize: number;
  bodySize: number;
  postData?: HarPostData;
}

export interface HarContent {
  size: number;
  mimeType: string;
  text?: string;
  encoding?: string;
}

export interface HarResponse {
  status: number;
  statusText: string;
  httpVersion: string;
  headers: HarHeader[];
  cookies: HarCookie[];
  content: HarContent;
  redirectURL: string;
  headersSize: number;
  bodySize: number;
}

export interface RequestParameter {
  name: string;
  value: string;
  location: 'query' | 'body' | 'header';
  isCredential?: boolean;
}

export enum TokenType {
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
  RAILS_AUTHENTICITY = 'rails_authenticity',
}

export interface DetectedToken {
  name: string;
  value: string;
  type: TokenType;
  source: 'header' | 'body' | 'cookie' | 'url';
  confidence: number;
}

export interface HarEntry {
  startedDateTime: string;
  time: number;
  request: HarRequest;
  response: HarResponse;
  cache?: Record<string, unknown>;
  timings?: Record<string, unknown>;
  serverIPAddress?: string;
  connection?: string;
  comment?: string;
  parameters?: RequestParameter[];
  finalScore?: number;
}

// OB2 LoliCode Generation Types
export interface OB2BlockDefinition {
  blockType: string;
  parameters: Map<string, string>;
}

export interface OB2ConfigurationResult {
  loliCode: string;
  blocks: OB2BlockDefinition[];
  variables: Map<string, string>;
  extractionStrategies?: ExtractionStrategy[];
}

// Analysis Result Types
export interface ProcessingMetrics {
  totalRequests?: number;
  significantRequests?: number;
  processingTime?: number;
  filteringTime?: number;
  scoringTime?: number;
  tokenDetectionTime?: number;
  codeGenerationTime?: number;
  correlationAnalysisTime?: number;
  averageScore?: number;
  resourceTypeDistribution?: Map<AnalysisMode.ResourceType, number>;
  detectedPatterns?: string[];
}

export interface HarAnalysisResult {
  requests: HarEntry[];
  metrics: ProcessingMetrics;
  loliCode: string;
  detectedTokens?: Map<string, DetectedToken[]>;
  behavioralFlows?: MatchedPattern[];
  warnings?: string[];
  sessionAnalysis?: SessionAnalysisResult;
  sequenceRules?: SequenceRules;
  extractionStrategies?: ExtractionStrategy[];
}
