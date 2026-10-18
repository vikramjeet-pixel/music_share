"use client";

import { useEffect, useRef, useState, useCallback, useMemo, useId } from "react";
import {
  ref,
  onValue,
  set,
  update,
  onDisconnect,
  serverTimestamp,
  get,
} from "firebase/database";
import { getDb, isFirebaseConfigured } from "@/lib/firebase";
import { ClockSync, type ClockSnapshot } from "@/lib/clock-sync";
import { SyncAudioEngine, type DriftReport } from "@/lib/audio-engine";
import { describeDevice } from "@/lib/room-code";
import { DEMO_TRACKS } from "@/lib/tracks";
import type { PlaybackState, RoomMetadata, RoomMember } from "@/lib/types";

interface UseRoomOptions {
  roomId: string;
  userId?: string;
  userName?: string;
}

export interface UseRoomReturn {
  // Room state
  roomId: string;
  metadata: RoomMetadata | null;
  playback: PlaybackState;
  members: Record<string, RoomMember>;
  isHost: boolean;
  isReady: boolean;
  isLoading: boolean;
  error: string | null;
  isFirebaseActive: boolean;

  // Audio Engine & Sync diagnostics
  audioEngine: SyncAudioEngine | null;
  soundstageUnlocked: boolean;
  unlockSoundstage: () => Promise<boolean>;
  clockSnapshot: ClockSnapshot;
  latestDrift: DriftReport;
  currentPositionSec: number;
  durationSec: number;
  volume: number;
  isMuted: boolean;
  setVolume: (val: number) => void;
  toggleMute: () => void;

  // Host playback actions
  play: (trackUrl?: string, trackTitle?: string, startPosition?: number) => Promise<void>;
  pause: () => Promise<void>;
  seek: (targetSec: number) => Promise<void>;
  selectTrack: (trackUrl: string, trackTitle: string) => Promise<void>;
  kickMember?: (memberUid: string) => Promise<void>;
}

const DEFAULT_PLAYBACK: PlaybackState = {
  status: "paused",
  trackUrl: DEMO_TRACKS[0].url,
  trackTitle: DEMO_TRACKS[0].title,
  positionSec: 0,
  executeAtServerTime: 0,
  lastUpdated: Date.now(),
};

const DEFAULT_CLOCK: ClockSnapshot = {
  offsetMs: 0,
  rttMs: 0,
  latencyMs: 0,
  uncertaintyMs: 0,
  source: "none",
  calibratedAt: 0,
  samples: [],
};

const BUFFER_WINDOW_MS = 1200; // 1200ms scheduled execution window
const DRIFT_INTERVAL_MS = 2000; // Continuous drift evaluation tick

export function useRoom({ roomId, userId, userName }: UseRoomOptions): UseRoomReturn {
  const [metadata, setMetadata] = useState<RoomMetadata | null>(null);
  const [playback, setPlayback] = useState<PlaybackState>(DEFAULT_PLAYBACK);
  const [members, setMembers] = useState<Record<string, RoomMember>>({});
  const [soundstageUnlocked, setSoundstageUnlocked] = useState(false);
  const [clockSnapshot, setClockSnapshot] = useState<ClockSnapshot>(DEFAULT_CLOCK);
  const [latestDrift, setLatestDrift] = useState<DriftReport>({
    driftMs: 0,
    rate: 1,
    action: "idle",
  });
  const [currentPositionSec, setCurrentPositionSec] = useState(0);
  const [durationSec, setDurationSec] = useState(DEMO_TRACKS[0].durationSec || 60);
  const [volume, setVolumeState] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const engineRef = useRef<SyncAudioEngine | null>(null);
  const clockSyncRef = useRef<ClockSync | null>(null);
  const broadcastRef = useRef<BroadcastChannel | null>(null);
  const [sessionUid, setSessionUid] = useState<string>("");

  useEffect(() => {
    if (userId) {
      setSessionUid(userId);
      return;
    }
    try {
      const key = `syncbeat_tab_${roomId}`;
      let id = sessionStorage.getItem(key);
      if (!id) {
        id = `guest_${Math.random().toString(36).substring(2, 8)}`;
        sessionStorage.setItem(key, id);
      }
      setSessionUid(id);
    } catch {
      setSessionUid(`guest_${Math.random().toString(36).substring(2, 8)}`);
    }
  }, [userId, roomId]);

  const effectiveUid = userId || sessionUid;

  // Initialize Audio Engine once
  if (!engineRef.current && typeof window !== "undefined") {
    engineRef.current = new SyncAudioEngine();
    engineRef.current.setVolume(volume);
    engineRef.current.load(DEFAULT_PLAYBACK.trackUrl).then(({ duration }) => {
      if (duration > 0) setDurationSec(duration);
    }).catch(() => {});
  }

  // 1. Setup ClockSync & Firebase RTDB or Local Simulation
  useEffect(() => {
    if (!effectiveUid) return;
    let active = true;
    const engine = engineRef.current;
    if (!engine) return;

    if (isFirebaseConfigured) {
      try {
        const db = getDb();
        const clockSync = new ClockSync(db, effectiveUid);
        clockSyncRef.current = clockSync;

        const unsubClock = clockSync.subscribe((snap) => {
          if (active) setClockSnapshot(snap);
        });
        clockSync.start();

        // Bind RTDB room references
        const roomRef = ref(db, `rooms/${roomId}`);
        const metaRef = ref(db, `rooms/${roomId}/metadata`);
        const playRef = ref(db, `rooms/${roomId}/playback`);
        const membersRef = ref(db, `rooms/${roomId}/members`);
        const myMemberRef = ref(db, `rooms/${roomId}/members/${effectiveUid}`);

        // Register member presence with onDisconnect()
        const registerPresence = async () => {
          const deviceLabel = describeDevice();
          const memberPayload: RoomMember = {
            device: deviceLabel,
            displayName: userName || deviceLabel.split(" · ")[0],
            latencyMs: clockSync.state.latencyMs || 25,
            driftMs: 0,
            isReady: engine.unlocked,
            lastSeen: Date.now(),
          };

          // On disconnect hook
          try {
            await onDisconnect(myMemberRef).remove();
            await set(myMemberRef, {
              ...memberPayload,
              lastSeen: serverTimestamp(),
            });
          } catch (e) {
            console.warn("[SyncBeat] Presence registration:", e);
          }
        };

        // Initialize room if it doesn't exist
        get(metaRef).then(async (snap) => {
          if (!active) return;
          if (!snap.exists()) {
            // First member creates room as host
            const newMeta: RoomMetadata = {
              hostUid: effectiveUid,
              hostName: userName || "Host",
              createdAt: Date.now(),
              isActive: true,
            };
            await set(metaRef, newMeta);
            await set(playRef, DEFAULT_PLAYBACK);
            setMetadata(newMeta);
          } else {
            setMetadata(snap.val() as RoomMetadata);
          }
          await registerPresence();
          setIsLoading(false);
        }).catch((err) => {
          if (active) {
            setError(err.message);
            setIsLoading(false);
          }
        });

        // Listen for metadata updates
        const unsubMeta = onValue(metaRef, (s) => {
          if (active && s.exists()) setMetadata(s.val() as RoomMetadata);
        });

        // Listen for members
        const unsubMembers = onValue(membersRef, (s) => {
          if (active && s.exists()) setMembers(s.val() as Record<string, RoomMember>);
        });

        // Listen for playback updates
        const unsubPlay = onValue(playRef, async (s) => {
          if (!active || !s.exists()) return;
          const nextState = s.val() as PlaybackState;
          setPlayback(nextState);

          // Handle track change & scheduled audio
          await handlePlaybackChange(nextState, clockSync, engine);
        });

        return () => {
          active = false;
          unsubClock();
          unsubMeta();
          unsubMembers();
          unsubPlay();
          clockSync.stop();
          set(myMemberRef, null).catch(() => {});
        };
      } catch (err) {
        console.error("[SyncBeat] Firebase RTDB connection failed:", err);
      }
    }

    // 2. Fallback / Local simulation mode (BroadcastChannel)
    const channelName = `syncbeat_room_${roomId}`;
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel(channelName);
      broadcastRef.current = bc;
    } catch {
      /* BroadcastChannel not supported in legacy environment */
    }

    // Clock sync simulated snapshot
    const simClockSnapshot: ClockSnapshot = {
      offsetMs: 0,
      rttMs: 16,
      latencyMs: 8,
      uncertaintyMs: 2,
      source: "rtdb-info",
      calibratedAt: Date.now(),
      samples: [],
    };
    setClockSnapshot(simClockSnapshot);

    const storageKey = `syncbeat_room_${roomId}`;
    const deviceLabel = describeDevice();
    const myMemberData: RoomMember = {
      device: deviceLabel,
      displayName: userName || (effectiveUid ? `Device ${effectiveUid.slice(-4)}` : "Guest"),
      latencyMs: 10,
      driftMs: 0,
      isReady: engine.unlocked,
      lastSeen: Date.now(),
    };

    let localMetadata: RoomMetadata = {
      hostUid: effectiveUid,
      hostName: userName || "Host",
      createdAt: Date.now(),
      isActive: true,
    };
    let localPlayback: PlaybackState = DEFAULT_PLAYBACK;
    let localMembers: Record<string, RoomMember> = {
      [effectiveUid]: myMemberData,
    };

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.metadata?.hostUid) {
          localMetadata = parsed.metadata;
        }
        if (parsed.playback) {
          localPlayback = parsed.playback;
        }
        localMembers = {
          ...(parsed.members || {}),
          [effectiveUid]: myMemberData,
        };
      }
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          metadata: localMetadata,
          playback: localPlayback,
          members: localMembers,
        })
      );
    } catch {
      /* ignore storage fail */
    }

    setMetadata(localMetadata);
    setPlayback(localPlayback);
    setMembers(localMembers);
    setIsLoading(false);

    // Preload audio buffer immediately
    if (localPlayback.trackUrl) {
      engine.load(localPlayback.trackUrl).then(({ duration }) => {
        if (active && duration > 0) setDurationSec(duration);
      }).catch(() => {});
    }

    if (bc) {
      bc.onmessage = async (e) => {
        if (!active || !e.data) return;
        const msg = e.data;

        if (msg.type === "PLAYBACK_UPDATE") {
          setPlayback(msg.playback);
          const mockSync = {
            serverNow: () => Date.now(),
            toLocalTime: (s: number) => s,
          } as ClockSync;
          await handlePlaybackChange(msg.playback, mockSync, engine);
        } else if (msg.type === "MEMBER_JOIN") {
          // A new peer tab has joined!
          setMembers((prev) => {
            const next = { ...prev, [msg.uid]: msg.member };
            try {
              const cur = JSON.parse(localStorage.getItem(storageKey) || "{}");
              cur.members = next;
              localStorage.setItem(storageKey, JSON.stringify(cur));
            } catch {}
            return next;
          });
          // Reply with our presence and current room state
          bc?.postMessage({
            type: "MEMBER_ANNOUNCE",
            uid: effectiveUid,
            member: myMemberData,
            metadata: localMetadata,
            playback: localPlayback,
          });
        } else if (msg.type === "MEMBER_ANNOUNCE") {
          // Existing peer announced itself
          setMembers((prev) => ({ ...prev, [msg.uid]: msg.member }));
          if (msg.metadata) setMetadata(msg.metadata);
          if (msg.playback) {
            setPlayback(msg.playback);
            if (msg.playback.status === "playing") {
              const mockSync = {
                serverNow: () => Date.now(),
                toLocalTime: (s: number) => s,
              } as ClockSync;
              await handlePlaybackChange(msg.playback, mockSync, engine);
            }
          }
        } else if (msg.type === "MEMBER_LEAVE") {
          setMembers((prev) => {
            const next = { ...prev };
            delete next[msg.uid];
            try {
              const cur = JSON.parse(localStorage.getItem(storageKey) || "{}");
              cur.members = next;
              localStorage.setItem(storageKey, JSON.stringify(cur));
            } catch {}
            return next;
          });
        } else if (msg.type === "MEMBER_READY") {
          setMembers((prev) => {
            if (!prev[msg.uid]) return prev;
            return {
              ...prev,
              [msg.uid]: {
                ...prev[msg.uid],
                isReady: msg.isReady,
              },
            };
          });
        }
      };

      // Announce join to all tabs
      bc.postMessage({
        type: "MEMBER_JOIN",
        uid: effectiveUid,
        member: myMemberData,
      });
    }

    return () => {
      active = false;
      bc?.postMessage({
        type: "MEMBER_LEAVE",
        uid: effectiveUid,
      });
      bc?.close();
    };
  }, [roomId, effectiveUid, userName]);

  // Handle scheduled playback reception
  const handlePlaybackChange = async (
    state: PlaybackState,
    clock: ClockSync | { serverNow: () => number; toLocalTime: (s: number) => number },
    engine: SyncAudioEngine
  ) => {
    try {
      // 1. Ensure track is loaded
      if (engine.url !== state.trackUrl) {
        const { duration } = await engine.load(state.trackUrl);
        setDurationSec(duration);
      }

      // 2. Play or Pause
      if (state.status === "playing") {
        // High-precision sync calculation:
        // delayMs = (executeAtServerTime - clientClockOffset) - Date.now()
        // clock.toLocalTime(serverTime) converts server epoch ms to local Date.now()
        const localTargetMs = clock.toLocalTime(state.executeAtServerTime);

        engine.play({
          positionSec: state.positionSec,
          executeAtLocalMs: localTargetMs,
        });
      } else {
        engine.stop();
      }
    } catch (err) {
      console.error("[SyncBeat] Playback state handling error:", err);
    }
  };

  // 2. Continuous Drift Monitoring & Position Tick (every 2000ms drift check, 100ms UI ticker)
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    // Fast UI position ticker
    const posTimer = setInterval(() => {
      const pos = engine.currentPosition();
      if (pos !== null) {
        setCurrentPositionSec(Math.max(0, pos));
      } else if (playback.status === "paused") {
        setCurrentPositionSec(playback.positionSec);
      }
    }, 100);

    // High precision drift monitor tick every 2000ms
    const driftTimer = setInterval(() => {
      if (playback.status !== "playing") {
        setLatestDrift({ driftMs: 0, rate: 1, action: "idle" });
        return;
      }

      const report = engine.correctDrift();
      setLatestDrift(report);

      // Report drift back to room presence if Firebase is active
      if (isFirebaseConfigured && effectiveUid) {
        try {
          const db = getDb();
          const driftRef = ref(db, `rooms/${roomId}/members/${effectiveUid}/driftMs`);
          set(driftRef, Math.round(report.driftMs)).catch(() => {});
        } catch {
          /* ignore */
        }
      }
    }, DRIFT_INTERVAL_MS);

    return () => {
      clearInterval(posTimer);
      clearInterval(driftTimer);
    };
  }, [playback.status, roomId, effectiveUid]);

  // 3. User interaction to unlock Web Audio context (Mobile / Autoplay requirement)
  const unlockSoundstage = useCallback(async (): Promise<boolean> => {
    const engine = engineRef.current;
    let ok = true;
    if (engine) {
      try {
        ok = await engine.unlock();
      } catch (e) {
        console.warn("[SyncBeat] Engine unlock error:", e);
      }
    }
    setSoundstageUnlocked(true);

    // Update readiness in member status
    if (isFirebaseConfigured && effectiveUid) {
      try {
        const db = getDb();
        const readyRef = ref(db, `rooms/${roomId}/members/${effectiveUid}/isReady`);
        await set(readyRef, ok);
      } catch (e) {
        console.warn("Failed to report ready status", e);
      }
    } else if (effectiveUid) {
      broadcastRef.current?.postMessage({
        type: "MEMBER_READY",
        uid: effectiveUid,
        isReady: ok,
      });
      setMembers((prev) => {
        if (!prev[effectiveUid]) return prev;
        return {
          ...prev,
          [effectiveUid]: { ...prev[effectiveUid], isReady: ok },
        };
      });
    }

    // If a track was already playing when we unlocked, jump into sync!
    if (playback.status === "playing" && engine) {
      try {
        if (engine.url !== playback.trackUrl) {
          await engine.load(playback.trackUrl);
        }
        const localTargetMs = clockSyncRef.current
          ? clockSyncRef.current.toLocalTime(playback.executeAtServerTime)
          : playback.executeAtServerTime;
        engine.play({
          positionSec: playback.positionSec,
          executeAtLocalMs: localTargetMs || Date.now(),
        });
      } catch (err) {
        console.warn("[SyncBeat] Play on unlock error:", err);
      }
    }

    return true;
  }, [playback, roomId, effectiveUid]);

  // Volume & Mute Controls
  const setVolume = useCallback((val: number) => {
    setVolumeState(val);
    engineRef.current?.setVolume(val);
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      engineRef.current?.setMuted(next);
      return next;
    });
  }, []);

  // 4. Host Playback Actions - creator, matching hostUid, or solo member has host control
  const isHost =
    !metadata?.hostUid ||
    metadata.hostUid === effectiveUid ||
    Object.keys(members).length <= 1;

  const play = useCallback(
    async (trackUrl?: string, trackTitle?: string, startPosition?: number) => {
      const engine = engineRef.current;
      const clock = clockSyncRef.current;
      const nowServer = clock ? clock.serverNow() : Date.now();
      const executeAtServerTime = nowServer + BUFFER_WINDOW_MS;

      const targetUrl = trackUrl || playback.trackUrl || DEMO_TRACKS[0].url;
      const targetTitle = trackTitle || playback.trackTitle || DEMO_TRACKS[0].title;
      const pos = typeof startPosition === "number" ? startPosition : currentPositionSec;

      // Ensure engine has targetUrl loaded immediately
      if (engine && engine.url !== targetUrl) {
        engine.load(targetUrl).then(({ duration }) => {
          if (duration > 0) setDurationSec(duration);
        }).catch(() => {});
      }

      const newPlayback: PlaybackState = {
        status: "playing",
        trackUrl: targetUrl,
        trackTitle: targetTitle,
        positionSec: pos,
        executeAtServerTime,
        lastUpdated: Date.now(),
      };

      if (isFirebaseConfigured) {
        const db = getDb();
        const playRef = ref(db, `rooms/${roomId}/playback`);
        await update(playRef, {
          ...newPlayback,
          lastUpdated: serverTimestamp(),
        });
      } else {
        setPlayback(newPlayback);
        try {
          const cur = JSON.parse(localStorage.getItem(`syncbeat_room_${roomId}`) || "{}");
          cur.playback = newPlayback;
          localStorage.setItem(`syncbeat_room_${roomId}`, JSON.stringify(cur));
        } catch {}
        broadcastRef.current?.postMessage({
          type: "PLAYBACK_UPDATE",
          playback: newPlayback,
        });
        if (engine) {
          handlePlaybackChange(
            newPlayback,
            { serverNow: () => Date.now(), toLocalTime: (s) => s } as ClockSync,
            engine
          );
        }
      }
    },
    [roomId, playback, currentPositionSec]
  );

  const pause = useCallback(async () => {
    const engine = engineRef.current;
    const currentPos = engine?.currentPosition() ?? currentPositionSec;

    const newPlayback: PlaybackState = {
      ...playback,
      status: "paused",
      positionSec: Math.max(0, currentPos),
      executeAtServerTime: 0,
      lastUpdated: Date.now(),
    };

    if (isFirebaseConfigured) {
      const db = getDb();
      const playRef = ref(db, `rooms/${roomId}/playback`);
      await update(playRef, {
        ...newPlayback,
        lastUpdated: serverTimestamp(),
      });
    } else {
      setPlayback(newPlayback);
      try {
        const cur = JSON.parse(localStorage.getItem(`syncbeat_room_${roomId}`) || "{}");
        cur.playback = newPlayback;
        localStorage.setItem(`syncbeat_room_${roomId}`, JSON.stringify(cur));
      } catch {}
      broadcastRef.current?.postMessage({
        type: "PLAYBACK_UPDATE",
        playback: newPlayback,
      });
      engine?.stop();
    }
  }, [roomId, playback, currentPositionSec]);

  const seek = useCallback(
    async (targetSec: number) => {
      if (playback.status === "playing") {
        await play(playback.trackUrl, playback.trackTitle, targetSec);
      } else {
        const newPlayback: PlaybackState = {
          ...playback,
          positionSec: targetSec,
          executeAtServerTime: 0,
          lastUpdated: Date.now(),
        };

        if (isFirebaseConfigured) {
          const db = getDb();
          const playRef = ref(db, `rooms/${roomId}/playback`);
          await update(playRef, {
            ...newPlayback,
            lastUpdated: serverTimestamp(),
          });
        } else {
          setPlayback(newPlayback);
          try {
            const cur = JSON.parse(localStorage.getItem(`syncbeat_room_${roomId}`) || "{}");
            cur.playback = newPlayback;
            localStorage.setItem(`syncbeat_room_${roomId}`, JSON.stringify(cur));
          } catch {}
          broadcastRef.current?.postMessage({
            type: "PLAYBACK_UPDATE",
            playback: newPlayback,
          });
        }
        setCurrentPositionSec(targetSec);
      }
    },
    [playback, play, roomId]
  );

  const selectTrack = useCallback(
    async (trackUrl: string, trackTitle: string) => {
      if (playback.status === "playing") {
        await play(trackUrl, trackTitle, 0);
      } else {
        const newPlayback: PlaybackState = {
          ...playback,
          trackUrl,
          trackTitle,
          positionSec: 0,
          executeAtServerTime: 0,
          lastUpdated: Date.now(),
        };

        if (isFirebaseConfigured) {
          const db = getDb();
          const playRef = ref(db, `rooms/${roomId}/playback`);
          await update(playRef, {
            ...newPlayback,
            lastUpdated: serverTimestamp(),
          });
        } else {
          setPlayback(newPlayback);
          try {
            const cur = JSON.parse(localStorage.getItem(`syncbeat_room_${roomId}`) || "{}");
            cur.playback = newPlayback;
            localStorage.setItem(`syncbeat_room_${roomId}`, JSON.stringify(cur));
          } catch {}
          broadcastRef.current?.postMessage({
            type: "PLAYBACK_UPDATE",
            playback: newPlayback,
          });
          if (engineRef.current) {
            handlePlaybackChange(
              newPlayback,
              { serverNow: () => Date.now(), toLocalTime: (s) => s } as ClockSync,
              engineRef.current
            );
          }
        }
        setCurrentPositionSec(0);
      }
    },
    [playback, play, roomId]
  );

  return {
    roomId,
    metadata,
    playback,
    members,
    isHost,
    isReady: soundstageUnlocked,
    isLoading,
    error,
    isFirebaseActive: isFirebaseConfigured,

    audioEngine: engineRef.current,
    soundstageUnlocked,
    unlockSoundstage,
    clockSnapshot,
    latestDrift,
    currentPositionSec,
    durationSec,
    volume,
    isMuted,
    setVolume,
    toggleMute,

    play,
    pause,
    seek,
    selectTrack,
  };
}
