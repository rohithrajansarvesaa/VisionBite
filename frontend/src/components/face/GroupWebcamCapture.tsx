import React, { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, Users, X } from 'lucide-react';
import * as faceapi from 'face-api.js';
import { customerService } from '../../services/api';
import { drawLabeledDetections } from '../../utils/faceOverlay';
import { FaceMatchGroupResponse } from '../../types/customer';
import {
  detectAllFacesWithExpression,
  getDominantEmotion,
  loadModels,
  startWebcam,
  stopWebcam,
} from '../../utils/faceDetection';

interface CapturedFace {
  descriptor: number[];
  emotion: string;
}

interface GroupWebcamCaptureProps {
  onCapture: (faces: CapturedFace[]) => void;
  onClose: () => void;
  title: string;
}

const GroupWebcamCapture: React.FC<GroupWebcamCaptureProps> = ({ onCapture, onClose, title }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [faceCount, setFaceCount] = useState(0);
  const [faceLabels, setFaceLabels] = useState<string[]>([]);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number>();
  const isMountedRef = useRef(true);
  const isDetectingRef = useRef(false);
  const lastMatchRef = useRef(0);
  const isMatchingRef = useRef(false);

  useEffect(() => {
    initializeCamera();

    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, []);

  const initializeCamera = async () => {
    try {
      setIsLoading(true);
      setError('');

      await loadModels({ preferHighAccuracy: true });

      if (videoRef.current) {
        const mediaStream = await startWebcam(videoRef.current);
        streamRef.current = mediaStream;
        setStream(mediaStream);
        setIsLoading(false);
        startFaceDetectionLoop();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to initialize camera');
      setIsLoading(false);
    }
  };

  const startFaceDetectionLoop = () => {
    const detectFrame = async () => {
      if (!isMountedRef.current || isDetectingRef.current) {
        animationRef.current = requestAnimationFrame(detectFrame);
        return;
      }

      if (videoRef.current && videoRef.current.readyState === 4) {
        isDetectingRef.current = true;

        const detections = await detectAllFacesWithExpression(videoRef.current, { highAccuracy: false });
        setFaceCount(detections.length);
        maybeMatchFaces(detections);

        if (canvasRef.current) {
          const displaySize = {
            width: videoRef.current.videoWidth,
            height: videoRef.current.videoHeight,
          };

          faceapi.matchDimensions(canvasRef.current, displaySize);
          const resized = faceapi.resizeResults(detections, displaySize);

          const labels = resized.map((_, index) => faceLabels[index] || 'Unknown');
          drawLabeledDetections(canvasRef.current, resized, labels);
        }

        isDetectingRef.current = false;
      }

      animationRef.current = requestAnimationFrame(detectFrame);
    };

    detectFrame();
  };

  const maybeMatchFaces = (detections: any[]) => {
    if (detections.length === 0) {
      setFaceLabels([]);
      return;
    }

    const now = Date.now();
    if (isMatchingRef.current || now - lastMatchRef.current < 1200) {
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

  const captureGroup = async () => {
    if (!videoRef.current) {
      setError('Camera is not ready');
      return;
    }

    try {
      const detections = await detectAllFacesWithExpression(videoRef.current, { highAccuracy: true });

      if (detections.length === 0) {
        setError('No faces detected. Please try again.');
        return;
      }

      const faces: CapturedFace[] = detections.map((detection) => ({
        descriptor: Array.from(detection.descriptor),
        emotion: getDominantEmotion(detection.expressions),
      }));

      onCapture(faces);
    } catch (err: any) {
      setError(err.message || 'Failed to capture group');
    }
  };

  const cleanup = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    stopWebcam(streamRef.current || stream);
    streamRef.current = null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
      <div className="mx-4 w-full max-w-3xl rounded-lg bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
          <button
            onClick={() => {
              cleanup();
              onClose();
            }}
            className="text-gray-500 hover:text-gray-700"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        <div className="relative">
          <div className="relative h-[500px] overflow-hidden rounded-lg bg-black">
            <video ref={videoRef} className="h-full w-full object-cover" autoPlay muted playsInline />
            <canvas ref={canvasRef} className="absolute left-0 top-0 h-full w-full" />
          </div>

          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
              <div className="text-center text-white">
                <Loader2 className="mx-auto mb-2 animate-spin" size={40} />
                <p>Loading camera and models...</p>
              </div>
            </div>
          )}

          <div className="absolute left-4 top-4 rounded-lg bg-slate-900/80 px-3 py-2 text-white shadow">
            <div className="flex items-center gap-2 text-sm">
              <Users size={16} />
              <span>Faces in frame: {faceCount}</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded border border-red-400 bg-red-100 p-3 text-red-700">{error}</div>
        )}

        <div className="mt-6 flex gap-3">
          <button
            onClick={captureGroup}
            disabled={isLoading}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-3 font-semibold ${
              !isLoading
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'cursor-not-allowed bg-gray-300 text-gray-500'
            }`}
          >
            <Camera size={20} />
            {faceCount > 0 ? 'Capture Group' : 'Try Capture'}
          </button>
          <button
            onClick={() => {
              cleanup();
              onClose();
            }}
            className="rounded-lg border border-gray-300 px-6 py-3 font-semibold hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>

        <p className="mt-4 text-center text-sm text-gray-600">
          Position all customers inside the frame before capture.
        </p>
      </div>
    </div>
  );
};

export default GroupWebcamCapture;
