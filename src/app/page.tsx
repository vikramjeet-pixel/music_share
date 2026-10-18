"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Waves,
  Play,
  Radio,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Smartphone,
  Cpu,
  Layers,
  HelpCircle,
} from "lucide-react";
import { generateRoomCode, normalizeRoomCode, isValidRoomCode } from "@/lib/room-code";
import { DEMO_TRACKS } from "@/lib/tracks";
import { Header } from "@/components/Header";
import { useAuth } from "@/hooks/useAuth";

export default function HomePage() {
  const router = useRouter();
  const { configured } = useAuth();
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);

  const handleCreateRoom = () => {
    const code = generateRoomCode();
    router.push(`/room/${code}`);
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = normalizeRoomCode(joinCode);
    if (!isValidRoomCode(clean)) {
      setJoinError("Please enter a valid 6-character room code.");
      return;
    }
    router.push(`/room/${clean}`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-cyan-500/30 selection:text-cyan-200">
      <Header isFirebaseActive={configured} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col gap-16">
        {/* Hero Section */}
        <div className="relative text-center max-w-3xl mx-auto pt-6 pb-2">
          {/* Subtle Glow Backdrop */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-semibold mb-6 shadow-sm">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>High-Precision Sub-30ms Audio Synchronization PWA</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight">
            Turn Any Device into a{" "}
            <span className="bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 bg-clip-text text-transparent">
              Synchronized Soundstage
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-400 leading-relaxed mb-10 max-w-2xl mx-auto">
            One host streams and synchronously triggers music across multiple phones, laptops, and tablets via a 6-character room code. Powered by NTP clock synchronization and Web Audio API buffer scheduling.
          </p>

          {/* Action Boxes: Create or Join */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto mb-10">
            {/* Create Room */}
            <div className="bg-slate-900/90 border border-cyan-500/30 hover:border-cyan-500/60 rounded-3xl p-6 text-left shadow-xl transition flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-3">
                  <Play className="w-5 h-5 fill-cyan-400" />
                </div>
                <h2 className="text-lg font-bold text-white mb-1">Host a Room</h2>
                <p className="text-xs text-slate-400 mb-6">
                  Generate a 6-character code and broadcast playback control to all listeners.
                </p>
              </div>

              <button
                onClick={handleCreateRoom}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold rounded-2xl shadow-lg shadow-cyan-500/25 active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer text-sm"
              >
                <span>Create Soundstage</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Join Room */}
            <div className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-3xl p-6 text-left shadow-xl transition flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-3">
                  <Waves className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold text-white mb-1">Join as Listener</h2>
                <p className="text-xs text-slate-400 mb-4">
                  Enter the 6-character room code from your host or scan their QR code.
                </p>
              </div>

              <form onSubmit={handleJoin} className="space-y-3">
                <div>
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => {
                      setJoinCode(e.target.value.toUpperCase());
                      setJoinError(null);
                    }}
                    placeholder="ENTER CODE (e.g. 7K9M2P)"
                    maxLength={6}
                    className="w-full py-3 px-4 bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl font-mono text-center text-sm font-bold tracking-widest text-cyan-300 placeholder:text-slate-600 focus:outline-none transition uppercase"
                  />
                  {joinError && (
                    <p className="text-[11px] text-rose-400 mt-1 text-center">{joinError}</p>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl text-sm transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  Join Soundstage
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Sync Architecture Features Grid */}
        <div className="space-y-6">
          <div className="text-center max-w-xl mx-auto">
            <h2 className="text-2xl font-bold text-white tracking-tight mb-2">
              High-Precision Synchronization Engine
            </h2>
            <p className="text-xs text-slate-400">
              Designed for true acoustic synchronization without echo or phase smearing.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-4">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">NTP Clock Calibration</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                5-sample ping-pong round-trip time (RTT) probes combined with RTDB serverTimeOffset to eliminate clock skew.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-4">
                <Cpu className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">Scheduled Buffer Playback</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Host schedules playback with a 1200ms future buffer window. AudioContext starts buffer at exact context time.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-4">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">Smooth Drift Nudging</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Continuous 2s drift tick smoothly modulates playbackRate (0.97x–1.03x) for 30–150ms drift without audio pops.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4">
                <Smartphone className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">Mobile PWA Compliance</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                One-tap soundstage unlock handles iOS and Android autoplay policy. Offline service worker caches audio for replay.
              </p>
            </div>
          </div>
        </div>

        {/* Demo Tracks Showcase */}
        <div className="p-6 rounded-3xl bg-slate-900/50 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Bundled Demo Tracks</h2>
              <p className="text-xs text-slate-400">
                Procedurally synthesized high-transient audio ready for drift testing.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {DEMO_TRACKS.map((t) => (
              <div
                key={t.id}
                className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center gap-3"
              >
                <div
                  className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${t.hue} flex items-center justify-center shrink-0`}
                >
                  <Waves className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">{t.title}</div>
                  <div className="text-[11px] text-slate-400 truncate">{t.artist}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        SyncBeat PWA · Sub-30ms Multi-Device Audio Synchronization · Built with Next.js & Web Audio API
      </footer>
    </div>
  );
}
