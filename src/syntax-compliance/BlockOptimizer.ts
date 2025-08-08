// src/syntax-compliance/BlockOptimizer.ts
import { HarEntry, OB2BlockDefinition, DetectedToken } from '../services/types';
import { PatternMatch } from '../flow-analysis/BehavioralPatternMatcher';
import { BehavioralFlow } from '../flow-analysis/types';
import { AdaptiveExtractor } from '../services/extraction/AdaptiveExtractor';
import { ExtractionStrategy } from '../services/extraction/types';

export class BlockOptimizer {
  private readonly adaptiveExtractor: AdaptiveExtractor;

  constructor() {
    this.adaptiveExtractor = new AdaptiveExtractor();
  }

  optimizeBlockSequence(
    requests: HarEntry[],
    patternMatches: BehavioralFlow[],
    templateType: string
  ): { blocks: OB2BlockDefinition[], strategies: ExtractionStrategy[] } {
    const blocks: OB2BlockDefinition[] = [];
    
    // Determine the most relevant pattern
    const primaryPattern = patternMatches.length > 0 ? patternMatches[0] : null;
    let generatedResult: { blocks: OB2BlockDefinition[], strategies: ExtractionStrategy[] };
    
    // Generate blocks based on template type
    switch (templateType) {
      case 'SINGLE_REQUEST_TEMPLATE':
        if (requests.length > 0) {
            const singleBlock = this.createHttpRequestBlock(requests[0]);
            generatedResult = { blocks: [singleBlock], strategies: [] };
        } else {
            generatedResult = { blocks: [], strategies: [] };
        }
        break;
        
      case 'AUTHENTICATION_FAILURE_TEMPLATE':
        generatedResult = { blocks: this.createAuthFailureTemplate(requests), strategies: [] };
        break;
        
      case 'AUTHENTICATION_SUCCESS_TEMPLATE':
        generatedResult = { blocks: this.createAuthSuccessTemplate(requests, primaryPattern), strategies: [] };
        break;
        
      case 'MULTI_STEP_FLOW_TEMPLATE':
        generatedResult = this.createMultiStepFlowTemplate(requests, patternMatches);
        break;
        
      case 'GENERIC_TEMPLATE':
      default:
        generatedResult = { blocks: this.createGenericTemplate(requests), strategies: [] };
        break;
    }
    
    const optimized = this.optimizeBlocks(generatedResult.blocks, generatedResult.strategies);

    // Optimize block sequence
    return { blocks: optimized, strategies: generatedResult.strategies };
  }
  
  optimizeBlocks(blocks: OB2BlockDefinition[], allStrategies: ExtractionStrategy[]): OB2BlockDefinition[] {
    // Remove duplicate blocks
    const uniqueBlocks = this.removeDuplicateBlocks(blocks);
    
    // Group related requests
    const groupedBlocks = this.groupRelatedRequests(uniqueBlocks);
    
    // Optimize variable usage
    const optimizedBlocks = this.optimizeVariableUsage(groupedBlocks);
    
    return optimizedBlocks;
  }
  
  private removeDuplicateBlocks(blocks: OB2BlockDefinition[]): OB2BlockDefinition[] {
    const seen = new Map<string, OB2BlockDefinition>();
    
    blocks.forEach(block => {
      const key = this.getBlockKey(block);
      if (!seen.has(key) || block.blockType === 'Parse') {
        seen.set(key, block);
      }
    });
    
    return Array.from(seen.values());
  }
  
  private groupRelatedRequests(blocks: OB2BlockDefinition[]): OB2BlockDefinition[] {
    const result: OB2BlockDefinition[] = [];
    let currentGroup: OB2BlockDefinition[] = [];
    
    blocks.forEach((block, index) => {
      if (block.blockType === 'HttpRequest') {
        if (currentGroup.length > 0) {
          result.push(...this.createRequestGroup(currentGroup));
          currentGroup = [];
        }
        currentGroup.push(block);
      } else if (block.blockType === 'Parse' && index === blocks.length - 1) {
        // Last parse block
        currentGroup.push(block);
        result.push(...this.createRequestGroup(currentGroup));
      } else if (block.blockType === 'Parse') {
        currentGroup.push(block);
      } else {
        if (currentGroup.length > 0) {
          result.push(...this.createRequestGroup(currentGroup));
          currentGroup = [];
        }
        result.push(block);
      }
    });
    
    return result;
  }
  
  private createRequestGroup(blocks: OB2BlockDefinition[]): OB2BlockDefinition[] {
    if (blocks.length === 1) {
      return blocks;
    }
    
    const httpRequestBlock = blocks.find(b => b.blockType === 'HttpRequest');
    const parseBlocks = blocks.filter(b => b.blockType === 'Parse');
    
    if (!httpRequestBlock) {
      return blocks;
    }
    
    // Create a single HTTP request block with all parse operations
    const enhancedBlock: OB2BlockDefinition = {
      ...httpRequestBlock,
      parameters: new Map(httpRequestBlock.parameters),
    };
    
    return [enhancedBlock];
  }
  
  private optimizeVariableUsage(blocks: OB2BlockDefinition[]): OB2BlockDefinition[] {
    // Track variable usage
    const variableUsage = new Map<string, number>();
    
    blocks.forEach(block => {
      if (block.blockType === 'Parse') {
        const variable = block.parameters.get('variable') || '';
        variableUsage.set(variable, (variableUsage.get(variable) || 0) + 1);
      }
    });
    
    // Replace single-use variables with direct captures
    return blocks.map(block => {
      if (block.blockType === 'Parse') {
        const variable = block.parameters.get('variable') || '';
        if (variableUsage.get(variable) === 1) {
          return {
            ...block,
            parameters: new Map([
              ...Array.from(block.parameters.entries()),
              ['directCapture', 'true']
            ])
          };
        }
      }
      return block;
    });
  }
  
  private getBlockKey(block: OB2BlockDefinition): string {
    switch (block.blockType) {
      case 'HttpRequest':
        return `HttpRequest:${block.parameters.get('method') || 'GET'}:${block.parameters.get('url') || ''}`;
      case 'Parse':
        return `Parse:${block.parameters.get('selector') || ''}:${block.parameters.get('attribute') || ''}`;
      default:
        return block.blockType;
    }
  }
  
  private createHttpRequestBlock(request: HarEntry): OB2BlockDefinition {
    const headers = request.request.headers.map(h => ({
      name: h.name,
      value: h.value
    }));
    
    const cookies = request.request.cookies.map(c => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path
    }));
    
    const parameters = new Map<string, string>();
    parameters.set('method', request.request.method);
    parameters.set('url', request.request.url);
    parameters.set('headers', JSON.stringify(headers));
    parameters.set('cookies', JSON.stringify(cookies));
    
    if (request.request.postData) {
      parameters.set('postData', JSON.stringify(request.request.postData));
    }
    
    return {
      blockType: 'HttpRequest',
      parameters,
    };
  }
  
  private createParseBlockFromStrategy(strategy: ExtractionStrategy): OB2BlockDefinition {
    return {
      blockType: 'Parse',
      parameters: new Map([
        ['variable', strategy.primary.variableName],
        ['selector', strategy.primary.expression],
        ['type', strategy.primary.type],
        // Fallbacks can be handled by the code generator later
      ]),
    };
  }

  private createParseBlockFromToken(token: DetectedToken): OB2BlockDefinition {
    return {
      blockType: 'Parse',
      parameters: new Map([
        ['variable', token.name],
        ['selector', `input[name='${token.name}']`],
        ['attribute', 'value'],
        ['type', 'CSS'],
      ]),
    };
  }
  
  private createAuthFailureTemplate(requests: HarEntry[]): OB2BlockDefinition[] {
    const blocks: OB2BlockDefinition[] = [];
    
    // Find the failed request
    const failedRequest = requests.find(r => 
      r.response.status >= 400 && r.response.status < 500
    );
    
    if (!failedRequest) {
      return this.createGenericTemplate(requests);
    }
    
    // Add retry logic
    blocks.push({
      blockType: 'BeginScript',
      parameters: new Map(),
    });
    
    // Set retry parameters
    blocks.push({
      blockType: 'SetVariable',
      parameters: new Map([
        ['variable', 'retryCount'],
        ['value', '0']
      ]),
    });
    
    blocks.push({
      blockType: 'SetVariable',
      parameters: new Map([
        ['variable', 'maxRetries'],
        ['value', '3']
      ]),
    });
    
    // While loop
    blocks.push({
      blockType: 'While',
      parameters: new Map([
        ['condition', 'retryCount < maxRetries'],
      ]),
    });
    
    blocks.push({
      blockType: 'EndScript',
      parameters: new Map(),
    });
    
    return blocks;
  }
  
  private createAuthSuccessTemplate(
    requests: HarEntry[],
    primaryPattern: BehavioralFlow | null
  ): OB2BlockDefinition[] {
    const blocks: OB2BlockDefinition[] = [];
    
    if (primaryPattern) {
      return this.createPatternBasedAuthTemplate(requests, primaryPattern);
    }
    
    // Generate step-by-step authentication
    const authSteps = this.identifyAuthenticationSteps(requests);
    authSteps.forEach((step, index) => {
      blocks.push(this.createHttpRequestBlock(step));
    });
    
    return blocks;
  }
  
  private createPatternBasedAuthTemplate(
    requests: HarEntry[],
    pattern: BehavioralFlow
  ): OB2BlockDefinition[] {
    const blocks: OB2BlockDefinition[] = [];
    
    pattern.steps.forEach((step: HarEntry, index: number) => {
      blocks.push(this.createHttpRequestBlock(step));
    });
    
    return blocks;
  }
  
  private createMultiStepFlowTemplate(
    requests: HarEntry[],
    patternMatches: BehavioralFlow[]
  ): { blocks: OB2BlockDefinition[], strategies: ExtractionStrategy[] } {
    const blocks: OB2BlockDefinition[] = [];
    const strategies: ExtractionStrategy[] = [];
    
    // Initialize variables
    const allTokens = new Set<string>();
    
    allTokens.forEach(tokenName => {
      blocks.push({
        blockType: 'SetVariable',
        parameters: new Map([
          ['variable', tokenName],
          ['value', '']
        ]),
      });
    });
    
    // Generate code for each behavioral flow
    patternMatches.forEach(flow => {
      flow.steps.forEach((step, index) => {
        blocks.push(this.createHttpRequestBlock(step));

        // Adaptive extraction
        if (step.response.content?.text) {
          const newStrategies = this.adaptiveExtractor.createExtractors([step.response.content.text]);
          strategies.push(...newStrategies);
          for (const strategy of newStrategies) {
            blocks.push(this.createParseBlockFromStrategy(strategy));
          }
        }
        
        // Add any extracted data as variables
        if (index === 0 && flow.extractedData) {
          Object.entries(flow.extractedData).forEach(([key, value]) => {
            if (typeof value === 'string') {
              blocks.push({
                blockType: 'SetVariable',
                parameters: new Map([
                  ['variable', key],
                  ['value', value]
                ]),
              });
            }
          });
        }
      });
    });
    
    // Generate remaining requests not part of flows
    const flowRequests = new Set(patternMatches.flatMap(f => f.steps));
    const remainingRequests = requests.filter(r => !flowRequests.has(r));
    
    remainingRequests.forEach(request => {
      blocks.push(this.createHttpRequestBlock(request));
    });
    
    return { blocks, strategies };
  }
  
  private createGenericTemplate(requests: HarEntry[]): OB2BlockDefinition[] {
    const blocks: OB2BlockDefinition[] = [];
    
    requests.forEach((request, index) => {
      blocks.push(this.createHttpRequestBlock(request));
    });
    
    return blocks;
  }
  
  private identifyAuthenticationSteps(requests: HarEntry[]): HarEntry[] {
    const steps: HarEntry[] = [];
    
    // Find login page load
    const loginPage = requests.find(r => 
      r.request.method === 'GET' &&
      /\/(login|signin|auth)/.test(r.request.url) &&
      r.response.status === 200
    );
    if (loginPage) steps.push(loginPage);
    
    // Find credential submission
    const credSubmission = requests.find(r => 
      r.request.method === 'POST' &&
      /\/(login|signin|authenticate|session)/.test(r.request.url)
    );
    if (credSubmission) steps.push(credSubmission);
    
    // Find redirect or success response
    const successResponse = requests.find(r => 
      (r.response.status === 302 || r.response.status === 200) &&
      r.response.headers.some(h => 
        h.name.toLowerCase() === 'set-cookie' &&
        (h.value.includes('session') || h.value.includes('auth'))
      )
    );
    if (successResponse && !steps.includes(successResponse)) {
      steps.push(successResponse);
    }
    
    // If no specific steps found, return all requests
    return steps.length > 0 ? steps : requests;
  }
}
