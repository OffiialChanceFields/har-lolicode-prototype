// src/token-extraction/types.ts
import { HarEntry } from '../services/types';
import { TokenClassification } from './TokenDetectionService';

export enum TokenLocation {
  HEADER = 'header',
  BODY = 'body',
  COOKIE = 'cookie',
  URL = 'url',
  RESPONSE = 'response',
  ANY = 'any'
}

export interface DetectedToken {
  name: string;
  value: string;
  type: TokenClassification;
  location: TokenLocation;
  confidence: number;
  meta: {
    extractionLayer: string;
    [key: string]: unknown;
  };
}

export interface TokenExtractionResult {
  tokens: DetectedToken[];
  confidence: number;
  meta: {
    extractionLayers: string[];
    validationResults: Record<string, boolean>;
    crossReferences: Record<string, string[]>;
  };
}

// Types for SmartTokenDetector
export type SemanticHarEntry = HarEntry;

export interface TokenInstance {
  name: string;
  value: string;
  type: TokenClassification;
  location: TokenLocation;
  confidence: number;
  meta: {
    extractionLayer: string;
    [key: string]: unknown;
  };
  firstSeenIndex: number;
  isGenerated?: boolean;
  key?: string;
}

export interface TokenCandidate {
  type: 'body';
  location: string;
  value: string;
  key: string;
}
