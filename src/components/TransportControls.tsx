"use client";

import React from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Disc3,
  Clock,
  Sparkles,
} from "lucide-react";
import * as Slider from "@radix-ui/react-slider";
import { DEMO_TRACKS, findTrackByUrl } from "@/lib/tracks";
import type { PlaybackState } from "@/lib/types";

interface TransportControlsProps {
  playback: PlaybackState;
  isHost: boolean;
  currentPositionSec: number;
  durationSec: number;
  volume: number;
  isMuted: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (posSec: number) => void;
  onSelectTrack: (url: string, title: string) => void;
  onVolumeChange: (val: number) => void;
  onToggleMute: () => void;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

export function TransportControls({
  playback,
  isHost,
  currentPositionSec,
  durationSec,
  volume,
  isMuted,
  onPlay,
  onPause,
  onSeek,
  onSelectTrack,
  onVolumeChange,
  onToggleMute,
}: TransportControlsProps) {
  const isPlaying = playback.status === "playing";
  const currentTrack = findTrackByUrl(playback.trackUrl) || DEMO_TRACKS[0];
  const safeDuration = durationSec > 0 ? durationSec : currentTrack.durationSec || 60;
  const progressPercent = Math.min(100, (currentPositionSec / safeDuration) * 100);

  return (
    <div className="bg-slate-900/80 border border-slate-800/90 rounded-3xl p-6 backdrop-blur-2xl shadow-2xl space-y-6">
      {/* Current Track Info Header */}
      <div className="flex items-center gap-4">
        {/* Animated Artwork Album Vinyl */}
        <div
          className={`relative w-20 h-20 rounded-2xl bg-gradient-to-tr ${currentTrack.hue} p-0.5 shadow-xl flex items-center justify-center shrink-0 overflow-hidden`}
        >
          <div className="absolute inset-0 bg-black/20" />
          <Disc3
            className={`w-10 h-10 text-white drop-shadow-md ${
              isPlaying ? "animate-[spin_4s_linear_infinite]" : ""
            }`}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 uppercase tracking-wider">
              {currentTrack.bpm ? `${currentTrack.bpm} BPM` : "Stereo"}
            </span>
            {isHost ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                Host Master Control
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400">
                Synchronized Listener
              </span>
            )}
          </div>
          <h2 className="text-xl font-bold text-white truncate tracking-tight">
            {playback.trackTitle || currentTrack.title}
          </h2>
          <p className="text-sm text-slate-400 truncate">{currentTrack.artist}</p>
        </div>
      </div>

      {/* Scrub Bar / Timeline Slider */}
      <div className="space-y-2">
        <Slider.Root
          className="relative flex items-center select-none touch-none w-full h-5 cursor-pointer group"
          value={[currentPositionSec]}
          max={safeDuration}
          step={0.5}
          disabled={!isHost}
          onValueChange={([val]) => {
            if (isHost) onSeek(val);
          }}
        >
          <Slider.Track className="bg-slate-800 relative grow rounded-full h-2 overflow-hidden">
            <Slider.Range className="absolute bg-gradient-to-r from-cyan-500 to-blue-500 h-full rounded-full" />
          </Slider.Track>
          {isHost && (
            <Slider.Thumb
              className="block w-4 h-4 bg-white shadow-lg shadow-cyan-500/50 rounded-full hover:scale-125 focus:outline-none transition-transform"
              aria-label="Track timeline scrub"
            />
          )}
        </Slider.Root>

        <div className="flex items-center justify-between text-xs font-mono text-slate-400">
          <span>{formatTime(currentPositionSec)}</span>
          <span className="text-[11px] text-slate-500">
            {isHost ? "Scrubbing seeks all devices" : "Locked to Host Timeline"}
          </span>
          <span>{formatTime(safeDuration)}</span>
        </div>
      </div>

      {/* Main Transport Button Row */}
      <div className="flex items-center justify-between pt-2">
        {/* Reset / Seek -10s */}
        <button
          onClick={() => isHost && onSeek(Math.max(0, currentPositionSec - 10))}
          disabled={!isHost}
          title="Seek backward 10 seconds"
          className="p-3 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 disabled:opacity-40 disabled:hover:bg-slate-800/80 transition cursor-pointer"
        >
          <RotateCcw className="w-5 h-5" />
        </button>

        {/* Master Play / Pause */}
        <div className="flex flex-col items-center gap-1.5">
          <button
            onClick={() => {
              if (isPlaying) onPause();
              else onPlay();
            }}
            disabled={!isHost}
            className={`w-16 h-16 rounded-full flex items-center justify-center text-white shadow-xl transition-all cursor-pointer ${
              !isHost
                ? "bg-slate-800 text-slate-500 opacity-60 cursor-not-allowed"
                : isPlaying
                ? "bg-gradient-to-tr from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 shadow-orange-500/25 active:scale-95"
                : "bg-gradient-to-tr from-cyan-500 via-sky-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-cyan-500/30 active:scale-95"
            }`}
          >
            {isPlaying ? (
              <Pause className="w-7 h-7 fill-white" />
            ) : (
              <Play className="w-7 h-7 fill-white translate-x-0.5" />
            )}
          </button>
          {!isHost && (
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3 text-cyan-400" />
              Controlled by Host
            </span>
          )}
        </div>

        {/* Volume & Mute Popover / Slider */}
        <div className="flex items-center gap-2 bg-slate-800/60 p-2 rounded-2xl border border-slate-700/50">
          <button
            onClick={onToggleMute}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-cyan-400" />
            )}
          </button>
          <div className="w-20">
            <Slider.Root
              className="relative flex items-center select-none touch-none w-full h-4 cursor-pointer"
              value={[isMuted ? 0 : volume]}
              max={1}
              step={0.05}
              onValueChange={([val]) => onVolumeChange(val)}
            >
              <Slider.Track className="bg-slate-700 relative grow rounded-full h-1.5 overflow-hidden">
                <Slider.Range className="absolute bg-cyan-400 h-full rounded-full" />
              </Slider.Track>
              <Slider.Thumb className="block w-3 h-3 bg-white rounded-full hover:scale-125 focus:outline-none transition-transform" />
            </Slider.Root>
          </div>
        </div>
      </div>

      {/* Track Selection Carousel (Clickable for Host) */}
      <div className="pt-2 border-t border-slate-800/70">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            Select Track ({DEMO_TRACKS.length})
          </span>
          {!isHost && (
            <span className="text-[11px] text-slate-500">Host selects track</span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {DEMO_TRACKS.map((t) => {
            const isSelected = playback.trackUrl === t.url;
            return (
              <button
                key={t.id}
                onClick={() => isHost && onSelectTrack(t.url, t.title)}
                disabled={!isHost}
                className={`p-3 rounded-2xl text-left border transition cursor-pointer ${
                  isSelected
                    ? "bg-cyan-500/10 border-cyan-500/40 text-white shadow-lg shadow-cyan-500/10"
                    : "bg-slate-800/40 border-slate-800 hover:bg-slate-800 text-slate-300 disabled:hover:bg-slate-800/40"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className={`w-3 h-3 rounded-full bg-gradient-to-tr ${t.hue} shrink-0`}
                  />
                  <div className="text-xs font-bold truncate">{t.title}</div>
                </div>
                <div className="text-[11px] text-slate-400 truncate">{t.artist}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
