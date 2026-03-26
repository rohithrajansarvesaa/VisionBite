import React, { useRef, useEffect, useState } from 'react';
import { Camera, X, Loader2 } from 'lucide-react';
import * as faceapi from 'face-api.js';
import { customerService } from '../../services/api';
import { drawLabeledDetections } from '../../utils/faceOverlay';
import { FaceMatchResponse } from '../../types/customer';
import { loadModels, detectFaceWithExpression, getDominantEmotion, startWebcam, stopWebcam } from '../../utils/faceDetection';

interface WebcamCaptureProps {
  onCapture: (descriptor: number[], emotion: string) => void;
  onClose: () => void;
  title: string;
}

const WebcamCapture: React.FC<WebcamCaptureProps> = ({ onCapture, onClose, title }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [detectedEmotion, setDetectedEmotion] = useState<string>('');
  const [faceDetected, setFaceDetected] = useState(false);
  const [detectionConfidence, setDetectionConfidence] = useState<number>(0);
  const [detectedLabel, setDetectedLabel] = useState<string>('');
  const animationRef = useRef<number>();
  const isDetectingRef = useRef(false);
  const isMountedRef = useRef(true);
  const stableFaceFramesRef = useRef(0);
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
      
      // Load face detection models
      await loadModels();
      
      // Start webcam
      if (videoRef.current) {
        const mediaStream = await startWebcam(videoRef.current);
        setStream(mediaStream);
        streamRef.current = mediaStream;
        setIsLoading(false);
        
        // Start face detection loop
        startFaceDetection();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to initialize camera');
      setIsLoading(false);
    }
  };

  const startFaceDetection = () => {
    const detectFrame = async () => {
      if (isDetectingRef.current || !isMountedRef.current) {
        animationRef.current = requestAnimationFrame(detectFrame);
        return;
      }

      if (videoRef.current && videoRef.current.readyState === 4) {
        isDetectingRef.current = true;
        const detection = await detectFaceWithExpression(videoRef.current, { highAccuracy: false });
        
        if (detection) {
          const detectionScore = detection.detection?.score ?? 0;
          const hasLandmarks = Boolean(detection.landmarks?.positions?.length);

          if (detectionScore > 0.45 || hasLandmarks) {
            stableFaceFramesRef.current += 1;
          } else {
            stableFaceFramesRef.current = 0;
          }

          setFaceDetected(stableFaceFramesRef.current >= 2);
          setDetectionConfidence(detectionScore);
          const emotion = getDominantEmotion(detection.expressions);
          setDetectedEmotion(emotion);

          if (detection.descriptor) {
            const now = Date.now();
            if (!isMatchingRef.current && now - lastMatchRef.current > 1200) {
              isMatchingRef.current = true;
              lastMatchRef.current = now;

              customerService
                .matchCustomer(Array.from(detection.descriptor))
                .then((response) => {
                  const data = response.data as FaceMatchResponse;
                  if (data.matched && data.customer?.name) {
                    setDetectedLabel(data.customer.name);
                  } else {
                    setDetectedLabel('Unknown');
                  }
                })
                .catch(() => {
                  setDetectedLabel('Unknown');
                })
                .finally(() => {
                  isMatchingRef.current = false;
                });
            }
          }
          
          // Draw detection box
          if (canvasRef.current) {
            const displaySize = {
              width: videoRef.current.videoWidth,
              height: videoRef.current.videoHeight,
            };
            faceapi.matchDimensions(canvasRef.current, displaySize);
            const resizedDetection = faceapi.resizeResults(detection, displaySize);

            drawLabeledDetections(canvasRef.current, [resizedDetection], [detectedLabel || 'Unknown']);
          }
        } else {
          stableFaceFramesRef.current = 0;
          setFaceDetected(false);
          setDetectedEmotion('');
          setDetectionConfidence(0);
          setDetectedLabel('');

          if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
              ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            }
          }
        }

        isDetectingRef.current = false;
      }
      
      animationRef.current = requestAnimationFrame(detectFrame);
    };
    
    detectFrame();
  };

  const handleCapture = async () => {
    if (!videoRef.current || !faceDetected) {
      setError('Please ensure your face is clearly visible');
      return;
    }

    try {
      const descriptors: number[][] = [];
      const emotions: string[] = [];

      // Capture multiple frames and average descriptors to reduce one-frame noise.
      for (let i = 0; i < 5; i += 1) {
        const detection = await detectFaceWithExpression(videoRef.current, { highAccuracy: true });
        if (detection?.descriptor) {
          descriptors.push(Array.from(detection.descriptor));
          emotions.push(getDominantEmotion(detection.expressions));
        }

        await new Promise((resolve) => window.setTimeout(resolve, 120));
      }

      if (descriptors.length < 3) {
        setError('No face detected. Please try again.');
        return;
      }

      const descriptorLength = descriptors[0].length;
      const descriptor = Array.from({ length: descriptorLength }, (_, index) => {
        let sum = 0;
        for (const sample of descriptors) {
          sum += sample[index];
        }
        return sum / descriptors.length;
      });

      const emotionCount = emotions.reduce<Record<string, number>>((acc, emotion) => {
        acc[emotion] = (acc[emotion] ?? 0) + 1;
        return acc;
      }, {});

      const emotion = Object.entries(emotionCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral';
      
      onCapture(descriptor, emotion);
    } catch (err: any) {
      setError(err.message || 'Failed to capture face');
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
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
          <button
            onClick={() => {
              cleanup();
              onClose();
            }}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>

        <div className="relative">
          <div className="relative bg-black rounded-lg overflow-hidden" style={{ height: '480px' }}>
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              autoPlay
              muted
              playsInline
            />
            <canvas
              ref={canvasRef}
              className="absolute top-0 left-0 w-full h-full"
            />
          </div>

          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
              <div className="text-center text-white">
                <Loader2 className="animate-spin mx-auto mb-2" size={40} />
                <p>Loading camera and face detection models...</p>
              </div>
            </div>
          )}

          {detectedEmotion && (
            <div className="absolute top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg">
              <p className="text-sm font-semibold">Detected Mood</p>
              <p className="text-lg capitalize">{detectedEmotion}</p>
              <p className="text-xs opacity-90">
                Confidence: {Math.round(detectionConfidence * 100)}%
              </p>
            </div>
          )}

          {faceDetected && (
            <div className="absolute top-4 left-4 bg-green-500 text-white px-3 py-1 rounded-lg text-sm">
              ✓ Face Detected
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button
            onClick={handleCapture}
            disabled={!faceDetected || isLoading}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-semibold ${
              faceDetected && !isLoading
                ? 'bg-blue-500 hover:bg-blue-600 text-white'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            <Camera size={20} />
            Capture Face
          </button>
          <button
            onClick={() => {
              cleanup();
              onClose();
            }}
            className="px-6 py-3 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>

        <p className="mt-4 text-sm text-gray-600 text-center">
          Position your face in the frame. The system will automatically detect your face and emotion.
        </p>
      </div>
    </div>
  );
};

export default WebcamCapture;
