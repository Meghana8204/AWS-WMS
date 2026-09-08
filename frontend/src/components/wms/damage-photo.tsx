import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api, resolveMediaUrl } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Camera, CheckCircle2, Loader2, Plus, RefreshCw, Trash2, Upload, X, ZoomIn } from "lucide-react";

export interface DamagePhotoItem {
  id: string;
  evidenceId?: string;
  previewUrl: string;
  fileName?: string;
  file?: File;
}

type Props = {
  lineId?: string;
  damagedQuantity: number;
  reason?: string;
  existingPhotos?: DamagePhotoItem[];
  onSuccess?: (evidence: {
    evidenceId?: string;
    evidenceIds: string[];
    photos: DamagePhotoItem[];
    filePath?: string;
    file?: File;
  }) => void;
};

export function DamagePhoto({ lineId, damagedQuantity, reason, existingPhotos = [], onSuccess }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mounted = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const actionLock = useRef(false);

  const [photos, setPhotos] = useState<DamagePhotoItem[]>(existingPhotos);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [zoomedPhoto, setZoomedPhoto] = useState<DamagePhotoItem | null>(null);

  const validLine = Boolean(lineId?.trim());
  const validQuantity = Number.isFinite(damagedQuantity) && damagedQuantity > 0;

  useEffect(() => {
    if (existingPhotos && existingPhotos.length > 0) {
      setPhotos((current) => {
        if (current.length === 0) {
          return existingPhotos;
        }
        const currentKeys = new Set(current.map((p) => p.evidenceId || p.id));
        const missing = existingPhotos.filter((p) => !currentKeys.has(p.evidenceId || p.id));
        if (missing.length > 0) {
          return [...current, ...missing];
        }
        return current;
      });
    }
  }, [existingPhotos]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stopStream();
    };
  }, []);

  function stopStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  function report(message: string) {
    if (!mounted.current) return;
    setError(message);
    toast.error(message);
  }

  // Camera initialization
  useEffect(() => {
    if (!cameraOpen) {
      stopStream();
      return;
    }

    let cancelled = false;

    async function openCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera requires HTTPS or localhost.");
        }

        const opened = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });

        if (cancelled) {
          opened.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = opened;
        if (videoRef.current) {
          videoRef.current.srcObject = opened;
          await videoRef.current.play();
        }
      } catch (cause) {
        if (cancelled) return;
        stopStream();
        setCameraOpen(false);
        setReady(false);

        const name = cause instanceof Error ? cause.name : "";
        const message =
          name === "NotAllowedError"
            ? "Camera permission denied. Allow camera access in your browser."
            : name === "NotFoundError"
              ? "No camera device found on this system."
              : name === "NotReadableError"
                ? "Camera is in use by another application."
                : cause instanceof Error
                  ? cause.message
                  : "Unable to open camera.";
        report(message);
      }
    }

    void openCamera();

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [cameraOpen]);

  // Upload a single file to server or register locally
  async function uploadSinglePhoto(file: File, previewUrl: string): Promise<DamagePhotoItem> {
    const photoId = `photo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    if (validLine && lineId) {
      try {
        const data = new FormData();
        data.append("file", file);
        data.append("damaged_quantity", String(damagedQuantity));
        if (reason) {
          data.append("reason", reason);
        }
        const result = await api.uploadDamageEvidence(lineId.trim(), data);
        const evidenceId = result?.evidence_id || result?.evidenceId || photoId;
        const serverPath = result?.file_path || result?.filePath;
        const resolvedUrl = serverPath ? resolveMediaUrl(serverPath) : previewUrl;
        return {
          id: photoId,
          evidenceId: String(evidenceId),
          previewUrl: resolvedUrl,
          fileName: file.name,
          file,
        };
      } catch (err) {
        console.warn("Server upload failed, using local photo cache:", err);
      }
    }
    return {
      id: photoId,
      evidenceId: photoId,
      previewUrl,
      fileName: file.name,
      file,
    };
  }

  // Handle capture from live video
  async function capturePhoto() {
    const video = videoRef.current;
    if (actionLock.current || saving) return;

    if (!validQuantity) {
      report("Damaged quantity must be greater than zero.");
      return;
    }

    if (!video || !video.videoWidth || !video.videoHeight) {
      report("Waiting for camera stream...");
      return;
    }

    actionLock.current = true;
    setSaving(true);
    setError("");

    try {
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);

      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Cannot capture camera frame.");
      }

      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/jpeg", 0.85);
      });

      if (!blob) {
        throw new Error("Photo capture failed. Please try again.");
      }

      const photoNumber = photos.length + 1;
      const capturedFile = new File([blob], `damage-evidence-${photoNumber}-${Date.now()}.jpg`, { type: "image/jpeg" });
      const localPreview = URL.createObjectURL(blob);

      const newPhotoItem = await uploadSinglePhoto(capturedFile, localPreview);
      const updatedPhotos = [...photos, newPhotoItem];

      setPhotos(updatedPhotos);
      toast.success(`Photo #${photoNumber} captured successfully! You can take more or click Done.`);

      notifyParent(updatedPhotos);
    } catch (cause) {
      report(cause instanceof Error ? cause.message : "Failed to save photo. Please retry.");
    } finally {
      actionLock.current = false;
      if (mounted.current) {
        setSaving(false);
      }
    }
  }

  // Handle file input selection
  async function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setSaving(true);
    setError("");

    try {
      const uploadedList: DamagePhotoItem[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const previewUrl = URL.createObjectURL(file);
        const item = await uploadSinglePhoto(file, previewUrl);
        uploadedList.push(item);
      }

      const updated = [...photos, ...uploadedList];
      setPhotos(updated);
      toast.success(`${files.length} photo(s) uploaded successfully!`);
      notifyParent(updated);
    } catch (err: any) {
      report(err?.message || "Failed to upload photo(s).");
    } finally {
      setSaving(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removePhoto(idToRemove: string) {
    const updated = photos.filter((p) => p.id !== idToRemove);
    setPhotos(updated);
    toast.info("Photo removed.");
    notifyParent(updated);
  }

  function notifyParent(list: DamagePhotoItem[]) {
    const evidenceIds = list.map((p) => p.evidenceId || p.id).filter(Boolean);
    const lastPhoto = list[list.length - 1];
    onSuccess?.({
      evidenceId: lastPhoto?.evidenceId || lastPhoto?.id,
      evidenceIds,
      photos: list,
      filePath: lastPhoto ? resolveMediaUrl(lastPhoto.previewUrl) : undefined,
      file: lastPhoto?.file,
    });
  }

  return (
    <div className="space-y-2 min-w-[240px]">
      {/* Hidden file input for uploading from file picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => void handleFileInput(e)}
      />

      {/* 1. Camera View Mode */}
      {cameraOpen && (
        <div className="space-y-2 p-2.5 rounded-xl border border-primary/30 bg-black/5 dark:bg-black/50">
          <div className="relative">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              onCanPlay={() => setReady(true)}
              className="w-full max-w-[260px] h-44 rounded-lg bg-black object-cover shadow-inner mx-auto"
            />
            {saving && (
              <div className="absolute inset-0 bg-black/60 rounded-lg flex items-center justify-center text-white text-xs font-bold gap-2">
                <Loader2 className="size-4 animate-spin" /> Saving Photo...
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              disabled={!ready || saving}
              onClick={() => void capturePhoto()}
              className="flex-1 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Camera className="mr-1.5 size-3.5" /> Snap Photo #{photos.length + 1}
                </>
              )}
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() => {
                setCameraOpen(false);
                setReady(false);
                stopStream();
              }}
              className="rounded-lg text-xs px-2.5 font-bold"
            >
              Done ({photos.length})
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center">
            You can take multiple photos. Click 'Snap Photo' for each angle, then click Done.
          </p>
        </div>
      )}

      {/* 2. Photo Gallery & Thumbnail Strip */}
      {photos.length > 0 && !cameraOpen && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="size-3 text-emerald-600" />
              {photos.length} Photo{photos.length === 1 ? "" : "s"} Attached
            </span>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            {photos.map((p, idx) => (
              <div key={p.id || idx} className="relative group/thumb">
                <img
                  src={resolveMediaUrl(p.previewUrl)}
                  alt={`Damage Evidence ${idx + 1}`}
                  className="size-14 rounded-lg border-2 border-rose-300 dark:border-rose-800 object-cover shadow-xs cursor-pointer transition-transform hover:scale-105"
                  onClick={() => setZoomedPhoto(p)}
                />
                <span className="absolute bottom-0 left-0 bg-black/70 text-white text-[9px] font-mono px-1 rounded-br-md rounded-tl-sm">
                  #{idx + 1}
                </span>
                <button
                  type="button"
                  title="Remove Photo"
                  onClick={() => removePhoto(p.id)}
                  className="absolute -top-1.5 -right-1.5 size-4 bg-rose-600 hover:bg-rose-700 text-white rounded-full flex items-center justify-center shadow-xs"
                >
                  <X className="size-2.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Action Buttons to Add More Photos */}
      {!cameraOpen && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={`rounded-xl text-xs font-semibold h-8 px-2.5 gap-1.5 ${
              photos.length === 0
                ? "border-rose-400 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300"
                : "border-primary/30 text-primary hover:bg-primary/10"
            }`}
            onClick={() => {
              setError("");
              setReady(false);
              setCameraOpen(true);
            }}
          >
            <Camera className="size-3.5" />
            {photos.length > 0 ? "+ Take Another Photo" : "Take Photo *"}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-xl text-xs font-semibold h-8 px-2 gap-1 text-muted-foreground hover:text-foreground"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="size-3.5" /> Upload File
          </Button>
        </div>
      )}

      {/* Warning if no photos taken yet */}
      {photos.length === 0 && !cameraOpen && (
        <p className="text-[10px] text-rose-600 font-semibold flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-rose-600 inline-block" />
          Photo evidence required (take 1 or more photos)
        </p>
      )}

      {error && (
        <p role="alert" className="text-[11px] text-rose-600 font-medium">
          {error}
        </p>
      )}

      {/* Zoomed Photo Modal */}
      {zoomedPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setZoomedPhoto(null)}
        >
          <div className="relative max-w-lg w-full bg-card rounded-2xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-xs font-bold uppercase text-foreground">Damage Photo Evidence</span>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setZoomedPhoto(null)}>
                <X className="size-4" />
              </Button>
            </div>
            <img src={resolveMediaUrl(zoomedPhoto.previewUrl)} alt="Zoomed Damage Evidence" className="w-full max-h-[70vh] object-contain rounded-xl" />
            <div className="flex justify-end">
              <Button size="sm" variant="outline" className="text-xs rounded-xl" onClick={() => setZoomedPhoto(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}