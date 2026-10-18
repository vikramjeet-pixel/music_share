"use client";

import React, { useState, useRef } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Disc3,
  Clock,
  Sparkles,
  ExternalLink,
  Upload,
  Link2,
  Music2,
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
  const [customUrl, setCustomUrl] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isPlaying = playback.status === "playing";
  const currentTrack = findTrackByUrl(playback.trackUrl) || {
    id: "custom",
    title: playback.trackTitle || "Custom Track",
    artist: "Selected Audio Source",
    url: playback.trackUrl,
    durationSec: durationSec || 60,
    hue: "from-cyan-500 via-sky-500 to-blue-600",
  };
  const safeDuration = durationSec > 0 ? durationSec : currentTrack.durationSec || 60;

  // Search query for external apps
  const searchQuery = encodeURIComponent(
    `${playback.trackTitle || currentTrack.title} ${currentTrack.artist || ""}`.trim()
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    const cleanTitle = file.name.replace(/\.[^/.]+$/, "");
    onSelectTrack(objectUrl, cleanTitle);
  };

  const handleCustomUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUrl.trim()) return;
    const title = customTitle.trim() || "Custom Web Stream";
    onSelectTrack(customUrl.trim(), title);
    setCustomUrl("");
    setCustomTitle("");
  };

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
            className={`w-16 h-16 rounded-full flex items-center justify-center text-white shadow-xl transition-all cursor-pointer ${
              isPlaying
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

        {/* Volume & Mute Slider */}
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

      {/* External Music Apps Quick Launchers (YouTube, Spotify, Apple Music, SoundCloud) */}
      <div className="pt-3 border-t border-slate-800/70">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
            Open in Music Apps
          </span>
          <span className="text-[11px] text-slate-500">Listen externally</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* YouTube */}
          <a
            href={`https://www.youtube.com/results?search_query=${searchQuery}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-red-950/40 hover:bg-red-900/50 border border-red-800/40 text-red-200 text-xs font-semibold transition"
          >
            <span className="w-2 h-2 rounded-full bg-red-500" />
            YouTube
          </a>

          {/* Spotify */}
          <a
            href={`https://open.spotify.com/search/${searchQuery}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-800/40 text-emerald-200 text-xs font-semibold transition"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Spotify
          </a>

          {/* Apple Music */}
          <a
            href={`https://music.apple.com/search?term=${searchQuery}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-pink-950/40 hover:bg-pink-900/50 border border-pink-800/40 text-pink-200 text-xs font-semibold transition"
          >
            <span className="w-2 h-2 rounded-full bg-pink-500" />
            Apple Music
          </a>

          {/* SoundCloud */}
          <a
            href={`https://soundcloud.com/search?q=${searchQuery}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-orange-950/40 hover:bg-orange-900/50 border border-orange-800/40 text-orange-200 text-xs font-semibold transition"
          >
            <span className="w-2 h-2 rounded-full bg-orange-500" />
            SoundCloud
          </a>
        </div>
      </div>

      {/* Custom Audio Upload & Web Stream URL */}
      {isHost && (
        <div className="pt-3 border-t border-slate-800/70">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5 text-sky-400" />
              Play Your Own Audio File or Stream
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            {/* Local MP3 File Picker */}
            <input
              type="file"
              ref={fileInputRef}
              accept="audio/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium rounded-xl transition flex items-center justify-center gap-2 shrink-0 cursor-pointer"
            >
              <Music2 className="w-4 h-4 text-cyan-400" />
              Upload MP3 / Audio File
            </button>

            {/* Custom URL Input */}
            <form onSubmit={handleCustomUrlSubmit} className="flex-1 flex gap-2">
              <input
                type="url"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="Paste direct MP3 / audio stream URL..."
                className="flex-1 py-2 px-3 bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none transition"
              />
              <button
                type="submit"
                className="py-2 px-3 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-xl transition shrink-0 cursor-pointer"
              >
                Load Stream
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Preset Demo Tracks Carousel */}
      <div className="pt-3 border-t border-slate-800/70">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            Preset Sync Tracks ({DEMO_TRACKS.length})
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
