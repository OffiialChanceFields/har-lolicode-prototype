import React from 'react';
import { SessionAnalysisView } from './SessionAnalysisView';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, Clipboard } from 'lucide-react';
import { toast } from "sonner";

import { SessionAnalysisResult } from '@/services/session/types';
import { DetectedToken } from '@/services/types';
import { SequenceRules } from '@/services/sequencing/types';
import { ExtractionStrategy } from '@/services/extraction/types';

interface AnalysisDetails {
  requestsFound: number;
  tokensDetected: number;
  criticalPath: string[];
  matchedPatterns: Record<string, unknown>[];
  sessionAnalysis?: SessionAnalysisResult;
  detectedTokens?: Map<string, DetectedToken[]>;
  sequenceRules?: SequenceRules;
  extractionStrategies?: ExtractionStrategy[];
}

interface AnalysisResult {
  loliCode: string;
  analysis: AnalysisDetails;
}

interface CodeOutputProps {
  analysisResult: AnalysisResult;
  filename: string;
}

export const CodeOutput: React.FC<CodeOutputProps> = ({ analysisResult, filename }) => {
  if (!analysisResult) {
    return null;
  }

  const { loliCode, analysis } = analysisResult;

  const handleCopy = () => {
    navigator.clipboard.writeText(loliCode);
    toast.success("LoliCode copied to clipboard!");
  };

  const handleDownload = () => {
    const blob = new Blob([loliCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename.replace('.har', '')}.loli`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="bg-gradient-glow border-border/50 shadow-elevation">
      <Tabs defaultValue="code">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
          <TabsList>
            <TabsTrigger value="code">LoliCode</TabsTrigger>
            <TabsTrigger value="analysis">Analysis</TabsTrigger>
            <TabsTrigger value="session">Session</TabsTrigger>
          </TabsList>
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="icon" onClick={handleCopy}><Clipboard className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={handleDownload}><Download className="h-4 w-4" /></Button>
          </div>
        </div>
        <TabsContent value="code">
          <SyntaxHighlighter language="loli" style={oneDark} customStyle={{ margin: 0, borderRadius: '0 0 0.5rem 0.5rem' }}>
            {loliCode}
          </SyntaxHighlighter>
        </TabsContent>
        <TabsContent value="analysis" className="p-6">
          <div className="grid grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>Metrics</CardTitle></CardHeader>
              <CardContent>
                <p>Requests Found: {analysis.requestsFound}</p>
                <p>Tokens Detected: {analysis.tokensDetected}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Critical Path</CardTitle></CardHeader>
              <CardContent className="text-sm overflow-auto max-h-40">
                <ul className="list-disc pl-5">
                  {analysis.criticalPath.map((url, i) => <li key={i} className="truncate">{url}</li>)}
                </ul>
              </CardContent>
            </Card>
            <div className="col-span-2">
                <Card>
                  <CardHeader><CardTitle>Detected Tokens</CardTitle></CardHeader>
                  <CardContent className="text-sm overflow-auto max-h-40">
                    <ul className="list-disc pl-5">
                      {analysis.detectedTokens && Array.from(analysis.detectedTokens.values()).flat().map((token, i) => (
                        <li key={i} className="truncate">
                          <strong>{token.name}:</strong> {token.value.substring(0, 30)}... (Confidence: {token.confidence.toFixed(2)})
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
            </div>
            <div className="col-span-2">
                <Card>
                  <CardHeader><CardTitle>Extraction Strategies</CardTitle></CardHeader>
                  <CardContent className="text-sm overflow-auto max-h-40">
                    <ul className="list-disc pl-5">
                      {analysis.extractionStrategies && analysis.extractionStrategies.map((strategy, i) => (
                        <li key={i} className="truncate">
                          <strong>{strategy.primary.variableName}:</strong> {strategy.primary.type} - {strategy.primary.expression}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
            </div>
            <div className="col-span-2">
                <Card>
                  <CardHeader><CardTitle>Sequencing Rules</CardTitle></CardHeader>
                  <CardContent className="text-sm overflow-auto max-h-40">
                    <p><strong>Prerequisites:</strong> {analysis.sequenceRules?.prerequisites.length}</p>
                    <p><strong>Parallelizable Groups:</strong> {analysis.sequenceRules?.parallelizable.length}</p>
                    <p><strong>Timing Requirements:</strong> {analysis.sequenceRules?.timingRequirements.length}</p>
                  </CardContent>
                </Card>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="session" className="p-6">
          <SessionAnalysisView sessionAnalysis={analysis.sessionAnalysis} />
        </TabsContent>
      </Tabs>
    </Card>
  );
};
