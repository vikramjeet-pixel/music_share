"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useRoom } from "@/hooks/useRoom";
import { Header } from "@/components/Header";
import { TransportControls } from "@/components/TransportControls";
import { Visualizer } from "@/components/Visualizer";
import { DriftGauge } from "@/components/DriftGauge";
import { MembersList } from "@/components/MembersList";
import { SoundstageModal } from "@/components/SoundstageModal";
import { ShareRoomModal } from "@/components/ShareRoomModal";
import { describeDevice } from "@/lib/room-code";
import { Sparkles, ArrowLeft, AlertTriangle } from "lucide-react";
import Link from "next/link";

export default function RoomClient() {
  const params = useParams();
  const router = useRouter();
  const roomCode = String(params.code || "").toUpperCase();
  const { user } = useAuth();
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [deviceLabel, setDeviceLabel] = useState("Detecting device...");

  useEffect(() => {
    setDeviceLabel(describeDevice());
  }, []);

  const room = useRoom({
    roomId: roomCode,
    userId: user?.uid,
    userName: user?.displayName || (user?.isAnonymous ? "Guest Host" : undefined),
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Header */}
      <Header
        roomCode={roomCode}
        onOpenShare={() => setShareModalOpen(true)}
        isFirebaseActive={room.isFirebaseActive}
      />

      {/* Main Content Soundstage View */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
        {/* Navigation Breadcrumb / Status bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Leave Room
          </Link>

          {!room.isFirebaseActive && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-300 text-xs">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Multi-device local sync active (test with 2 tabs or configure Firebase)</span>
            </div>
          )}
        </div>

        {/* 2-Column Responsive Layout: Left Transport + Visualizer, Right Telemetry + Mesh */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (Transport & Visualizer) */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            {/* Visualizer Panel */}
            <Visualizer
              analyser={room.audioEngine?.analyser ?? null}
              isPlaying={room.playback.status === "playing"}
            />

            {/* Transport Player Controls */}
            <TransportControls
              playback={room.playback}
              isHost={room.isHost}
              currentPositionSec={room.currentPositionSec}
              durationSec={room.durationSec}
              volume={room.volume}
              isMuted={room.isMuted}
              onPlay={() => room.play()}
              onPause={() => room.pause()}
              onSeek={(pos) => room.seek(pos)}
              onSelectTrack={(url, title) => room.selectTrack(url, title)}
              onVolumeChange={(val) => room.setVolume(val)}
              onToggleMute={() => room.toggleMute()}
            />
          </div>

          {/* Right Column (Sync Telemetry Gauge & Connected Devices Mesh) */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <DriftGauge
              clock={room.clockSnapshot}
              drift={room.latestDrift}
              isPlaying={room.playback.status === "playing"}
            />

            <MembersList
              members={room.members}
              hostUid={room.metadata?.hostUid}
              currentUserId={user?.uid}
            />
          </div>
        </div>
      </main>

      {/* Required Mobile Autoplay Soundstage Unlock Modal */}
      <SoundstageModal
        isOpen={!room.soundstageUnlocked}
        onUnlock={room.unlockSoundstage}
        deviceLabel={deviceLabel}
      />

      {/* Share / QR Code Modal */}
      <ShareRoomModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        roomCode={roomCode}
      />
    </div>
  );
}
