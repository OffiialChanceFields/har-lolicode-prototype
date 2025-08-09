import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, Clipboard, AlertTriangle } from 'lucide-react';
import { toast } from "sonner";
import { OB2ConfigurationResult } from '@/services/types';

interface CodeOutputProps {
  analysisResult: OB2ConfigurationResult;
  filename: string;
}

export const CodeOutput: React.FC<CodeOutputProps> = ({ analysisResult, filename }) => {
  if (!analysisResult) {
    return null;
  }

  const { loliCode, metrics, warnings } = analysisResult;

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
            {warnings.length > 0 && (
                <TabsTrigger value="warnings" className="text-yellow-500">
                    <AlertTriangle className="h-4 w-4 mr-2"/>
                    Warnings ({warnings.length})
                </TabsTrigger>
            )}
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
          <Card>
            <CardHeader><CardTitle>Processing Metrics</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <p><span className="font-semibold">Total Requests:</span> {metrics.totalRequests}</p>
                <p><span className="font-semibold">Critical Requests:</span> {metrics.criticalRequests}</p>
                <p><span className="font-semibold">Processing Time:</span> {metrics.processingTime} ms</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="warnings" className="p-6">
            <Card>
                <CardHeader><CardTitle>Warnings</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                    {warnings.map((warning, i) => (
                        <div key={i} className="p-3 bg-yellow-900/50 border border-yellow-700/50 rounded-lg text-sm">
                            {warning}
                        </div>
                    ))}
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </Card>
  );
};
