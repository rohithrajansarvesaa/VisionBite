type DrawOptions = {
  strokeStyle?: string;
  textColor?: string;
  labelBackground?: string;
  lineWidth?: number;
  font?: string;
};

const defaultOptions: Required<DrawOptions> = {
  strokeStyle: '#22c55e',
  textColor: '#ffffff',
  labelBackground: 'rgba(15, 23, 42, 0.85)',
  lineWidth: 3,
  font: '14px sans-serif',
};

export const drawLabeledDetections = (
  canvas: HTMLCanvasElement,
  detections: any[],
  labels: string[],
  options: DrawOptions = {}
) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const mergedOptions = { ...defaultOptions, ...options };
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.lineWidth = mergedOptions.lineWidth;
  ctx.strokeStyle = mergedOptions.strokeStyle;
  ctx.font = mergedOptions.font;
  ctx.textBaseline = 'top';

  detections.forEach((detection, index) => {
    const box = detection.detection.box;
    const label = labels[index] || 'Unknown';

    ctx.strokeRect(box.x, box.y, box.width, box.height);

    const padding = 6;
    const textWidth = ctx.measureText(label).width;
    const textHeight = parseInt(mergedOptions.font, 10) + 4;
    const labelX = box.x;
    const labelY = Math.max(0, box.y - textHeight - padding);

    ctx.fillStyle = mergedOptions.labelBackground;
    ctx.fillRect(labelX, labelY, textWidth + padding * 2, textHeight + padding);

    ctx.fillStyle = mergedOptions.textColor;
    ctx.fillText(label, labelX + padding, labelY + padding / 2);
  });
};
