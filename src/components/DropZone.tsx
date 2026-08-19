import React, { useState } from 'react';
import { UploadCloud } from 'lucide-react';

interface DropZoneProps {
  onFileDrop: (file: File) => void;
  children: React.ReactNode;
}

export const DropZone: React.FC<DropZoneProps> = ({ onFileDrop, children }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('audio/')) {
        onFileDrop(file);
      }
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative min-h-screen"
    >
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-cyan-950/80 backdrop-blur-md border-4 border-dashed border-cyan-400 flex flex-col items-center justify-center text-cyan-200 gap-4 animate-fade-in pointer-events-none">
          <UploadCloud className="w-16 h-16 animate-bounce text-cyan-400" />
          <h2 className="text-2xl font-bold tracking-tight">Drop Audio File to Analyze</h2>
          <p className="text-sm text-cyan-300/80">Supports MP3, WAV, OGG, FLAC, M4A, AAC</p>
        </div>
      )}
      {children}
    </div>
  );
};
