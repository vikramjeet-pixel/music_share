"use client";

import React from "react";
import { Activity, Radio, Cpu, RefreshCw, Zap } from "lucide-react";
import type { ClockSnapshot } from "@/lib/clock-sync";
import type { DriftReport } from "@/lib/audio-engine";

interface DriftGaugeProps {
  clock: ClockSnapshot;
  drift: DriftReport;
  isPlaying: boolean;
  onRecalibrate?: () => void;
}

export function DriftGauge({ clock, drift, isPlaying, onRecalibrate }: DriftGaugeProps) {
  const absDrift = Math.abs(drift.driftMs);
  const isSub30 = absDrift <= 30;
  const isNudge = absDrift > 30 && absDrift <= 150;
  const isSeek = absDrift > 150;

  return (
    <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-xl shadow-xl">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/60">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white tracking-wide">Sync Engine Telemetry</h3>
            <p className="text-[11px] text-slate-400">NTP Clock Calibration & Drift Control</p>
          </div>
        </div>

        {onRecalibrate && (
          <button
            onClick={onRecalibrate}
            title="Recalibrate clock offset"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-cyan-300 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Main Drift Lock Banner */}
      <div className="mb-4">
        {isPlaying ? (
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between transition-all duration-300 ${
              isSub30
                ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300 shadow-lg shadow-emerald-950/20"
                : isNudge
                ? "bg-amber-950/40 border-amber-500/30 text-amber-300 shadow-lg shadow-amber-950/20"
                : "bg-rose-950/40 border-rose-500/30 text-rose-300 shadow-lg shadow-rose-950/20"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-3 w-3">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    isSub30 ? "bg-emerald-400" : isNudge ? "bg-amber-400" : "bg-rose-400"
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-3 w-3 ${
                    isSub30 ? "bg-emerald-500" : isNudge ? "bg-amber-500" : "bg-rose-500"
                  }`}
                />
              </span>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                  {isSub30 && "Sub-30ms Precision Lock"}
                  {isNudge && "Dynamic Rate Nudge"}
                  {isSeek && "Direct Micro-Seek"}
                  <span className="text-[10px] font-mono opacity-80">
                    ({drift.driftMs > 0 ? `+${drift.driftMs.toFixed(1)}` : drift.driftMs.toFixed(1)} ms)
                  </span>
                </div>
                <div className="text-[11px] opacity-75">
                  {isSub30 && "Speaker output aligned with server master timeline."}
                  {isNudge && `Correcting drift without pops (Rate: ${drift.rate.toFixed(3)}x).`}
                  {isSeek && "Re-aligning buffer position to master."}
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-lg font-mono font-bold tracking-tight">
                {absDrift.toFixed(0)}
                <span className="text-xs font-normal opacity-70">ms</span>
              </div>
              <div className="text-[10px] uppercase tracking-wider opacity-70 font-semibold">Drift</div>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/40 text-slate-400 text-xs flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            <span>Ready for scheduled playback. Clocks synchronized.</span>
          </div>
        )}
      </div>

      {/* Grid of Telemetry Metrics */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-2.5 text-center">
          <div className="text-[10px] uppercase font-semibold text-slate-400 mb-1 flex items-center justify-center gap-1">
            <Activity className="w-3 h-3 text-cyan-400" />
            RTT Latency
          </div>
          <div className="text-sm font-mono font-bold text-white">
            {clock.rttMs ? `${clock.rttMs.toFixed(0)} ms` : "< 20 ms"}
          </div>
          <div className="text-[10px] text-slate-400">1-way: ~{(clock.latencyMs || 10).toFixed(0)}ms</div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-2.5 text-center">
          <div className="text-[10px] uppercase font-semibold text-slate-400 mb-1 flex items-center justify-center gap-1">
            <Cpu className="w-3 h-3 text-sky-400" />
            Clock Offset
          </div>
          <div className="text-sm font-mono font-bold text-white">
            {clock.offsetMs >= 0 ? `+${clock.offsetMs.toFixed(0)}` : clock.offsetMs.toFixed(0)} ms
          </div>
          <div className="text-[10px] text-slate-400 font-mono">±{(clock.uncertaintyMs || 5).toFixed(0)}ms err</div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-2.5 text-center">
          <div className="text-[10px] uppercase font-semibold text-slate-400 mb-1">Schedule Buffer</div>
          <div className="text-sm font-mono font-bold text-cyan-300">1200 ms</div>
          <div className="text-[10px] text-slate-400">lead window</div>
        </div>
      </div>
    </div>
  );
}
