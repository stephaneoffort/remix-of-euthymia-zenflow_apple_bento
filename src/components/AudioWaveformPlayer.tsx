import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Play, Pause } from 'lucide-react';

interface AudioWaveformPlayerProps {
  url: string;
}

const BAR_COUNT = 32;
const BAR_WIDTH = 3;
const BAR_GAP = 2;
const CANVAS_HEIGHT = 36;
const CANVAS_WIDTH = BAR_COUNT * (BAR_WIDTH + BAR_GAP);

function generateBars(audioBuffer: AudioBuffer): number[] {
  const raw = audioBuffer.getChannelData(0);
  const blockSize = Math.floor(raw.length / BAR_COUNT);
  const bars: number[] = [];
  for (let i = 0; i < BAR_COUNT; i++) {
    let sum = 0;
    const start = i * blockSize;
    for (let j = start; j < start + blockSize; j++) {
      sum += Math.abs(raw[j]);
    }
    bars.push(sum / blockSize);
  }
  const max = Math.max(...bars, 0.01);
  return bars.map(b => Math.max(0.08, b / max));
}

function generatePlaceholderBars(): number[] {
  return Array.from({ length: BAR_COUNT }, (_, i) => {
    const x = i / BAR_COUNT;
    return 0.15 + 0.35 * Math.sin(x * Math.PI * 3) + 0.15 * Math.sin(x * Math.PI * 7 + 1);
  });
}

export default function AudioWaveformPlayer({ url }: AudioWaveformPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const [bars, setBars] = useState<number[]>(generatePlaceholderBars);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loaded, setLoaded] = useState(false);

  // Decode audio to get waveform
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(url);
        const buf = await res.arrayBuffer();
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const decoded = await ctx.decodeAudioData(buf);
        if (!cancelled) {
          setBars(generateBars(decoded));
          setLoaded(true);
        }
        ctx.close();
      } catch {
        // keep placeholder bars
        setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [url]);

  // Draw waveform
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_WIDTH * dpr;
    canvas.height = CANVAS_HEIGHT * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const progressIdx = Math.floor(progress * BAR_COUNT);

    bars.forEach((h, i) => {
      const barH = Math.max(4, h * (CANVAS_HEIGHT - 4));
      const x = i * (BAR_WIDTH + BAR_GAP);
      const y = (CANVAS_HEIGHT - barH) / 2;
      const played = i <= progressIdx;

      ctx.beginPath();
      ctx.roundRect(x, y, BAR_WIDTH, barH, 1.5);
      ctx.fillStyle = played
        ? 'hsl(var(--primary))'
        : 'hsl(var(--muted-foreground) / 0.35)';
      ctx.fill();
    });
  }, [bars, progress]);

  useEffect(() => { draw(); }, [draw]);

  // Animation loop while playing
  useEffect(() => {
    if (!playing) return;
    const tick = () => {
      const audio = audioRef.current;
      if (audio && audio.duration) {
        setProgress(audio.currentTime / audio.duration);
      }
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [playing]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play();
      setPlaying(true);
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    audio.currentTime = pct * audio.duration;
    setProgress(pct);
  };

  const formatTime = (s: number) => {
    if (!s || !isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="mt-1.5 flex items-center gap-2.5 pl-2 pr-3 py-2 rounded-2xl bg-muted/70 max-w-[320px]">
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onLoadedMetadata={() => {
          const d = audioRef.current?.duration;
          if (d && isFinite(d)) setDuration(d);
        }}
        onEnded={() => { setPlaying(false); setProgress(0); }}
      />

      <button
        onClick={togglePlay}
        className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 hover:opacity-90 transition-opacity active:scale-95"
      >
        {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
      </button>

      <div className="flex flex-col gap-1 min-w-0">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, cursor: 'pointer' }}
          onClick={handleCanvasClick}
        />
        <span className="text-label text-muted-foreground tabular-nums leading-none">
          {playing || progress > 0
            ? `${formatTime((audioRef.current?.currentTime) || 0)} / ${formatTime(duration)}`
            : formatTime(duration)
          }
        </span>
      </div>
    </div>
  );
}