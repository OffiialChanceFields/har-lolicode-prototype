import React from 'react';
import { Check, Loader, CircleDot } from 'lucide-react';

interface Step {
  id: string;
  title: string;
  status: 'complete' | 'processing' | 'pending';
}

interface ProcessingPipelineProps {
  steps: Step[];
  currentStep: number;
  progress: number;
}

const StepIcon: React.FC<{ status: Step['status'] }> = ({ status }) => {
  switch (status) {
    case 'complete':
      return (
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
          <Check className="w-5 h-5 text-primary-foreground" />
        </div>
      );
    case 'processing':
      return (
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center animate-pulse-glow">
          <Loader className="w-5 h-5 text-primary-foreground animate-spin" />
        </div>
      );
    case 'pending':
      return (
        <div className="w-8 h-8 rounded-full border-2 border-dashed border-border flex items-center justify-center">
          <CircleDot className="w-4 h-4 text-muted-foreground/50" />
        </div>
      );
  }
};

export const ProcessingPipeline: React.FC<ProcessingPipelineProps> = ({ steps }) => {
  return (
    <div className="w-full px-4 sm:px-8">
      <div className="flex items-start">
        {steps.map((step, index) => (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center">
              <StepIcon status={step.status} />
              <p className="text-xs text-center mt-2 w-20 break-words">
                {step.title}
              </p>
            </div>
            {index < steps.length - 1 && (
                <div className={`flex-1 h-1 mt-3.5 transition-all duration-500 ease-in-out ${step.status === 'complete' ? 'bg-primary' : 'bg-border'}`} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
