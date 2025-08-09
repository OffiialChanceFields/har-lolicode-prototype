import React, { useState } from 'react';
import { Terminal, UploadCloud, HelpCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { HarUpload } from '@/components/HarUpload';
import { ProcessingPipeline } from '@/components/ProcessingPipeline';
import { CodeOutput } from '@/components/CodeOutput';
import { AsyncHarProcessor } from '@/core/AsyncHarProcessor';
import { Button } from '@/components/ui/button';
import { InfoModal } from '@/components/InfoModal';
import { Link } from 'react-router-dom';
import { AnalysisModeSelector } from '@/components/AnalysisModeSelector';
import { toast } from "sonner";
import { AppError } from '@/error-handling';
import { OB2ConfigurationResult } from '@/services/types';

interface ProcessingState {
  isProcessing: boolean;
  status: string;
  progress: number;
  result: OB2ConfigurationResult | null;
  filename: string;
}

const PIPELINE_STEPS = [
    { id: 'reading', title: 'Reading HAR File' },
    { id: 'scoring', title: 'Scoring Endpoints' },
    { id: 'path_identification', title: 'Identifying Critical Path' },
    { id: 'token_detection', title: 'Detecting Tokens & Patterns'},
    { id: 'lolicode_generation', title: 'Generating LoliCode' },
    { id: 'complete', title: 'Complete' }
];

const Index = () => {
  const [processing, setProcessing] = useState<ProcessingState>({
    isProcessing: false,
    status: 'Ready',
    progress: 0,
    result: null,
    filename: ''
  });
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleFileSelect = (file: File) => {
    setProcessing({
      isProcessing: true,
      filename: file.name,
      status: 'Initializing...',
      progress: 0,
      result: null
    });

    const processor = new AsyncHarProcessor(file);

    processor.on('onProgress', (progress) => {
      setProcessing(prev => ({ ...prev, progress }));
    });

    processor.on('onStatusUpdate', (status) => {
      const currentStepIndex = PIPELINE_STEPS.findIndex(step => step.title === status);
      setProcessing(prev => ({ ...prev, status, currentStep: currentStepIndex !== -1 ? currentStepIndex : prev.currentStep }));
    });

    processor.on('onError', (error) => {
      const appError = error as AppError;
      toast.error(appError.title || 'Analysis Failed', { description: appError.message });
      setProcessing({
        isProcessing: false,
        status: 'Failed',
        progress: 0,
        result: null,
        filename: ''
      });
    });

    processor.on('onComplete', (result) => {
      setProcessing({
        isProcessing: false,
        status: 'Analysis complete',
        progress: 100,
        result,
        filename: file.name
      });
    });

    processor.process();
  };

  const resetProcessor = () => {
    setProcessing({ isProcessing: false, status: 'Ready', progress: 0, result: null, filename: '' });
  };

  const getCurrentStep = () => {
      const step = PIPELINE_STEPS.find(s => s.title === processing.status);
      const stepIndex = PIPELINE_STEPS.findIndex(s => s.title === processing.status);
      if (step) return stepIndex;
      if (processing.isProcessing) return 0;
      if (processing.result) return PIPELINE_STEPS.length;
      return -1;
  }

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
            <Button variant="ghost" size="icon" onClick={() => setIsModalOpen(true)} className="transition-glow"><HelpCircle className="h-5 w-5" /></Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <HarUpload onFileSelect={handleFileSelect} isProcessing={processing.isProcessing} />
            {(processing.isProcessing || processing.result) && (
              <Card className="bg-gradient-glow border-border/50 p-6 shadow-elevation">
                <h3 className="text-lg font-semibold mb-4 text-center">Processing Pipeline</h3>
                <ProcessingPipeline
                  steps={PIPELINE_STEPS.map((step, index) => ({
                    ...step,
                    status: index < getCurrentStep() ? 'complete' : index === getCurrentStep() && processing.isProcessing ? 'processing' : 'pending'
                  }))}
                  currentStep={getCurrentStep()}
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
                <p className="text-muted-foreground max-w-md mx-auto mb-8">Upload a HAR file to begin the automated LoliCode generation.</p>
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
