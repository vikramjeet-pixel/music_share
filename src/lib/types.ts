/** Shared RTDB schema types for SyncBeat. Mirrors database.rules.json. */

export type PlaybackStatus = "playing" | "paused" | "buffering";

export interface PlaybackState {
  status: PlaybackStatus;
  trackUrl: string;
  trackTitle: string;
  /** Track position (seconds) at the moment `executeAtServerTime` is reached. */
  positionSec: number;
  /** Server-clock epoch ms at which every node must be at `positionSec`. */
  executeAtServerTime: number;
  /** Server timestamp of the last write (ServerValue.TIMESTAMP). */
  lastUpdated: number;
  /** Monotonic counter so clients can ignore stale/duplicate commands. */
  seq?: number;
}

export interface RoomMetadata {
  hostUid: string;
  hostName?: string;
  createdAt: number;
  isActive: boolean;
}

export interface RoomMember {
  device: string;
  displayName?: string;
  latencyMs: number;
  /** Most recent measured drift vs. the master timeline (ms, signed). */
  driftMs?: number;
  isReady: boolean;
  isHost?: boolean;
  lastSeen: number;
}

export interface Room {
  metadata: RoomMetadata;
  playback: PlaybackState;
  members?: Record<string, RoomMember>;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  url: string;
  bpm?: number;
  durationSec?: number;
  /** Tailwind gradient classes used for artwork. */
  hue: string;
}
