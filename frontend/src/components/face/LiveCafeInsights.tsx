import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';
import { Loader2, Users, UtensilsCrossed, Smile } from 'lucide-react';
import { customerService } from '../../services/api';
import { FaceMatchGroupResponse, FaceRecognitionResult, GroupFaceRecognitionResponse } from '../../types/customer';
import { drawLabeledDetections } from '../../utils/faceOverlay';
import {
  detectAllFacesWithExpression,
  getDominantEmotion,
  loadModels,
  startWebcam,
  stopWebcam,
} from '../../utils/faceDetection';

interface CapturedFaceInput {
  descriptor: number[];
  emotion: string;
}

interface LiveCustomerInsight {
  id: string;
  name: string;
  mood: string;
  confidence: string;
  latestFood: string;
}

const AUTO_SCAN_INTERVAL_MS = 2500;

const LiveCafeInsights: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number>();
  const scanIntervalRef = useRef<number>();
  const isMountedRef = useRef(true);
  const isDetectingRef = useRef(false);
  const isScanningRef = useRef(false);
  const lastMatchRef = useRef(0);
  const isMatchingRef = useRef(false);
  const faceLabelsRef = useRef<string[]>([]);
  const isLoadingRef = useRef(true);

  const [isLoading, setIsLoading] = useState(true);
  const [isAutoScanning, setIsAutoScanning] = useState(false);
  const [error, setError] = useState('');
  const [facesInFrame, setFacesInFrame] = useState(0);
  const [recognizedFaceCount, setRecognizedFaceCount] = useState(0);
  const [unrecognizedCount, setUnrecognizedCount] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [customers, setCustomers] = useState<LiveCustomerInsight[]>([]);
  const [faceLabels, setFaceLabels] = useState<string[]>([]);

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  useEffect(() => {
    faceLabelsRef.current = faceLabels;
  }, [faceLabels]);

  useEffect(() => {
    initializeLiveInsights();

    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, []);

  const initializeLiveInsights = async () => {
    try {
      setIsLoading(true);
      setError('');

      await loadModels({ preferHighAccuracy: true });

      if (!videoRef.current) {
        throw new Error('Camera preview is not available');
      }

      const mediaStream = await startWebcam(videoRef.current);
      streamRef.current = mediaStream;
      setIsLoading(false);
      setIsAutoScanning(true);

      startPreviewLoop();
      triggerScan();

      scanIntervalRef.current = window.setInterval(() => {
        triggerScan();
      }, AUTO_SCAN_INTERVAL_MS);
    } catch (err: any) {
      setError(err?.message || 'Unable to start live cafe insights');
      setIsLoading(false);
      setIsAutoScanning(false);
    }
  };

  const startPreviewLoop = () => {
    const drawFrame = async () => {
      if (!isMountedRef.current || isDetectingRef.current) {
        animationRef.current = requestAnimationFrame(drawFrame);
        return;
      }

      if (videoRef.current && videoRef.current.readyState === 4) {
        isDetectingRef.current = true;

        try {
          const detections = await detectAllFacesWithExpression(videoRef.current, { highAccuracy: false });
          setFacesInFrame(detections.length);
          maybeMatchFaces(detections);

          if (canvasRef.current) {
            const displaySize = {
              width: videoRef.current.videoWidth,
              height: videoRef.current.videoHeight,
            };

            faceapi.matchDimensions(canvasRef.current, displaySize);
            const resized = faceapi.resizeResults(detections, displaySize);

            const labels = resized.map((_, index) => faceLabelsRef.current[index] || 'Unknown');
            drawLabeledDetections(canvasRef.current, resized, labels, {
              strokeStyle: '#38bdf8',
            });
          }
        } catch {
          // Keep preview loop resilient even if one detection attempt fails.
        } finally {
          isDetectingRef.current = false;
        }
      }

      animationRef.current = requestAnimationFrame(drawFrame);
    };

    drawFrame();
  };

  const maybeMatchFaces = (detections: any[]) => {
    if (detections.length === 0) {
      setFaceLabels([]);
      return;
    }

    const now = Date.now();
    if (isMatchingRef.current || now - lastMatchRef.current < 1500) {
      return;
    }

    isMatchingRef.current = true;
    lastMatchRef.current = now;

    customerService
      .matchCustomersBatch(detections.map((detection) => Array.from(detection.descriptor)))
      .then((response) => {
        const data = response.data as FaceMatchGroupResponse;
        const labels = detections.map((_, index) => {
          const match = data.results.find((result) => result.index === index);
          if (match?.matched && match.customer?.name) {
            return match.customer.name;
          }
          return 'Unknown';
        });
        setFaceLabels(labels);
      })
      .catch(() => {
        setFaceLabels(detections.map(() => 'Unknown'));
      })
      .finally(() => {
        isMatchingRef.current = false;
      });
  };

  const toLiveInsights = (
    results: FaceRecognitionResult[],
    capturedFaces: CapturedFaceInput[]
  ): LiveCustomerInsight[] => {
    return results.map((result) => {
      const faceIndex = result.matchedDescriptorIndex;
      const mood =
        typeof faceIndex === 'number' && capturedFaces[faceIndex]
          ? capturedFaces[faceIndex].emotion
          : 'neutral';

      const latestOrder = result.orderHistory?.[0];
      const latestFood = latestOrder?.items?.length
        ? latestOrder.items
            .map((item) => item.foodItem?.name)
            .filter(Boolean)
            .join(', ')
        : 'No recent order found';

      return {
        id: result.customer.id,
        name: result.customer.name,
        mood,
        confidence: result.matchConfidence,
        latestFood,
      };
    });
  };

  const triggerScan = async () => {
    if (!videoRef.current || isScanningRef.current || isLoadingRef.current || videoRef.current.readyState < 2) {
      return;
    }

    let capturedFaceCount = 0;

    try {
      isScanningRef.current = true;
      setError('');

      const detections = await detectAllFacesWithExpression(videoRef.current, { highAccuracy: true });
      const capturedFaces: CapturedFaceInput[] = detections.map((detection) => ({
        descriptor: Array.from(detection.descriptor),
        emotion: getDominantEmotion(detection.expressions),
      }));
      capturedFaceCount = capturedFaces.length;

      setFacesInFrame(capturedFaces.length);

      if (capturedFaces.length === 0) {
        setCustomers([]);
        setRecognizedFaceCount(0);
        setUnrecognizedCount(0);
        setLastUpdated(new Date());
        return;
      }

      const response = await customerService.recognizeCustomersBatch(
        capturedFaces.map((face) => face.descriptor)
      );
      const data = response.data as GroupFaceRecognitionResponse;

      const unmatchedIndices = Array.isArray(data.unmatchedDescriptorIndices)
        ? data.unmatchedDescriptorIndices
        : [];

      const uniqueUnmatchedIndices = new Set(
        unmatchedIndices.filter(
          (index): index is number =>
            typeof index === 'number' &&
            index >= 0 &&
            index < capturedFaces.length
        )
      );

      let unrecognizedFaces = uniqueUnmatchedIndices.size;
      if (unrecognizedFaces === 0 && typeof data.unrecognizedCount === 'number') {
        unrecognizedFaces = Math.min(Math.max(data.unrecognizedCount, 0), capturedFaces.length);
      }

      const recognizedFaces = capturedFaces.length - unrecognizedFaces;

      setCustomers(toLiveInsights(data.results || [], capturedFaces));
      setRecognizedFaceCount(recognizedFaces);
      setUnrecognizedCount(unrecognizedFaces);
      setLastUpdated(new Date());
    } catch (err: any) {
      const apiMessage = err?.response?.data?.message;

      // Keep dashboard useful even when recognition API is temporarily unavailable.
      if (apiMessage === 'No customers enrolled yet') {
        setCustomers([]);
        setRecognizedFaceCount(0);
        setUnrecognizedCount(capturedFaceCount);
        setError('No enrolled customers found. Enroll customers to start recognition.');
      } else {
        setCustomers([]);
        setRecognizedFaceCount(0);
        setUnrecognizedCount(capturedFaceCount);
        setError(apiMessage || 'Failed to analyze current cafe activity');
      }
      setLastUpdated(new Date());
    } finally {
      isScanningRef.current = false;
    }
  };

  const cleanup = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    if (scanIntervalRef.current) {
      window.clearInterval(scanIntervalRef.current);
    }

    stopWebcam(streamRef.current);
    streamRef.current = null;
  };

  const lastUpdatedLabel = useMemo(() => {
    if (!lastUpdated) return 'Waiting for first scan...';
    return `Last updated: ${lastUpdated.toLocaleTimeString()}`;
  }, [lastUpdated]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-500/30 bg-transparent p-6 shadow-xl shadow-slate-950/10 backdrop-blur-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-4xl font-bold text-white">Live Cafe Insights</h2>
          <span className="rounded-xl border border-slate-500/30 bg-transparent px-3 py-1 text-lg text-slate-300">
            {isAutoScanning ? 'Auto-scan active' : 'Auto-scan paused'}
          </span>
        </div>

        <div className="relative h-[360px] overflow-hidden rounded-xl border border-slate-600/50 bg-black">
          <video ref={videoRef} className="h-full w-full object-cover" autoPlay muted playsInline />
          <canvas ref={canvasRef} className="absolute left-0 top-0 h-full w-full" />

          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <div className="text-center text-slate-100">
                <Loader2 className="mx-auto mb-2 animate-spin" size={40} />
                <p className="text-lg">Starting live analysis...</p>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-rose-400/35 bg-rose-500/20 p-3 text-rose-100">
            {error}
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <article className="rounded-xl border border-slate-500/30 bg-transparent p-4 shadow-xl shadow-slate-950/10">
          <p className="text-base text-slate-400">Customers in frame</p>
          <p className="mt-1 text-4xl font-bold text-white">{facesInFrame}</p>
        </article>
        <article className="rounded-xl border border-slate-500/30 bg-transparent p-4 shadow-xl shadow-slate-950/10">
          <p className="text-base text-slate-400">Recognized customers</p>
          <p className="mt-1 text-4xl font-bold text-white">{recognizedFaceCount}</p>
        </article>
        <article className="rounded-xl border border-slate-500/30 bg-transparent p-4 shadow-xl shadow-slate-950/10">
          <p className="text-base text-slate-400">Unrecognized faces</p>
          <p className="mt-1 text-4xl font-bold text-white">{unrecognizedCount}</p>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-500/30 bg-transparent p-6 shadow-xl shadow-slate-950/10 backdrop-blur-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-3xl font-semibold text-white">Current Guests Snapshot</h3>
          <p className="text-base text-slate-400">{lastUpdatedLabel}</p>
        </div>

        {customers.length === 0 ? (
          <p className="text-lg text-slate-300">No recognized customers yet in the current frame.</p>
        ) : (
          <div className="space-y-3">
            {customers.map((customer) => (
              <div
                key={customer.id}
                className="rounded-xl border border-slate-600/50 bg-slate-950/30 p-4"
              >
                <p className="text-2xl font-semibold text-slate-100">{customer.name}</p>
                <div className="mt-2 flex flex-wrap gap-4 text-base text-slate-300">
                  <span className="inline-flex items-center gap-2">
                    <Smile size={16} />
                    Mood: <span className="capitalize text-slate-100">{customer.mood}</span>
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Users size={16} />
                    Match confidence: {Math.round(Number(customer.confidence) * 100)}%
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <UtensilsCrossed size={16} />
                    Eating: <span className="text-slate-100">{customer.latestFood}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default LiveCafeInsights;
