'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Film,
  Instagram,
  Loader2,
  Play,
  RotateCcw,
  Sparkles,
  Trash2,
  UploadCloud,
  Video,
} from 'lucide-react';
import {
  type ExtractedVideoMetadata,
  extractVideoMetadataAndPoster,
  formatStoryVideoSize,
  validateStoryVideoFile,
} from '@/lib/utils/storyVideoUploadClient';

interface CmsVideoUploaderProps {
  selectedFile: File | null;
  onFileSelect: (file: File | null) => void;
  onMetadataExtracted?: (metadata: ExtractedVideoMetadata) => void;
  uploadProgress?: number;
  isUploading?: boolean;
  currentVideoUrl?: string;
  onError?: (errorMessage: string) => void;
  disabled?: boolean;
}

export default function CmsVideoUploader({
  selectedFile,
  onFileSelect,
  onMetadataExtracted,
  uploadProgress = 0,
  isUploading = false,
  currentVideoUrl = '',
  onError,
  disabled = false,
}: CmsVideoUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [metadata, setMetadata] = useState<ExtractedVideoMetadata | null>(null);
  const [localVideoUrl, setLocalVideoUrl] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manage object URL for instant client-side preview
  useEffect(() => {
    if (!selectedFile) {
      setLocalVideoUrl('');
      setMetadata(null);
      return;
    }

    const url = URL.createObjectURL(selectedFile);
    setLocalVideoUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [selectedFile]);

  const processFile = useCallback(
    async (file: File) => {
      const validationError = validateStoryVideoFile(file);
      if (validationError) {
        onError?.(validationError);
        return;
      }

      onFileSelect(file);
      setIsExtracting(true);

      try {
        const extracted = await extractVideoMetadataAndPoster(file);
        setMetadata(extracted);
        onMetadataExtracted?.(extracted);
      } catch (err) {
        console.error('Failed to extract video metadata:', err);
      } finally {
        setIsExtracting(false);
      }
    },
    [onError, onFileSelect, onMetadataExtracted]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isUploading) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (disabled || isUploading) return;

    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      void processFile(droppedFile);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void processFile(file);
    }
  };

  const handleRemove = () => {
    if (disabled || isUploading) return;
    onFileSelect(null);
    setMetadata(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const hasFile = Boolean(selectedFile);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
          <Film className="h-4 w-4 text-spanish-red" />
          <span>Smart Direct Video Upload (MP4 / Reels)</span>
        </label>
        <span className="inline-flex items-center gap-1 text-xs text-gray-500 font-medium">
          <Instagram className="h-3.5 w-3.5 text-pink-600" />
          <span>Reels & 9:16 Shorts Ready</span>
        </span>
      </div>

      {!selectedFile ? (
        /* Empty / Drop Zone State */
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
          className={`relative flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-6 text-center transition-all ${
            isDragOver
              ? 'border-spanish-red bg-red-50/50 scale-[1.01]'
              : 'border-gray-300 bg-gray-50/80 hover:border-spanish-red hover:bg-red-50/20'
          } ${disabled || isUploading ? 'cursor-not-allowed opacity-60' : ''}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,.mp4"
            onChange={handleFileInputChange}
            disabled={disabled || isUploading}
            className="hidden"
          />

          <div className="mb-2.5 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-spanish-red shadow-sm">
            <UploadCloud className="h-6 w-6 animate-pulse" />
          </div>

          <p className="text-sm font-semibold text-gray-800">
            Click to upload or drag & drop MP4 video here
          </p>
          <p className="mt-1 text-xs text-gray-500 max-w-md">
            Direct high-speed upload to DigitalOcean Spaces CDN. Auto-detects 9:16 vertical shorts,
            duration, and captures poster thumbnail.
          </p>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-0.5 text-[11px] font-medium text-gray-600 border border-gray-200">
              ⚡ MP4 up to 1.9 GB
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-200">
              <Sparkles className="h-3 w-3" />
              Auto 9:16 Shorts detection
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-700 border border-amber-200">
              📸 Auto-Thumbnail frame capture
            </span>
          </div>
        </div>
      ) : (
        /* File Selected / Active State */
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-zinc-900 text-white">
                {localVideoUrl ? (
                  <video
                    src={localVideoUrl}
                    className="h-full w-full object-cover"
                    muted
                    playsInline
                  />
                ) : (
                  <Video className="h-7 w-7 text-gray-400" />
                )}
                {isExtracting && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-xs">
                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-gray-900" title={selectedFile.name}>
                  {selectedFile.name}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  <span className="font-semibold text-gray-700">
                    {formatStoryVideoSize(selectedFile.size)}
                  </span>
                  {metadata?.duration ? (
                    <>
                      <span>•</span>
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 font-medium text-gray-700">
                        {metadata.duration} seconds
                      </span>
                    </>
                  ) : null}
                  {metadata?.width && metadata?.height ? (
                    <>
                      <span>•</span>
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 font-medium text-gray-700">
                        {metadata.width} × {metadata.height}
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || isUploading}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-xs hover:bg-gray-50 disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Replace
              </button>
              <button
                type="button"
                onClick={handleRemove}
                disabled={disabled || isUploading}
                className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,.mp4"
                onChange={handleFileInputChange}
                disabled={disabled || isUploading}
                className="hidden"
              />
            </div>
          </div>

          {/* Intelligence Badges */}
          {metadata && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
              {metadata.isShort ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  ✨ 9:16 Vertical — Auto-configured for Lokswami Swipe / Shorts
                </span>
              ) : metadata.aspectRatio === '16:9' ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800">
                  🎬 16:9 Landscape — Standard Video Desk
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                  📐 Aspect Ratio: {metadata.aspectRatio}
                </span>
              )}

              {metadata.posterBlob && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 border border-amber-200">
                  📸 Auto-thumbnail captured from video
                </span>
              )}
            </div>
          )}

          {/* Upload Progress Bar */}
          {uploadProgress > 0 && (
            <div className="mt-3 border-t border-gray-100 pt-3" aria-live="polite">
              <div className="flex items-center justify-between text-xs mb-1 font-medium text-gray-700">
                <span>Uploading to DigitalOcean Spaces CDN...</span>
                <span className="font-bold text-spanish-red">{uploadProgress}%</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-spanish-red transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Helpful Hint */}
      <p className="text-[11px] leading-relaxed text-gray-500">
        <strong className="font-semibold text-gray-700">Tip for Instagram Reels:</strong> Save/download
        the Reel MP4 and upload it here. Readers will enjoy a smooth, 60fps vertical swipe experience.
        You can also link the original Instagram post below in the attribution field.
      </p>
    </div>
  );
}
