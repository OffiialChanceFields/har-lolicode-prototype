import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, File as FileIcon, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';

interface HarUploadProps {
  onFileSelect: (file: File, content: string) => void;
  isProcessing: boolean;
}

export const HarUpload: React.FC<HarUploadProps> = ({ onFileSelect, isProcessing }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setSelectedFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/json': ['.har'] },
    multiple: false,
    disabled: isProcessing,
  });

  const handleAnalyze = () => {
    if (selectedFile) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        onFileSelect(selectedFile, content);
      };
      reader.readAsText(selectedFile);
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
  };

  if (isProcessing) {
    // While processing, the pipeline is shown, so this component can be minimal
    return null;
  }

  if (selectedFile) {
    return (
      <Card className="p-6 bg-card/80 border-primary/20 border-t-4 border-t-primary">
        <div className="flex items-center space-x-4 mb-4">
          <FileIcon className="h-10 w-10 text-primary" />
          <div>
            <h3 className="font-semibold text-lg">File Ready for Analysis</h3>
            <p className="text-sm text-muted-foreground">{selectedFile.name}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-6">
            <div><span className="font-medium text-muted-foreground">Size:</span> {(selectedFile.size / 1024).toFixed(2)} KB</div>
            <div><span className="font-medium text-muted-foreground">Type:</span> {selectedFile.type}</div>
            <div><span className="font-medium text-muted-foreground">Last Modified:</span> {new Date(selectedFile.lastModified).toLocaleDateString()}</div>
        </div>
        <div className="flex justify-end space-x-2">
          <Button variant="ghost" onClick={clearSelection}>Cancel</Button>
          <Button onClick={handleAnalyze} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            Analyze File
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={`relative flex flex-col items-center justify-center w-full h-64 rounded-lg border-2 border-dashed border-primary/50 cursor-pointer transition-all duration-300
      ${isDragActive ? 'border-solid bg-primary/10' : 'hover:bg-primary/5 hover:border-solid'}`}
    >
      <input {...getInputProps()} />
      <div className="text-center">
        <UploadCloud className={`h-16 w-16 text-primary transition-transform duration-300 ${isDragActive ? 'scale-110' : ''}`} />
        <p className="mt-4 font-semibold text-lg">Drop HAR file here</p>
        <p className="text-muted-foreground">or click to browse</p>
      </div>
      <div className="absolute bottom-4 flex space-x-2">
        <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">.har</span>
      </div>
    </div>
  );
};
