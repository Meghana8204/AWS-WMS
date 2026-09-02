import React, { useRef, useState, useEffect } from "react";
import { Camera, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface PoCameraScannerProps {
  onOcrSuccess: (data: any, file: File) => void;
  onClose: () => void;
}

export function PoCameraScanner({ onOcrSuccess, onClose }: PoCameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            facingMode: "environment",
          },
          audio: false,
        });

        if (mounted) {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } else {
          stream.getTracks().forEach((track) => track.stop());
        }
      } catch (err) {
        console.error("Camera access error:", err);
        if (mounted) {
          setError(
            "Camera access was blocked or is not available. Please allow camera permissions.",
          );
        }
      }
    }

    startCamera();

    return () => {
      mounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  async function captureAndScanFrame() {
    if (!videoRef.current || !canvasRef.current) return;

    setScanning(true);
    const toastId = toast.loading("Analyzing PO document...");

    try {
      const canvas = canvasRef.current;
      const video = videoRef.current;

      // Use natural video dimensions
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not initialize canvas context");

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Get base64 JPEG
      // Preserve small table text and punctuation (especially the final PO
      // sequence and date separators) for the local OCR engines.
      const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
      const base64Image = dataUrl.split(",")[1];

      // Call API
      const { api } = await import("@/lib/api-client");
      const data = await api.previewPoOcr(base64Image);

      // Create a File object from the blob for consistency with existing state
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `po-scan-${Date.now()}.jpg`, { type: "image/jpeg" });

      toast.success("OCR Extraction Complete", { id: toastId });
      onOcrSuccess(data, file);
      onClose();
    } catch (err: any) {
      console.error("OCR Preview error:", err);
      toast.error("Scanning failed", {
        id: toastId,
        description: err.message || "Could not process the document.",
      });
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-foreground/80 p-4 backdrop-blur-sm">
      <div className="flex max-h-full w-full max-w-2xl flex-col rounded-3xl bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/50 p-5">
          <div>
            <h3 className="text-lg font-bold tracking-tight">Scan Purchase Order</h3>
            <p className="text-xs text-muted-foreground">
              Align the PO document clearly within the frame.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={onClose}
            disabled={scanning}
          >
            <X className="size-5" />
          </Button>
        </div>

        {/* Camera Feed Container */}
        <div className="relative flex-1 bg-black overflow-hidden flex items-center justify-center">
          {error ? (
            <div className="p-8 text-center">
              <div className="mx-auto mb-4 rounded-full bg-destructive/10 p-3 text-destructive w-fit">
                <X className="size-6" />
              </div>
              <p className="text-sm font-medium text-destructive">{error}</p>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-contain"
              />
              {/* Optional Overlay Guide */}
              <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none flex items-center justify-center">
                <div className="w-full h-full border-2 border-dashed border-primary/40 rounded-lg"></div>
              </div>
            </>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-border/50 p-5">
          <Button variant="outline" className="rounded-xl" onClick={onClose} disabled={scanning}>
            Cancel
          </Button>
          <Button
            className="rounded-xl px-8 font-bold shadow-glow"
            disabled={!!error || scanning}
            onClick={captureAndScanFrame}
          >
            {scanning ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" /> Processing...
              </>
            ) : (
              <>
                <Camera className="mr-2 size-4" /> Capture & Analyze
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
