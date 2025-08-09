import React, { useState } from 'react';
import { Terminal, UploadCloud, HelpCircle, Settings, FileCode } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from '@/components/ui/card';
import { HarUpload } from '@/components/HarUpload';
import { ProcessingPipeline } from '@/components/ProcessingPipeline';
import { CodeOutput } from '@/components/CodeOutput';
import { AsyncHarProcessor } from '@/services/AsyncHarProcessor';
import { Button } from '@/components/ui/button';
import { InfoModal } from '@/components/InfoModal';
import { Link } from 'react-router-dom';
import {
  ResizablePanel,
  ResizablePanelGroup,
  ResizableHandle,
} from "@/components/ui/resizable";
import { AnalysisModeService } from '@/services/AnalysisMode';
import { toast } from "sonner";
import { errorMapping } from '@/services/errorMapping';

import { DetectedToken, ProcessingMetrics } from "@/services/types";
import { MatchedPattern } from "@/flow-analysis/types";

interface ProcessingState {
  isProcessing: boolean;
  currentStep: number;
  progress: number;
  result: {
    loliCode: string;
    analysis: {
      metrics: ProcessingMetrics;
      tokensDetected: Map<string, DetectedToken[]>;
      criticalPath: string[];
      matchedPatterns: MatchedPattern[];
      warnings: string[];
    };
  } | null;
  filename: string;
}

const PIPELINE_STEPS = [
    { id: 'parsing', title: 'Parsing HAR' },
    { id: 'scoring', title: 'Scoring & Filtering' },
    { id: 'dependency-analysis', title: 'Dependency Analysis' },
    { id: 'behavioral-analysis', title: 'Behavioral Analysis' },
    { id: 'optimization', title: 'Request Optimization' },
    { id: 'mfa-analysis', title: 'MFA Analysis' },
    { id: 'token-detection', title: 'Token Detection' },
    { id: 'code-generation', title: 'Code Generation' }
];

const Index = () => {
  const [processing, setProcessing] = useState<ProcessingState>({
    isProcessing: false,
    currentStep: 0,
    progress: 0,
    result: null,
    filename: ''
  });
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleProcessing = async (file: File, content: string) => {
    console.log("handleProcessing called with file:", file.name);
    setProcessing({ isProcessing: true, filename: file.name, currentStep: 0, progress: 0, result: null });

    const progressCallback = (progress: number, stage: string) => {
      const currentStepIndex = PIPELINE_STEPS.findIndex(step => step.id === stage);
      setProcessing(prev => ({ ...prev, currentStep: currentStepIndex, progress }));
    };

    try {
      const config = AnalysisModeService.getDefaultConfiguration();
      const result = await AsyncHarProcessor.processHarFileStreaming(content, config, progressCallback);
      const { loliCode, metrics, detectedTokens, behavioralFlows, warnings } = result;
      const processedResult = {
        loliCode,
        analysis: {
          metrics: metrics,
          tokensDetected: detectedTokens,
          criticalPath: [], // This needs to be derived differently now
          matchedPatterns: behavioralFlows,
          warnings: warnings || [],
        },
      };
      setProcessing(prev => ({ ...prev, result: processedResult, isProcessing: false, progress: 100, currentStep: PIPELINE_STEPS.length }));
    } catch (error: unknown) {
      console.error('Processing failed:', error);
            const errorType = error?.constructor as new () => Error;
      const errorInfo = errorMapping.get(errorType) || { title: 'Analysis Failed', description: 'An unknown error occurred. Please check the console for more details.' };
      toast.error(errorInfo.title, { description: errorInfo.description });
      setProcessing(prev => ({ ...prev, isProcessing: false, progress: 0, currentStep: 0 }));
    }
  };

  const resetProcessor = () => {
    setProcessing({ isProcessing: false, currentStep: 0, progress: 0, result: null, filename: '' });
  };

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <InfoModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      <header className="h-16 flex-shrink-0 bg-background sticky top-0 z-20 header-gold-border">
        <div className="container mx-auto px-4 sm:px-6 h-full flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-wider uppercase text-gold-gradient">
            HAR2LOLICODE
          </h1>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full bg-primary transition-all duration-500 ${processing.isProcessing ? 'animate-pulse' : 'opacity-20'}`} />
              <span className="text-sm text-muted-foreground">
                {processing.isProcessing ? 'Processing...' : 'Idle'}
              </span>
            </div>
            <Avatar className="h-9 w-9 border-2 border-primary/50">
              <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
              <AvatarFallback>CN</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      <main className="flex-grow overflow-auto">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
            <div className="flex flex-col h-full p-4 space-y-6">
              <HarUpload onFileSelect={handleProcessing} isProcessing={processing.isProcessing} />
              {(processing.isProcessing || processing.result) && (
                <Card className="bg-card/50 border-border/50 p-4 shadow-sm flex-grow">
                  <h3 className="text-md font-semibold mb-4 text-center">Processing Pipeline</h3>
                  <ProcessingPipeline
                    steps={PIPELINE_STEPS.map((step, index) => ({
                      ...step,
                      status: index < processing.currentStep ? 'complete' : index === processing.currentStep && processing.isProcessing ? 'processing' : 'pending'
                    }))}
                    currentStep={processing.currentStep}
                    progress={processing.progress}
                  />
                </Card>
              )}
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={55} minSize={30}>
            <div className="flex flex-col h-full p-4">
              {processing.result ? (
                <div className="flex flex-col h-full space-y-4">
                  <CodeOutput analysisResult={processing.result} filename={processing.filename} />
                  <div className="flex justify-center">
                    <Button onClick={resetProcessor} className="transition-glow">Process Another File</Button>
                  </div>
                </div>
              ) : (
                <Card className="flex-grow flex flex-col items-center justify-center p-12 text-center bg-card/50 border-border/50 border-dashed">
                  <div className="animate-pulse-glow mb-6"><UploadCloud className="h-20 w-20 text-primary" /></div>
                  <h3 className="text-2xl font-bold text-foreground mb-2">Analysis Workspace</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">Upload a HAR file to begin.</p>
                </Card>
              )}
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={25} minSize={15} maxSize={35}>
            <div className="flex flex-col h-full p-4 space-y-4">
               <Card className="flex-grow flex flex-col items-center justify-center p-12 text-center bg-card/50 border-border/50 border-dashed">
                  <div className="mb-6"><Settings className="h-20 w-20 text-muted-foreground/50" /></div>
                  <h3 className="text-2xl font-bold text-muted-foreground/80 mb-2">Inspector</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">Contextual tools will appear here based on your selection.</p>
                </Card>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </main>
    </div>
  );
};

export default Index;
