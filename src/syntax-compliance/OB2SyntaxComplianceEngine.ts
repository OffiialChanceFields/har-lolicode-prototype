import { HarEntry, OB2BlockDefinition, OB2ConfigurationResult } from '../services/types';
import { OB2SyntaxValidator } from './OB2SyntaxValidator';
import { BlockOptimizer } from './BlockOptimizer';
import { VariableLifecycleManager } from './VariableLifecycleManager';
import { FlowContextResult } from '../flow-analysis/types';

interface CatchBlock {
  condition: string;
  blocks: OB2BlockDefinition[];
}

export class OB2SyntaxComplianceEngine {
  private readonly syntaxValidator: OB2SyntaxValidator;
  private readonly blockOptimizer: BlockOptimizer;
  private readonly variableManager: VariableLifecycleManager;
  
  constructor() {
    this.syntaxValidator = new OB2SyntaxValidator();
    this.blockOptimizer = new BlockOptimizer();
    this.variableManager = new VariableLifecycleManager();
  }

  generateCompliantLoliCode(
    analysisResult: FlowContextResult,
    templateType: string = 'MULTI_STEP_FLOW_TEMPLATE'
  ): OB2ConfigurationResult {
    // Validate all syntax elements
    const syntaxValidation = this.syntaxValidator.validateAnalysisResult(analysisResult);
    if (!syntaxValidation.isValid) {
      throw new OB2SyntaxValidationError(syntaxValidation.violations);
    }
    
    // Generate optimized block structure
    const optimizedBlocks = this.blockOptimizer.optimizeBlockSequence(
      analysisResult.criticalPath, 
      analysisResult.matchedPatterns,
      templateType
    );
    
    // Manage variable lifecycle
    const variableMapping = this.variableManager.createVariableLifecycleMap(optimizedBlocks);
    
    // Add error handling
    // const enhancedBlocks = this.errorHandlingFramework.enhanceWithErrorHandling(
    //   optimizedBlocks,
    //   analysisResult.matchedPatterns
    // );
    
    return this.synthesizeOB2Configuration(optimizedBlocks, variableMapping, analysisResult);
  }
  
  private synthesizeOB2Configuration(
    blocks: OB2BlockDefinition[], 
    variableMapping: Map<string, string>,
    analysisResult: FlowContextResult
  ): OB2ConfigurationResult {
    const loliCode: string[] = [];
    
    // Add header comments
    loliCode.push('// Auto-generated LoliCode configuration');
    loliCode.push(`// Generated on: ${new Date().toISOString()}`);
    loliCode.push('// This configuration was automatically generated from HAR file analysis');
    loliCode.push('// Do not modify manually unless you know what you are doing');
    loliCode.push('');
    
    // Add variable declarations
    loliCode.push('// Variable declarations');
    variableMapping.forEach((variableType, variableName) => {
      loliCode.push(`VAR ${variableName} = ""  // ${variableType}`);
    });
    loliCode.push('');
    
    // Add main flow
    loliCode.push('// Main authentication flow');
    blocks.forEach(block => {
      switch (block.blockType) {
        case 'HttpRequest':
          loliCode.push(this.renderHttpRequestBlock(block));
          break;
        case 'Parse':
          loliCode.push(this.renderParseBlock(block));
          break;
        case 'SetVariable':
          loliCode.push(this.renderSetVariableBlock(block));
          break;
        case 'If':
          loliCode.push(this.renderIfBlock(block));
          break;
        case 'While':
          loliCode.push(this.renderWhileBlock(block));
          break;
        case 'Try':
          loliCode.push(this.renderTryBlock(block));
          break;
        case 'Delay':
          loliCode.push(this.renderDelayBlock(block));
          break;
        case 'Log':
          loliCode.push(this.renderLogBlock(block));
          break;
        case 'Mark':
          loliCode.push(this.renderMarkBlock(block));
          break;
      }
      
      loliCode.push('');
    });
    
    return {
      loliCode: loliCode.join('\n'),
      blocks,
      variables: variableMapping,
      metrics: analysisResult.metrics,
      warnings: analysisResult.warnings
    };
  }
  
  private renderHttpRequestBlock(block: OB2BlockDefinition): string {
    const lines: string[] = [];
    
    // Add comments
    if (block.parameters.get('comment')) {
      lines.push(`// ${block.parameters.get('comment')}`);
    }
    
    // Add method and URL
    const method = block.parameters.get('method') || 'GET';
    const url = block.parameters.get('url') || '';
    
    if (method === 'GET') {
      lines.push(`REQUEST GET "${this.escapeValue(url)}"`);
    } else if (method === 'POST' && block.parameters.has('postData')) {
      lines.push(`REQUEST POST "${this.escapeValue(url)}"`);
    } else {
      lines.push(`REQUEST ${method} "${this.escapeValue(url)}"`);
    }
    
    // Add headers
    if (block.parameters.has('headers')) {
      const headers = JSON.parse(block.parameters.get('headers')!);
      headers.forEach((header: { name: string; value: string }) => {
        lines.push(`HEADER "${this.escapeValue(header.name)}" "${this.escapeValue(header.value)}"`);
      });
    }
    
    // Add cookies
    if (block.parameters.has('cookies')) {
      const cookies = JSON.parse(block.parameters.get('cookies')!);
      cookies.forEach((cookie: { name: string; value: string; domain: string; path: string }) => {
        const domainPart = cookie.domain ? `DOMAIN="${this.escapeValue(cookie.domain)}"` : '';
        const pathPart = cookie.path ? `PATH="${this.escapeValue(cookie.path)}"` : '';
        const parts = [domainPart, pathPart].filter(p => p).join(' ');
        
        lines.push(`COOKIE "${this.escapeValue(cookie.name)}" "${this.escapeValue(cookie.value)}" ${parts}`);
      });
    }
    
    // Add post data
    if (block.parameters.has('postData')) {
      const postData = JSON.parse(block.parameters.get('postData')!);
      
      if (postData.mimeType.includes('application/json')) {
        lines.push(`CONTENT "${postData.mimeType}"`);
        lines.push(`DATA "${this.escapeValue(postData.text || '')}"`);
      } else if (postData.mimeType.includes('application/x-www-form-urlencoded')) {
        lines.push('CONTENT "application/x-www-form-urlencoded"');
        if (postData.params) {
          const formData = postData.params.map((p: { name: string, value: string }) => 
            `${p.name}=${encodeURIComponent(p.value || '')}`
          ).join('&');
          lines.push(`DATA "${formData}"`);
        } else if (postData.text) {
          lines.push(`DATA "${this.escapeValue(postData.text)}"`);
        }
      } else if (postData.mimeType.includes('multipart/form-data')) {
        lines.push('CONTENT "multipart/form-data"');
        if (postData.params) {
          postData.params.forEach((param: { name: string, value: string, fileName?: string, contentType?: string }) => {
            if (param.fileName) {
              lines.push(`MULTIPART "${this.escapeValue(param.name)}" FILE "${this.escapeValue(param.fileName)}" "${param.contentType || 'application/octet-stream'}"`);
            } else {
              lines.push(`MULTIPART "${this.escapeValue(param.name)}" TEXT "${this.escapeValue(param.value || '')}"`);
            }
          });
        }
      } else {
        lines.push(`CONTENT "${postData.mimeType}"`);
        lines.push(`DATA "${this.escapeValue(postData.text || '')}"`);
      }
    }
    
    return lines.join('\n');
  }
  
  private renderParseBlock(block: OB2BlockDefinition): string {
    const lines: string[] = [];
    
    // Add comments
    if (block.parameters.get('comment')) {
      lines.push(`// ${block.parameters.get('comment')}`);
    }
    
    // Add parse statement
    const variable = block.parameters.get('variable') || 'token';
    const selector = block.parameters.get('selector') || '';
    const attribute = block.parameters.get('attribute') || '';
    
    if (attribute) {
      lines.push(`PARSE "${this.escapeValue(variable)}" CSS "${this.escapeValue(selector)}" ATTRIBUTE "${this.escapeValue(attribute)}"`);
    } else {
      lines.push(`PARSE "${this.escapeValue(variable)}" CSS "${this.escapeValue(selector)}"`);
    }
    
    return lines.join('\n');
  }
  
  private renderSetVariableBlock(block: OB2BlockDefinition): string {
    const variable = block.parameters.get('variable') || 'var';
    const value = block.parameters.get('value') || '';
    
    return `SET ${this.escapeValue(variable)} = "${this.escapeValue(value)}"`;
  }
  
  private renderIfBlock(block: OB2BlockDefinition): string {
    const condition = block.parameters.get('condition') || 'true';
    const thenBlocks = block.parameters.get('thenBlocks') || '[]';
    
    const lines: string[] = [];
    lines.push(`IF ${condition}`);
    
    // Add then blocks
    JSON.parse(thenBlocks).forEach((block: OB2BlockDefinition) => {
      lines.push(`  ${this.renderBlockContent(block)}`);
    });
    
    if (block.parameters.has('elseBlocks')) {
      const elseBlocks = block.parameters.get('elseBlocks') || '[]';
      lines.push('ELSE');
      
      // Add else blocks
      JSON.parse(elseBlocks).forEach((block: OB2BlockDefinition) => {
        lines.push(`  ${this.renderBlockContent(block)}`);
      });
    }
    
    lines.push('END IF');
    
    return lines.join('\n');
  }
  
  private renderWhileBlock(block: OB2BlockDefinition): string {
    const condition = block.parameters.get('condition') || 'true';
    const bodyBlocks = block.parameters.get('bodyBlocks') || '[]';
    
    const lines: string[] = [];
    lines.push(`WHILE ${condition}`);
    
    // Add body blocks
    JSON.parse(bodyBlocks).forEach((block: OB2BlockDefinition) => {
      lines.push(`  ${this.renderBlockContent(block)}`);
    });
    
    lines.push('END WHILE');
    
    return lines.join('\n');
  }
  
  private renderTryBlock(block: OB2BlockDefinition): string {
    const tryBlocks = block.parameters.get('tryBlocks') || '[]';
    const catchBlocks = block.parameters.get('catchBlocks') || '[]';
    const finallyBlocks = block.parameters.get('finallyBlocks') || '[]';
    
    const lines: string[] = [];
    lines.push('TRY');
    
    // Add try blocks
    JSON.parse(tryBlocks).forEach((block: OB2BlockDefinition) => {
      lines.push(`  ${this.renderBlockContent(block)}`);
    });
    
    // Add catch blocks
    JSON.parse(catchBlocks).forEach((catchBlock: CatchBlock) => {
      lines.push(`CATCH IF ${catchBlock.condition}`);
      catchBlock.blocks.forEach((block: OB2BlockDefinition) => {
        lines.push(`  ${this.renderBlockContent(block)}`);
      });
    });
    
    if (finallyBlocks && JSON.parse(finallyBlocks).length > 0) {
      lines.push('FINALLY');
      JSON.parse(finallyBlocks).forEach((block: OB2BlockDefinition) => {
        lines.push(`  ${this.renderBlockContent(block)}`);
      });
    }
    
    lines.push('END TRY');
    
    return lines.join('\n');
  }
  
  private renderDelayBlock(block: OB2BlockDefinition): string {
    const milliseconds = block.parameters.get('milliseconds') || '1000';
    return `WAIT ${milliseconds}`;
  }
  
  private renderLogBlock(block: OB2BlockDefinition): string {
    const message = block.parameters.get('message') || '';
    return `LOG "${this.escapeValue(message)}"`;
  }
  
  private renderMarkBlock(block: OB2BlockDefinition): string {
    const status = block.parameters.get('status') || 'SUCCESS';
    const message = block.parameters.get('message') || '';
    
    if (message) {
      return `MARK ${status} "${this.escapeValue(message)}"`;
    }
    
    return `MARK ${status}`;
  }
  
  private renderBlockContent(block: OB2BlockDefinition): string {
    switch (block.blockType) {
      case 'HttpRequest': return this.renderHttpRequestBlock(block).split('\n')[0];
      case 'Parse': return this.renderParseBlock(block);
      case 'SetVariable': return this.renderSetVariableBlock(block);
      case 'Delay': return this.renderDelayBlock(block);
      case 'Log': return this.renderLogBlock(block);
      case 'Mark': return this.renderMarkBlock(block);
      default: return `// ${block.blockType} block`;
    }
  }
  
  private escapeValue(value: string): string {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }
}

class OB2SyntaxValidationError extends Error {
  constructor(public violations: string[]) {
    super(`OB2 Syntax Validation Failed: ${violations.join(', ')}`);
  }
}
