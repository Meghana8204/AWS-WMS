import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Camera, CheckCircle2, Loader2, RefreshCw, X } from "lucide-react";

type Props = {
    lineId?: string;
    damagedQuantity: number;
    reason?: string;
    onSuccess?: (evidence: { evidenceId: string; fileName?: string; filePath?: string; file?: File }) => void;
};

// Reset photo/save state when the material, quantity or reason changes.
export function DamagePhoto(props: Props) {
    return (
        <PhotoEditor
            key={`${props.lineId ?? "unsaved"}:${props.damagedQuantity}:${props.reason ?? ""}`}
            {...props}
        />
    );
}

function PhotoEditor({ lineId, damagedQuantity, reason, onSuccess }: Props) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const mounted = useRef(false);
    const streamRef = useRef<MediaStream | null>(null);
    const actionLock = useRef(false);

    const [cameraOpen, setCameraOpen] = useState(false);
    const [ready, setReady] = useState(false);
    const [preview, setPreview] = useState("");
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState("");

    const validLine = Boolean(lineId?.trim());
    const validQuantity = Number.isFinite(damagedQuantity) && damagedQuantity > 0;

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

    async function captureAndSave() {
        const video = videoRef.current;
        if (actionLock.current || saving) return;

        if (!validLine) {
            report("Save the material details on Page 2 first.");
            return;
        }

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

            const capturedFile = new File([blob], `damage-${Date.now()}.jpg`, { type: "image/jpeg" });
            const localPreview = URL.createObjectURL(blob);

            // Upload directly to server
            const data = new FormData();
            data.append("file", capturedFile);
            data.append("damaged_quantity", String(damagedQuantity));
            if (reason) {
                data.append("reason", reason);
            }

            const result = await api.uploadDamageEvidence(lineId!.trim(), data);

            if (!mounted.current) return;

            const evidenceId = result?.evidenceId || result?.evidence_id;
            if (!evidenceId) {
                throw new Error("Server returned no evidence ID. Upload could not be confirmed.");
            }

            setPreview(localPreview);
            setSaved(true);
            setCameraOpen(false);
            setReady(false);
            stopStream();

            toast.success("Damage photo captured and saved successfully.");
            onSuccess?.({
                evidenceId: String(evidenceId),
                fileName: capturedFile.name,
                filePath: result?.file_path || result?.filePath || localPreview,
                file: capturedFile,
            });
        } catch (cause) {
            report(cause instanceof Error ? cause.message : "Failed to save photo. Please retry.");
        } finally {
            actionLock.current = false;
            if (mounted.current) {
                setSaving(false);
            }
        }
    }

    return (
        <div className="space-y-2 min-w-[200px]">
            {/* 1. Camera View Mode */}
            {cameraOpen ? (
                <div className="space-y-2 p-2 rounded-xl border bg-black/5 dark:bg-black/40">
                    <video
                        ref={videoRef}
                        autoPlay
                        muted
                        playsInline
                        onCanPlay={() => setReady(true)}
                        className="w-56 h-40 rounded-lg bg-black object-cover shadow-inner"
                    />

                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            size="sm"
                            disabled={!ready || saving}
                            onClick={() => void captureAndSave()}
                            className="flex-1 rounded-lg text-xs font-bold bg-primary text-primary-foreground"
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="mr-1.5 size-3.5 animate-spin" /> Saving...
                                </>
                            ) : (
                                <>
                                    <Camera className="mr-1.5 size-3.5" /> Save Photo
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
                            className="rounded-lg text-xs px-2"
                        >
                            <X className="size-3.5" />
                        </Button>
                    </div>
                </div>
            ) : saved && preview ? (
                /* 2. Photo Saved Preview Mode */
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <img
                            src={preview}
                            alt="Captured Damage Evidence"
                            className="h-16 w-20 rounded-lg border object-cover shadow-xs"
                        />
                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xs">
                            <CheckCircle2 className="size-3" />
                        </span>
                    </div>

                    <div className="space-y-1">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                            <CheckCircle2 className="size-3" /> Photo Saved
                        </span>
                        <div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 text-[11px] text-muted-foreground hover:text-primary px-1 font-medium"
                                onClick={() => {
                                    setError("");
                                    setReady(false);
                                    setCameraOpen(true);
                                }}
                            >
                                <RefreshCw className="mr-1 size-3" /> Retake
                            </Button>
                        </div>
                    </div>
                </div>
            ) : (
                /* 3. Initial Open Camera Button */
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl text-xs font-semibold h-9 px-3 gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                    onClick={() => {
                        setError("");
                        setReady(false);
                        setCameraOpen(true);
                    }}
                >
                    <Camera className="size-4" /> Open Camera
                </Button>
            )}

            {error && (
                <p role="alert" className="text-[11px] text-rose-600 font-medium">
                    {error}
                </p>
            )}
        </div>
    );
}