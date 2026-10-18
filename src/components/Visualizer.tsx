"use client";

import React, { useEffect, useRef } from "react";

interface VisualizerProps {
  analyser: AnalyserNode | null;
  isPlaying: boolean;
  className?: string;
  hueClass?: string;
}

export function Visualizer({ analyser, isPlaying, className = "", hueClass = "from-cyan-500 to-blue-500" }: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const bufferLength = analyser ? analyser.frequencyBinCount : 64;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      animId = requestAnimationFrame(render);

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      if (analyser && isPlaying) {
        analyser.getByteFrequencyData(dataArray);
      } else {
        // Idle ambient gentle wave
        const t = Date.now() * 0.002;
        for (let i = 0; i < bufferLength; i++) {
          dataArray[i] = Math.sin(i * 0.15 + t) * 12 + 18;
        }
      }

      const barWidth = (width / 48) - 2;
      let x = 2;

      for (let i = 0; i < 48; i++) {
        // Sample with emphasis on mids/treble
        const dataIdx = Math.floor(Math.pow(i / 48, 1.4) * (bufferLength / 2));
        const val = dataArray[dataIdx] || 4;
        const barHeight = Math.max(3, (val / 255) * (height - 6));

        // Gradient styling
        const grad = ctx.createLinearGradient(0, height, 0, 0);
        grad.addColorStop(0, "#06b6d4"); // cyan-500
        grad.addColorStop(0.6, "#3b82f6"); // blue-500
        grad.addColorStop(1, "#a855f7"); // purple-500

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, height - barHeight, Math.max(2, barWidth), barHeight, [3, 3, 0, 0]);
        ctx.fill();

        x += barWidth + 2;
      }
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [analyser, isPlaying]);

  return (
    <div className={`relative w-full overflow-hidden rounded-xl bg-slate-900/60 border border-slate-800/80 p-2 backdrop-blur-md ${className}`}>
      <canvas
        ref={canvasRef}
        width={360}
        height={56}
        className="w-full h-14 block"
      />
    </div>
  );
}
