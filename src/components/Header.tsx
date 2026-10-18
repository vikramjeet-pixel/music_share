"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Waves,
  QrCode,
  Copy,
  Check,
  Download,
  LogIn,
  LogOut,
  User,
  Radio,
  Wifi,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface HeaderProps {
  roomCode?: string;
  onOpenShare?: () => void;
  isFirebaseActive?: boolean;
}

export function Header({ roomCode, onOpenShare, isFirebaseActive }: HeaderProps) {
  const { user, configured, signInWithGoogle, signOut } = useAuth();
  const [copied, setCopied] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setCanInstall(false);
    }
  };

  const handleCopyCode = () => {
    if (!roomCode) return;
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 via-sky-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/25 group-hover:scale-105 transition-transform">
            <Waves className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-lg text-white tracking-tight">SyncBeat</span>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 uppercase tracking-wider">
                PWA
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono -mt-0.5">sub-30ms audio sync</p>
          </div>
        </Link>

        {/* Center Room Code Pill if in room */}
        {roomCode && (
          <div className="flex items-center gap-1.5 bg-slate-900/90 border border-cyan-500/30 rounded-2xl p-1.5 pl-3">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Room</span>
            <span className="font-mono font-bold text-cyan-300 text-sm tracking-wider mr-1">
              {roomCode}
            </span>

            <button
              onClick={handleCopyCode}
              title="Copy Room Code"
              className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>

            {onOpenShare && (
              <button
                onClick={onOpenShare}
                title="Open QR Code Invite"
                className="p-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 transition"
              >
                <QrCode className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Right Action Icons & Auth */}
        <div className="flex items-center gap-2.5">
          {/* Connection status badge */}
          <div
            title={isFirebaseActive ? "Connected to Firebase RTDB & NTP Offset" : "Running on Local Mesh Broadcast (Config in .env.local)"}
            className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
              isFirebaseActive
                ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
                : "bg-amber-950/40 border-amber-500/30 text-amber-300"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isFirebaseActive ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
              }`}
            />
            {isFirebaseActive ? "RTDB Live" : "Local Sync Mesh"}
          </div>

          {/* PWA Install Button */}
          {canInstall && (
            <button
              onClick={handleInstall}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-cyan-500/20 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Install App
            </button>
          )}

          {/* Host Authentication (Google OAuth option for Host) */}
          {configured && user ? (
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-2xl p-1 pr-2.5">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || "User"}
                  className="w-7 h-7 rounded-xl object-cover"
                />
              ) : (
                <div className="w-7 h-7 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center">
                  <User className="w-3.5 h-3.5" />
                </div>
              )}
              <div className="hidden md:block text-left text-[11px] leading-tight">
                <div className="font-semibold text-white truncate max-w-[100px]">
                  {user.displayName || (user.isAnonymous ? "Guest Host" : user.email)}
                </div>
                <div className="text-slate-400 text-[10px]">
                  {user.isAnonymous ? "Anonymous" : "Google"}
                </div>
              </div>

              {user.isAnonymous ? (
                <button
                  onClick={signInWithGoogle}
                  title="Upgrade to Google Account"
                  className="ml-1 text-xs text-cyan-400 hover:text-cyan-300 font-semibold px-2 py-0.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 transition"
                >
                  Link Google
                </button>
              ) : (
                <button
                  onClick={signOut}
                  title="Sign Out"
                  className="p-1 rounded-lg text-slate-400 hover:text-rose-400 transition"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
