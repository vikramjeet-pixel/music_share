"use client";

import React, { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { X, Copy, Check, QrCode, Smartphone } from "lucide-react";

interface ShareRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomCode: string;
}

export function ShareRoomModal({ isOpen, onClose, roomCode }: ShareRoomModalProps) {
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setShareUrl(`${window.location.origin}/room/${roomCode}`);
    }
  }, [roomCode]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl || roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="relative max-w-sm w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-center">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/60 hover:bg-slate-800 transition"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="w-12 h-12 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <QrCode className="w-6 h-6" />
        </div>

        <h3 className="text-xl font-bold text-white mb-1">Invite Devices to Sync</h3>
        <p className="text-xs text-slate-400 mb-6">
          Scan the QR code or enter the 6-character code on any phone, tablet, or laptop.
        </p>

        {/* Big Monospace Room Code Display */}
        <div className="bg-slate-950/80 border border-cyan-500/30 rounded-2xl p-4 mb-6">
          <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">
            6-Character Room Code
          </div>
          <div className="text-3xl font-mono font-extrabold tracking-[0.25em] text-cyan-300">
            {roomCode}
          </div>
        </div>

        {/* QR Code Container */}
        <div className="p-4 bg-white rounded-2xl inline-block shadow-xl shadow-cyan-500/5 mb-6">
          <QRCodeSVG
            value={shareUrl || `https://syncbeat.app/room/${roomCode}`}
            size={180}
            level="H"
            includeMargin={false}
          />
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            onClick={handleCopy}
            className="w-full py-3 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? "Link Copied to Clipboard!" : "Copy Soundstage Link"}
          </button>

          <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1.5 mt-2">
            <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
            Works on iOS Safari, Android Chrome, and Desktop
          </p>
        </div>
      </div>
    </div>
  );
}
