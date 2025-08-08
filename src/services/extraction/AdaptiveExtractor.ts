import { HarEntry } from 'har-format';
import { ExtractionStrategy, ExtractionPattern } from './types';

export class AdaptiveExtractor {
  public createExtractors(responses: string[]): ExtractionStrategy[] {
    const strategies: ExtractionStrategy[] = [];
    const parsedResponses = responses
      .map(r => {
        try {
          return JSON.parse(r);
        } catch {
          return null;
        }
      })
      .filter(r => r !== null);

    if (parsedResponses.length === 0) {
      return [];
    }

    const commonKeys = this.findCommonKeys(parsedResponses);

    for (const key of commonKeys) {
      strategies.push({
        primary: {
          type: 'JSONPath',
          expression: `$.${key}`,
          variableName: key.split('.').pop() || key,
          confidence: 1.0,
        },
        fallbacks: [],
      });
    }

    return strategies;
  }

  private findCommonKeys(objects: any[]): string[] {
    if (objects.length === 0) {
      return [];
    }

    const keyCounts = new Map<string, number>();
    for (const obj of objects) {
      const keys = this.getObjectKeys(obj);
      for (const key of keys) {
        keyCounts.set(key, (keyCounts.get(key) || 0) + 1);
      }
    }

    const commonKeys: string[] = [];
    for (const [key, count] of keyCounts.entries()) {
      if (count === objects.length) {
        commonKeys.push(key);
      }
    }

    return commonKeys;
  }

  private getObjectKeys(obj: any, prefix = ''): string[] {
    const keys: string[] = [];
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const newPrefix = prefix ? `${prefix}.${key}` : key;
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          keys.push(...this.getObjectKeys(obj[key], newPrefix));
        } else {
          keys.push(newPrefix);
        }
      }
    }
    return keys;
  }
}
