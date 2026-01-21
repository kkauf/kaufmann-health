'use client';

import { useState, useCallback } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Check, X, RotateCcw } from 'lucide-react';

type Props = {
  imageSrc: string;
  onCropComplete: (croppedBlob: Blob) => void;
  onCancel: () => void;
  aspectRatio?: number;
  cropShape?: 'rect' | 'round';
};

// Helper to create a cropped image from canvas
async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area,
  outputSize = 400
): Promise<Blob> {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = reject;
    image.src = imageSrc;
  });

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  // Set output size (square for profile photos)
  canvas.width = outputSize;
  canvas.height = outputSize;

  // Draw the cropped area scaled to output size
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outputSize,
    outputSize
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob failed'));
      },
      'image/jpeg',
      0.9
    );
  });
}

export function ImageCropper({
  imageSrc,
  onCropComplete,
  onCancel,
  aspectRatio = 1,
  cropShape = 'round',
}: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);

  const onCropChange = useCallback((location: { x: number; y: number }) => {
    setCrop(location);
  }, []);

  const onZoomChange = useCallback((newZoom: number) => {
    setZoom(newZoom);
  }, []);

  const onCropAreaChange = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!croppedAreaPixels) return;
    
    setProcessing(true);
    try {
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      onCropComplete(croppedBlob);
    } catch (error) {
      console.error('Error cropping image:', error);
    } finally {
      setProcessing(false);
    }
  }, [imageSrc, croppedAreaPixels, onCropComplete]);

  const handleReset = useCallback(() => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  }, []);

  const zoomIn = useCallback(() => {
    setZoom((z) => Math.min(z + 0.2, 3));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((z) => Math.max(z - 0.2, 1));
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">Foto zuschneiden</h3>
          <p className="text-sm text-gray-500 mt-1">
            Ziehe das Bild, um den Ausschnitt anzupassen. Verwende den Zoom, um dein Gesicht zu fokussieren.
          </p>
        </div>

        {/* Crop Area */}
        <div className="relative h-72 sm:h-80 bg-gray-900">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspectRatio}
            cropShape={cropShape}
            showGrid={false}
            onCropChange={onCropChange}
            onZoomChange={onZoomChange}
            onCropComplete={onCropAreaChange}
            classes={{
              containerClassName: 'rounded-none',
              cropAreaClassName: cropShape === 'round' ? 'rounded-full' : '',
            }}
            style={{
              cropAreaStyle: {
                border: '3px solid #10b981',
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
              },
            }}
          />
        </div>

        {/* Zoom Controls */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={zoomOut}
              disabled={zoom <= 1}
              className="p-2 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Verkleinern"
            >
              <ZoomOut className="h-5 w-5" />
            </button>
            
            <div className="flex-1">
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                aria-label="Zoom"
              />
            </div>
            
            <button
              type="button"
              onClick={zoomIn}
              disabled={zoom >= 3}
              className="p-2 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Vergrößern"
            >
              <ZoomIn className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="p-2 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              aria-label="Zurücksetzen"
            >
              <RotateCcw className="h-5 w-5" />
            </button>
          </div>
          
          <p className="text-xs text-gray-500 mt-2 text-center">
            Zoom: {Math.round((zoom - 1) * 100)}%
          </p>
        </div>

        {/* Preview + Actions */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">Vorschau:</span>
            <div className="h-12 w-12 rounded-full bg-gray-100 border-2 border-emerald-500 overflow-hidden">
              {/* Mini preview - we'll use the cropper's internal state */}
              <div 
                className="h-full w-full bg-cover bg-center"
                style={{ backgroundImage: `url(${imageSrc})` }}
              />
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={processing}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Abbrechen
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={processing || !croppedAreaPixels}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              {processing ? (
                <>
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Wird verarbeitet...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Übernehmen
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
