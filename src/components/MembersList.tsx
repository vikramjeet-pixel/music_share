"use client";

import React from "react";
import { Users, Crown, Smartphone, Laptop, Check, AlertCircle } from "lucide-react";
import type { RoomMember } from "@/lib/types";

interface MembersListProps {
  members: Record<string, RoomMember>;
  hostUid?: string;
  currentUserId?: string;
}

export function MembersList({ members, hostUid, currentUserId }: MembersListProps) {
  const memberEntries = Object.entries(members);

  return (
    <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-xl shadow-xl">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/60">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white tracking-wide">Connected Devices</h3>
            <p className="text-[11px] text-slate-400">{memberEntries.length} device(s) on soundstage</p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Live Mesh
        </span>
      </div>

      <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
        {memberEntries.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-xs">
            Connecting to soundstage presence...
          </div>
        ) : (
          memberEntries.map(([uid, m]) => {
            const isHost = uid === hostUid;
            const isMe = uid === currentUserId;
            const isMobile = /iPhone|Android|iPad/.test(m.device);

            return (
              <div
                key={uid}
                className={`p-3 rounded-xl border flex items-center justify-between transition ${
                  isMe
                    ? "bg-cyan-500/5 border-cyan-500/20 text-slate-200"
                    : "bg-slate-800/30 border-slate-800/60 text-slate-300"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                    {isMobile ? <Smartphone className="w-4 h-4 text-cyan-400" /> : <Laptop className="w-4 h-4 text-sky-400" />}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-white truncate">
                        {m.displayName || m.device}
                      </span>
                      {isHost && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                          <Crown className="w-2.5 h-2.5" />
                          Host
                        </span>
                      )}
                      {isMe && (
                        <span className="text-[10px] font-semibold text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">
                          You
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">{m.device}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-right shrink-0">
                  {/* Readiness Pill */}
                  {m.isReady ? (
                    <span
                      title="AudioContext active & unlocked"
                      className="inline-flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20"
                    >
                      <Check className="w-3 h-3" />
                      Ready
                    </span>
                  ) : (
                    <span
                      title="Waiting for user tap to activate audio"
                      className="inline-flex items-center gap-1 text-[11px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20"
                    >
                      <AlertCircle className="w-3 h-3" />
                      Pending Tap
                    </span>
                  )}

                  {/* Drift / Latency metric */}
                  <div className="text-right">
                    <div className="text-xs font-mono font-bold text-slate-200">
                      {typeof m.driftMs === "number" && m.driftMs !== 0 ? (
                        <span className={Math.abs(m.driftMs) <= 30 ? "text-emerald-400" : "text-amber-400"}>
                          {m.driftMs > 0 ? `+${m.driftMs}ms` : `${m.driftMs}ms`}
                        </span>
                      ) : (
                        <span className="text-slate-400">±0ms</span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {m.latencyMs ? `${m.latencyMs}ms RTT` : "syncing"}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
