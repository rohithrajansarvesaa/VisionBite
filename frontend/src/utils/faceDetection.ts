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
  scoreThreshold: 0.2,
});

const tinySensitiveDetectorOptions = new faceapi.TinyFaceDetectorOptions({
  inputSize: 512,
  scoreThreshold: 0.1,
});

export const loadModels = async (options: LoadModelOptions = {}) => {
  const { preferHighAccuracy = false } = options;

  if (modelsLoaded && (!preferHighAccuracy || ssdModelLoaded)) return;

  const baseUrl = import.meta.env.BASE_URL || '/';
  const MODEL_URL = `${baseUrl.replace(/\/$/, '')}/models`;
  
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

  const filterReliableDetections = (
    detections: faceapi.WithFaceExpressions<faceapi.WithFaceDescriptor<faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }, faceapi.FaceLandmarks68>>>[]
  ) => {
    const frameWidth = imageElement.width || (imageElement as HTMLVideoElement).videoWidth || 1;
    const frameHeight = imageElement.height || (imageElement as HTMLVideoElement).videoHeight || 1;
    const frameArea = frameWidth * frameHeight;

    return detections.filter((result) => {
      const score = result.detection?.score ?? 0;
      const box = result.detection?.box;
      const boxArea = box ? box.width * box.height : 0;
      const areaRatio = frameArea > 0 ? boxArea / frameArea : 0;

      // Remove noisy detections (tiny/low-confidence regions) that cause false face counts.
      return score >= 0.2 && areaRatio >= 0.015;
    });
  };

  const pickLargerSet = (
    current: faceapi.WithFaceExpressions<faceapi.WithFaceDescriptor<faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }, faceapi.FaceLandmarks68>>>[],
    candidate: faceapi.WithFaceExpressions<faceapi.WithFaceDescriptor<faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }, faceapi.FaceLandmarks68>>>[]
  ) => {
    return candidate.length > current.length ? candidate : current;
  };

  // 1) Fast tiny detector
  let detections = await runDetectAll(tinyDetectorOptions);

  // 2) Sensitive tiny detector can detect smaller/fainter faces; keep whichever finds more
  const sensitiveDetections = await runDetectAll(tinySensitiveDetectorOptions);
  detections = pickLargerSet(detections, sensitiveDetections);

  // 3) SSD can perform better for harder scenes; compare and keep higher face count
  if (highAccuracy || ssdModelLoaded || detections.length <= 1) {
    if (!ssdModelLoaded) {
      await loadModels({ preferHighAccuracy: true });
    }
    if (ssdModelLoaded) {
      const ssdDetections = await runDetectAll(new faceapi.SsdMobilenetv1Options({ minConfidence: 0.35 }));
      detections = pickLargerSet(detections, ssdDetections);
    }
  }

  return filterReliableDetections(detections);
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

    return new Promise((resolve, reject) => {
      const handleLoadedMetadata = async () => {
        videoElement.onloadedmetadata = null;
        try {
          await videoElement.play();
          resolve(stream);
        } catch {
          reject(new Error('Camera stream started, but video playback was blocked.'));
        }
      };

      videoElement.onloadedmetadata = handleLoadedMetadata;
      videoElement.srcObject = stream;

      if (videoElement.readyState >= 1) {
        void handleLoadedMetadata();
      }
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
