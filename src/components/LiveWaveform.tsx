import React, { useRef, useEffect } from 'react';

interface LiveWaveformProps {
  stream: MediaStream;
}

const BAR_COUNT = 24;
const BAR_WIDTH = 3;
const BAR_GAP = 2;
const HEIGHT = 32;
const WIDTH = BAR_COUNT * (BAR_WIDTH + BAR_GAP);

export default function LiveWaveform({ stream }: LiveWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.7;
    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const dpr = window.devicePixelRatio || 1;

    canvas.width = WIDTH * dpr;
    canvas.height = HEIGHT * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    const draw = () => {
      analyser.getByteFrequencyData(dataArray);
      ctx.clearRect(0, 0, WIDTH, HEIGHT);

      for (let i = 0; i < BAR_COUNT; i++) {
        // Map bars to frequency bins — pick evenly or wrap
        const dataIdx = Math.min(i, bufferLength - 1);
        const val = dataArray[dataIdx] / 255;
        const barH = Math.max(4, val * (HEIGHT - 4));
        const x = i * (BAR_WIDTH + BAR_GAP);
        const y = (HEIGHT - barH) / 2;

        ctx.beginPath();
        ctx.roundRect(x, y, BAR_WIDTH, barH, 1.5);
        ctx.fillStyle = `hsl(var(--destructive) / ${0.4 + val * 0.6})`;
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
      source.disconnect();
      analyser.disconnect();
      audioCtx.close();
    };
  }, [stream]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: WIDTH, height: HEIGHT }}
      className="shrink-0"
    />
  );
}