import { Entry } from 'har-format';
import { MFAAnalysisResult, MFAPattern, MFAType } from './types';

export class MFAFlowAnalyzer {
  private readonly mfaPatterns: Map<MFAType, MFAPattern>;

  constructor() {
    this.mfaPatterns = new Map();
    this.initializeMFAPatterns();
  }

  private initializeMFAPatterns(): void {
    this.mfaPatterns.set(MFAType.TOTP, {
      type: MFAType.TOTP,
      requestPattern: /2fa|two_factor|totp/,
      verificationPattern: /verify/
    });
    // Add other MFA patterns here
  }

  public analyzeMFAFlow(requests: Entry[]): MFAAnalysisResult[] {
    const detectedMFATypes = this.detectMFATypes(requests);
    return detectedMFATypes.map((mfaType) => {
      const pattern = this.mfaPatterns.get(mfaType);
      if (!pattern) {
        throw new Error(`No MFA pattern found for type: ${mfaType}`);
      }
      return {
        mfaType,
        generatedCode: this.generateMFAHandlingCode(pattern, requests)
      };
    });
  }

  private detectMFATypes(requests: Entry[]): MFAType[] {
    const detected: Set<MFAType> = new Set();
    for (const request of requests) {
      for (const [type, pattern] of this.mfaPatterns.entries()) {
        if (pattern.requestPattern.test(request.request.url)) {
          detected.add(type);
        }
      }
    }
    return Array.from(detected);
  }

  private generateMFAHandlingCode(
    pattern: MFAPattern,
    requests: Entry[]
  ): string {
    switch (pattern.type) {
      case MFAType.TOTP:
        return this.generateTOTPHandling(pattern, requests);
      case MFAType.SMS:
        return this.generateSMSHandling(pattern, requests);
      case MFAType.EMAIL:
        return this.generateEmailHandling(pattern, requests);
      case MFAType.PUSH_NOTIFICATION:
        return this.generatePushNotificationHandling(pattern, requests);
      default:
        return this.generateGenericMFAHandling(pattern, requests);
    }
  }

  private generateTOTPHandling(
    pattern: MFAPattern,
    requests: Entry[]
  ): string {
    return `// TOTP handling code for requests matching ${pattern.requestPattern}`;
  }

  private generateSMSHandling(
    pattern: MFAPattern,
    requests: Entry[]
  ): string {
    return `// SMS handling code for requests matching ${pattern.requestPattern}`;
  }

  private generateEmailHandling(
    pattern: MFAPattern,
    requests: Entry[]
  ): string {
    return `// Email handling code for requests matching ${pattern.requestPattern}`;
  }

  private generatePushNotificationHandling(
    pattern: MFAPattern,
    requests: Entry[]
  ): string {
    return `// Push notification handling code for requests matching ${pattern.requestPattern}`;
  }

  private generateGenericMFAHandling(
    pattern: MFAPattern,
    requests: Entry[]
  ): string {
    return `// Generic MFA handling code for requests matching ${pattern.requestPattern}`;
  }
}
