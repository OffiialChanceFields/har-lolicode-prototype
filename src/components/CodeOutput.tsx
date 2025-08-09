import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, Clipboard, BarChart, FileText, Bot, Copy, GitBranch, AlertTriangle, Timer } from 'lucide-react';
import { toast } from "sonner";
import { DetectedToken, ProcessingMetrics } from '@/services/types';
import { MatchedPattern } from '@/flow-analysis/types';
import { Progress } from './ui/progress';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

// Custom theme for syntax highlighting based on the design system
const goldSyntaxTheme = {
  'code[class*="language-"]': {
    color: '#f8f8f2',
    background: '#0A0A0A',
    fontFamily: "Menlo, Monaco, 'Courier New', monospace",
    fontSize: '14px',
    lineHeight: '1.5',
    whiteSpace: 'pre-wrap',
  },
  'pre[class*="language-"]': {
    color: '#f8f8f2',
    background: '#0A0A0A',
    fontFamily: "Menlo, Monaco, 'Courier New', monospace",
    fontSize: '14px',
    lineHeight: '1.5',
    padding: '1em',
    margin: '0',
    overflow: 'auto',
    borderRadius: '0 0 0.5rem 0.5rem',
  },
  'comment': { color: '#B8860B' },
  'string': { color: '#FFC107' },
  'keyword': { color: '#FFD700' },
  'function': { color: '#FFE55C' },
  'variable': { color: '#FFE55C' },
  'number': { color: '#FFC107' },
  'operator': { color: '#FFD700' },
  'punctuation': { color: '#f8f8f2' },
  'className': { color: '#FFE55C' },
};

interface AnalysisDetails {
  metrics: ProcessingMetrics;
  tokensDetected: Map<string, DetectedToken[]>;
  criticalPath: string[];
  matchedPatterns: MatchedPattern[];
  warnings: string[];
}

interface AnalysisResult {
  loliCode: string;
  analysis: AnalysisDetails;
}

interface CodeOutputProps {
  analysisResult: AnalysisResult;
  filename: string;
}

const MetricCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode }> = ({ title, value, icon }) => (
  <Card className="bg-card/80 border-border/50">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      {icon}
    </CardHeader>
    <CardContent>
      <div className="text-4xl font-bold text-primary">{value}</div>
    </CardContent>
  </Card>
);

const TokensTable: React.FC<{ tokens: Map<string, DetectedToken[]> }> = ({ tokens }) => {
    const allTokens = Array.from(tokens.values()).flat();

    if (allTokens.length === 0) {
      return <p className="text-muted-foreground text-center">No tokens detected.</p>;
    }

    const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
      toast.success("Token value copied!");
    };

    return (
      <div className="overflow-x-auto">
          <table className="w-full text-sm">
              <thead className="border-b border-border/50">
                  <tr>
                      <th className="text-left p-2 font-medium text-muted-foreground">Name</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">Value</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">Type</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">Source</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">Confidence</th>
                  </tr>
              </thead>
              <tbody>
                  {allTokens.map((token, index) => (
                      <tr key={index} className="border-b border-border/20 hover:bg-muted/40">
                          <td className="p-2 font-mono text-primary">{token.name}</td>
                          <td className="p-2 font-mono text-accent flex items-center">
                              <span className="truncate max-w-xs">{token.value}</span>
                              <Button variant="ghost" size="icon" className="h-6 w-6 ml-2" onClick={() => copyToClipboard(token.value)}>
                                  <Copy className="h-3 w-3" />
                              </Button>
                          </td>
                          <td className="p-2">{token.type}</td>
                          <td className="p-2 capitalize">{token.source}</td>
                          <td className="p-2">
                              <Progress value={token.confidence} className="h-2 bg-muted" />
                              <span className="text-xs text-muted-foreground">{token.confidence.toFixed(0)}%</span>
                          </td>
                      </tr>
                  ))}
              </tbody>
          </table>
      </div>
    );
};

const FlowsDisplay: React.FC<{ patterns: MatchedPattern[] }> = ({ patterns }) => {
    if (patterns.length === 0) {
        return <p className="text-muted-foreground text-center">No behavioral flows detected.</p>;
    }

    return (
        <div className="space-y-4">
            {patterns.map((pattern, index) => (
                <Card key={index} className="bg-card/80 border-border/50">
                    <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                            <GitBranch className="h-5 w-5 text-primary" />
                            <span className="text-lg font-semibold">{pattern.patternId}</span>
                        </CardTitle>
                        <div className="flex items-center space-x-2">
                            <span className="text-sm text-muted-foreground">Confidence:</span>
                            <Progress value={pattern.confidence} className="w-32 h-2 bg-muted" />
                            <span className="text-sm font-bold text-primary">{pattern.confidence.toFixed(0)}%</span>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <h4 className="font-semibold mb-2">Steps in Flow:</h4>
                        <ul className="list-decimal list-inside space-y-1 text-sm">
                            {pattern.steps.map((step, stepIndex) => (
                                <li key={stepIndex} className="font-mono text-xs text-muted-foreground truncate">
                                    <span className="font-bold text-primary/80">{step.request.method}</span> {step.request.url}
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
};

export const CodeOutput: React.FC<CodeOutputProps> = ({ analysisResult, filename }) => {
  if (!analysisResult) return null;

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
    <Card className="bg-card border-border/50 shadow-lg h-full flex flex-col">
      <Tabs defaultValue="code" className="flex flex-col flex-grow">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/50">
          <TabsList className="bg-transparent p-0">
            <TabsTrigger value="code" className="data-[state=active]:bg-muted data-[state=active]:text-primary">LoliCode</TabsTrigger>
            <TabsTrigger value="metrics" className="data-[state=active]:bg-muted data-[state=active]:text-primary">Metrics</TabsTrigger>
            <TabsTrigger value="tokens" className="data-[state=active]:bg-muted data-[state=active]:text-primary">Tokens</TabsTrigger>
            <TabsTrigger value="flows" className="data-[state=active]:bg-muted data-[state=active]:text-primary">Behavioral Flows</TabsTrigger>
            <TabsTrigger value="warnings" className="data-[state=active]:bg-muted data-[state=active]:text-primary">Security Warnings</TabsTrigger>
          </TabsList>
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="icon" onClick={handleCopy}><Clipboard className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={handleDownload}><Download className="h-4 w-4" /></Button>
          </div>
        </div>
        <TabsContent value="code" className="flex-grow">
          <SyntaxHighlighter language="loli" style={goldSyntaxTheme} customStyle={{ height: '100%' }}>
            {loliCode}
          </SyntaxHighlighter>
        </TabsContent>
        <TabsContent value="metrics" className="p-6 bg-background/20 flex-grow">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <MetricCard title="Total Requests" value={analysis.metrics.totalRequests ?? 0} icon={<FileText className="h-5 w-5 text-muted-foreground" />} />
            <MetricCard title="Significant Requests" value={analysis.metrics.significantRequests ?? 0} icon={<FileText className="h-5 w-5 text-muted-foreground" />} />
            <MetricCard title="Tokens Detected" value={Array.from(analysis.tokensDetected.values()).flat().length} icon={<BarChart className="h-5 w-5 text-muted-foreground" />} />
            <MetricCard title="Patterns Matched" value={analysis.matchedPatterns.length} icon={<Bot className="h-5 w-5 text-muted-foreground" />} />
            <MetricCard title="Avg. Score" value={analysis.metrics.averageScore?.toFixed(2) ?? 0} icon={<BarChart className="h-5 w-5 text-muted-foreground" />} />
            <MetricCard title="Processing Time" value={`${analysis.metrics.processingTime?.toFixed(0) ?? 0} ms`} icon={<Timer className="h-5 w-5 text-muted-foreground" />} />
          </div>
        </TabsContent>
        <TabsContent value="tokens" className="p-6 bg-background/20 flex-grow">
          <TokensTable tokens={analysis.tokensDetected} />
        </TabsContent>
        <TabsContent value="flows" className="p-6 bg-background/20 flex-grow">
            <FlowsDisplay patterns={analysis.matchedPatterns} />
        </TabsContent>
        <TabsContent value="warnings" className="p-6 bg-background/20 flex-grow">
            {(analysis.warnings && analysis.warnings.length > 0) ? (
                <div className="space-y-4">
                    {analysis.warnings.map((warning, index) => (
                        <Alert key={index} variant="destructive" className="bg-destructive/10 border-destructive/50 text-destructive-foreground">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Warning</AlertTitle>
                            <AlertDescription>{warning}</AlertDescription>
                        </Alert>
                    ))}
                </div>
            ) : (
                <p className="text-muted-foreground text-center">No security warnings found.</p>
            )}
        </TabsContent>
      </Tabs>
    </Card>
  );
};
