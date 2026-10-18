"use client";

import React, { useState } from "react";
import { Volume2, Sparkles, CheckCircle2 } from "lucide-react";

interface SoundstageModalProps {
  isOpen: boolean;
  onUnlock: () => Promise<boolean>;
  deviceLabel: string;
}

export function SoundstageModal({ isOpen, onUnlock, deviceLabel }: SoundstageModalProps) {
  const [unlocking, setUnlocking] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleUnlock = async () => {
    setUnlocking(true);
    try {
      const ok = await onUnlock();
      if (ok) {
        setSuccess(true);
      }
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="relative max-w-md w-full bg-slate-900 border border-cyan-500/30 rounded-3xl p-8 shadow-2xl shadow-cyan-500/10 text-center overflow-hidden">
        {/* Ambient glow backgrounds */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Pulse speaker icon */}
        <div className="relative mx-auto w-20 h-20 mb-6 flex items-center justify-center">
          <div className="absolute inset-0 bg-cyan-500/20 rounded-full animate-ping opacity-75" />
          <div className="relative w-20 h-20 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-cyan-500/30">
            {success ? <CheckCircle2 className="w-10 h-10" /> : <Volume2 className="w-10 h-10" />}
          </div>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          Mobile Autoplay Compliance
        </div>

        <h2 className="text-2xl font-bold tracking-tight text-white mb-2">
          Tap to Join Soundstage
        </h2>

        <p className="text-slate-400 text-sm leading-relaxed mb-6">
          Mobile browsers require direct user interaction to initialize low-latency Web Audio output and synchronize clocks with the host.
        </p>

        <div className="p-3 bg-slate-800/60 border border-slate-700/50 rounded-xl mb-6 text-xs text-slate-300 flex items-center justify-between">
          <span className="text-slate-400">Identified Device:</span>
          <span className="font-medium text-cyan-300" suppressHydrationWarning>{deviceLabel}</span>
        </div>

        <button
          onClick={handleUnlock}
          disabled={unlocking}
          className="w-full py-4 px-6 bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold rounded-2xl shadow-xl shadow-cyan-500/25 active:scale-[0.98] transition flex items-center justify-center gap-2 cursor-pointer"
        >
          {unlocking ? (
            <span className="inline-flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Unlocking AudioContext...
            </span>
          ) : (
            <span>Connect & Activate Audio</span>
          )}
        </button>
      </div>
    </div>
  );
}
