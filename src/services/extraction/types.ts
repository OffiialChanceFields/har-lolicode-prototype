export type ExtractorType = 'JSONPath' | 'Regex' | 'CSS';

export interface ExtractionPattern {
  type: ExtractorType;
  expression: string;
  variableName: string;
  confidence: number;
}

export interface ExtractionStrategy {
  primary: ExtractionPattern;
  fallbacks: ExtractionPattern[];
}
