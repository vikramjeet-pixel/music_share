"use client";

import Link from "next/link";
import { WifiOff, RotateCcw } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-900/80 border border-slate-800 rounded-2xl p-8 text-center backdrop-blur-xl shadow-2xl">
        <div className="w-16 h-16 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <WifiOff className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight mb-2">You are Offline</h1>
        <p className="text-slate-400 text-sm mb-6 leading-relaxed">
          SyncBeat needs a network connection to synchronise device clocks and coordinate real-time playback. Cached tracks will be ready when you reconnect.
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25"
          >
            <RotateCcw className="w-4 h-4" />
            Retry Connection
          </button>
          <Link
            href="/"
            className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl transition text-center"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
