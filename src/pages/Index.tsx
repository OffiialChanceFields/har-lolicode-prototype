import React, { useState } from 'react';
import { Terminal, UploadCloud, HelpCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { HarUpload } from '@/components/HarUpload';
import { ProcessingPipeline } from '@/components/ProcessingPipeline';
import { CodeOutput } from '@/components/CodeOutput';
import { AsyncHarProcessor } from '@/services/AsyncHarProcessor';
import { Button } from '@/components/ui/button';
import { InfoModal } from '@/components/InfoModal';
import { Link } from 'react-router-dom';
import { AnalysisMode } from '@/services/AnalysisMode';
import { SessionAnalysisResult } from '@/services/session/types';
import { DetectedToken } from '@/services/types';
import { SequenceRules } from '@/services/sequencing/types';
import { ExtractionStrategy } from '@/services/extraction/types';
import { AnalysisModeSelector } from '@/components/AnalysisModeSelector';
import { toast } from "sonner";
import { errorMapping } from '@/services/errorMapping';

interface ProcessingState {
  isProcessing: boolean;
  currentStep: number;
  progress: number;
  result: {
    loliCode: string;
    analysis: {
      requestsFound: number;
      tokensDetected: number;
      criticalPath: string[];
      matchedPatterns: Record<string, unknown>[];
      sessionAnalysis?: SessionAnalysisResult;
      detectedTokens?: Map<string, DetectedToken[]>;
      sequenceRules?: SequenceRules;
      extractionStrategies?: ExtractionStrategy[];
    };
  } | null;
  filename: string;
}

const PIPELINE_STEPS = [
    { id: 'streaming', title: 'Reading HAR File' },
    { id: 'filtering', title: 'Filtering Requests' },
    { id: 'scoring', title: 'Scoring Requests' },
    { id: 'behavioral_analysis', title: 'Behavioral Analysis'},
    { id: 'analysis', title: 'Analyzing Dependencies' },
    { id: 'generation', title: 'Generating LoliCode' }
];

const Index = () => {
  const [processing, setProcessing] = useState<ProcessingState>({
    isProcessing: false,
    currentStep: 0,
    progress: 0,
    result: null,
    filename: ''
  });
  const [selectedMode, setSelectedMode] = useState<AnalysisMode.Predefined>(AnalysisMode.Predefined.AUTOMATIC);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleProcessing = async (file: File, content: string) => {
    setProcessing({ isProcessing: true, filename: file.name, currentStep: 0, progress: 0, result: null });

    const progressCallback = (progress: number, stage: string) => {
      const currentStepIndex = PIPELINE_STEPS.findIndex(step => step.id === stage);
      setProcessing(prev => ({ ...prev, currentStep: currentStepIndex, progress }));
    };

    try {
      const config = AnalysisMode.AnalysisModeService.getConfiguration(selectedMode);
      if (!config) {
        throw new Error(`Analysis mode ${selectedMode} not found`);
      }
      const result = await AsyncHarProcessor.processHarFileStreaming(content, config, progressCallback);
      const { loliCode, metrics, detectedTokens, behavioralFlows, sessionAnalysis, sequenceRules, extractionStrategies } = result;
      const processedResult = {
        loliCode,
        analysis: {
          requestsFound: metrics.significantRequests,
          tokensDetected: Array.from(detectedTokens.values()).flat().length,
          criticalPath: [], // This needs to be derived differently now
          matchedPatterns: behavioralFlows,
          sessionAnalysis,
          detectedTokens,
          sequenceRules,
          extractionStrategies,
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
    <div className="min-h-screen bg-background">
      <InfoModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      <header className="border-b border-border/50 bg-gradient-glow sticky top-0 z-10 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10 bg-primary/20 rounded-lg border border-primary/20">
              <Terminal className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-cyber bg-clip-text text-transparent">HAR2LoliCode</h1>
          </div>
          <div className="flex items-center space-x-4">
            <Link to="/har-converter">
                <Button variant="outline">
                    HAR to LoliCode Converter
                </Button>
            </Link>
            <Button variant="ghost" size="icon" onClick={() => setIsModalOpen(true)} className="transition-glow"><HelpCircle className="h-5 w-5" /></Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <AnalysisModeSelector selectedMode={selectedMode} onModeChange={setSelectedMode} />
            <HarUpload onFileSelect={handleProcessing} isProcessing={processing.isProcessing} />
            {(processing.isProcessing || processing.result) && (
              <Card className="bg-gradient-glow border-border/50 p-6 shadow-elevation">
                <h3 className="text-lg font-semibold mb-4 text-center">Processing Pipeline</h3>
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

          <div className="lg:col-span-2">
            {processing.result ? (
              <div className="space-y-6">
                <CodeOutput analysisResult={processing.result} filename={processing.filename} />
                <div className="flex justify-center"><Button onClick={resetProcessor} className="px-6 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-glow">Process Another File</Button></div>
              </div>
            ) : (
              <Card className="p-12 text-center bg-gradient-glow border-border/50 flex flex-col items-center justify-center h-full shadow-elevation">
                <div className="animate-pulse-glow mb-6"><UploadCloud className="h-20 w-20 text-primary" /></div>
                <h3 className="text-2xl font-bold text-foreground mb-2">Ready for Analysis</h3>
                <p className="text-muted-foreground max-w-md mx-auto mb-8">Upload a HAR file and select an analysis mode to begin.</p>
                <div className="flex gap-4 text-sm">
                  <div className="bg-muted/20 rounded-lg p-3 border border-border/50"><div className="font-medium text-primary">Advanced Detection</div><div className="text-muted-foreground">CSRF, Dynamic Tokens</div></div>
                  <div className="bg-muted/20 rounded-lg p-3 border border-border/50"><div className="font-medium text-secondary">Secure by Design</div><div className="text-muted-foreground">100% Local Processing</div></div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
