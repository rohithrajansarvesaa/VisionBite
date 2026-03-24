import * as faceapi from 'face-api.js';

let modelsLoaded = false;
let ssdModelLoaded = false;
let ssdLoadAttempted = false;

type LoadModelOptions = {
  preferHighAccuracy?: boolean;
};

type DetectFaceOptions = {
  highAccuracy?: boolean;
};

const tinyDetectorOptions = new faceapi.TinyFaceDetectorOptions({
  inputSize: 416,
  scoreThreshold: 0.3,
});

const tinySensitiveDetectorOptions = new faceapi.TinyFaceDetectorOptions({
  inputSize: 320,
  scoreThreshold: 0.15,
});

export const loadModels = async (options: LoadModelOptions = {}) => {
  const { preferHighAccuracy = false } = options;

  if (modelsLoaded && (!preferHighAccuracy || ssdModelLoaded)) return;

  const MODEL_URL = '/models';
  
  try {
    if (!modelsLoaded) {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
      ]);
    }

    if (preferHighAccuracy && !ssdModelLoaded && !ssdLoadAttempted) {
      ssdLoadAttempted = true;
      try {
        await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
        ssdModelLoaded = true;
      } catch {
        // Optional model. Keep working with TinyFaceDetector when SSD files are not present.
        ssdModelLoaded = false;
      }
    }
    
    modelsLoaded = true;
    console.log('✅ Face detection models loaded');
  } catch (error) {
    console.error('Error loading models:', error);
    throw new Error('Failed to load face detection models');
  }
};

export const detectFaceWithExpression = async (
  imageElement: HTMLImageElement | HTMLVideoElement,
  options: DetectFaceOptions = {}
) => {
  const { highAccuracy = false } = options;

  if (!modelsLoaded) {
    await loadModels({ preferHighAccuracy: highAccuracy });
  } else if (highAccuracy && !ssdModelLoaded) {
    await loadModels({ preferHighAccuracy: true });
  }

  const runDetect = async (
    detector: faceapi.TinyFaceDetectorOptions | faceapi.SsdMobilenetv1Options
  ) => {
    return faceapi
      .detectSingleFace(imageElement, detector)
      .withFaceLandmarks()
      .withFaceDescriptor()
      .withFaceExpressions();
  };

  let detection = null;

  // 1) Fast path
  if (!highAccuracy) {
    detection = await runDetect(tinyDetectorOptions);
  }

  // 2) More sensitive tiny detector for difficult lighting/angles
  if (!detection) {
    detection = await runDetect(tinySensitiveDetectorOptions);
  }

  // 3) High-accuracy SSD fallback when model is available
  if (!detection && (highAccuracy || ssdModelLoaded)) {
    if (!ssdModelLoaded) {
      await loadModels({ preferHighAccuracy: true });
    }
    if (ssdModelLoaded) {
      detection = await runDetect(new faceapi.SsdMobilenetv1Options({ minConfidence: 0.35 }));
    }
  }

  return detection;
};

export const detectAllFacesWithExpression = async (
  imageElement: HTMLImageElement | HTMLVideoElement,
  options: DetectFaceOptions = {}
) => {
  const { highAccuracy = false } = options;

  if (!modelsLoaded) {
    await loadModels({ preferHighAccuracy: highAccuracy });
  } else if (highAccuracy && !ssdModelLoaded) {
    await loadModels({ preferHighAccuracy: true });
  }

  const runDetectAll = async (
    detector: faceapi.TinyFaceDetectorOptions | faceapi.SsdMobilenetv1Options
  ) => {
    return faceapi
      .detectAllFaces(imageElement, detector)
      .withFaceLandmarks()
      .withFaceDescriptors()
      .withFaceExpressions();
  };

  // 1) Fast tiny detector
  let detections = await runDetectAll(tinyDetectorOptions);

  // 2) Sensitive tiny detector fallback
  if (detections.length === 0) {
    detections = await runDetectAll(tinySensitiveDetectorOptions);
  }

  // 3) SSD fallback for hard scenes / backlit faces
  if (detections.length === 0 && (highAccuracy || ssdModelLoaded)) {
    if (!ssdModelLoaded) {
      await loadModels({ preferHighAccuracy: true });
    }
    if (ssdModelLoaded) {
      detections = await runDetectAll(new faceapi.SsdMobilenetv1Options({ minConfidence: 0.35 }));
    }
  }

  return detections;
};

export const getDominantEmotion = (expressions: any) => {
  if (!expressions) return 'neutral';

  const emotions = Object.entries(expressions) as [string, number][];
  emotions.sort((a, b) => b[1] - a[1]);
  
  return emotions[0][0];
};

export const startWebcam = async (videoElement: HTMLVideoElement): Promise<MediaStream> => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });
    
    videoElement.srcObject = stream;
    
    return new Promise((resolve) => {
      videoElement.onloadedmetadata = () => {
        videoElement.play();
        resolve(stream);
      };
    });
  } catch (error) {
    console.error('Error accessing webcam:', error);
    throw new Error('Cannot access webcam. Please ensure camera permissions are granted.');
  }
};

export const stopWebcam = (stream: MediaStream | null) => {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }
};

export const captureFrameFromVideo = (video: HTMLVideoElement): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.drawImage(video, 0, 0);
  }
  
  return canvas;
};
