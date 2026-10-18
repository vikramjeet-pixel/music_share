# SyncBeat 🎧

A production-grade, responsive Progressive Web App (PWA) that allows one host device to synchronously stream and trigger audio playback across multiple connected devices (mobile, desktop, tablet) via a 6-character room code with sub-30ms drift.

---

## ⚡ Key Highlights & Architecture

### 1. High-Precision Sub-30ms Synchronization Engine
- **NTP-Style Clock Synchronization (`src/lib/clock-sync.ts`)**:
  - Automatically captures Firebase RTDB `.info/serverTimeOffset`.
  - Conducts an initial 5-sample ping-pong round-trip time (RTT) probe by writing `ServerValue.TIMESTAMP` to `/clockProbes/$uid` and reading back the server time.
  - Keeps the 3 lowest-RTT samples to eliminate asymmetric network queuing delay and calculates a reliable `clientClockOffset` with uncertainty bounds.
- **Scheduled Buffer Execution (`src/lib/audio-engine.ts`)**:
  - The host never triggers raw instant playback. When the host plays or seeks, it calculates:
    $$\text{executeAtServerTime} = \text{serverNow()} + 1200\,\text{ms}$$
  - Connected nodes calculate local start delay:
    $$\text{delayMs} = (\text{executeAtServerTime} - \text{clientClockOffset}) - \text{Date.now()}$$
  - Plays synchronously using Web Audio API buffer scheduling:
    $$\text{source.start}(\text{audioCtx.currentTime} + \text{delaySeconds}, \text{positionSec})$$
- **Continuous 3-Tier Drift Control Loop (`useRoom.ts` & `audio-engine.ts`)**:
  - Evaluates drift every 2 seconds by comparing audible speaker position against expected master timeline:
    - **$|\text{drift}| \le 30\,\text{ms}$**: Green Lock status. Perfect alignment.
    - **$30\,\text{ms} < |\text{drift}| \le 150\,\text{ms}$**: Dynamic rate nudge ($0.97\times - 1.03\times$ playback rate) to smoothly eliminate drift without audible pops.
    - **$|\text{drift}| > 150\,\text{ms}$**: Micro-crossfaded direct seek back to the timeline.

### 2. Autoplay & Mobile PWA Compliance
- **Soundstage Unlock Modal (`src/components/SoundstageModal.tsx`)**:
  - Resolves mobile browser restrictions (iOS Safari / Android Chrome) where background audio cannot start programmatically without a user gesture.
  - Direct touch/click activates `audioCtx.resume()`, plays an inaudible buffer, and sets `navigator.audioSession.type = 'playback'` on iOS 16.4+ to prevent silent mode muting.
- **Progressive Web App**:
  - Powered by `@ducanh2912/next-pwa`.
  - Offline fallback route (`/offline`) and cached demo tracks.
  - Web App Manifest (`src/app/manifest.ts`), icons (`public/icons`), and fullscreen standalone iOS meta tags.

### 3. Real-Time Data & Presence Schema (Firebase RTDB)
```json
{
  "rooms": {
    "$roomId": {
      "metadata": {
        "hostUid": "string",
        "hostName": "string",
        "createdAt": 1729250000000,
        "isActive": true
      },
      "playback": {
        "status": "playing",
        "trackUrl": "/audio/calibration-pulse.wav",
        "trackTitle": "Calibration Pulse",
        "positionSec": 14.5,
        "executeAtServerTime": 1729250001200,
        "lastUpdated": 1729250000000
      },
      "members": {
        "$uid": {
          "device": "iPhone 15 · Safari",
          "displayName": "iPhone",
          "latencyMs": 24,
          "driftMs": 1.2,
          "isReady": true,
          "lastSeen": 1729250000000
        }
      }
    }
  }
}
```

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. (Optional) Configure Firebase
Copy the environment template:
```bash
cp .env.example .env.local
```
Fill in your Firebase credentials in `.env.local`:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://your-app-default-rtdb.firebaseio.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-app
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-app.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

> **Note**: Even without Firebase configured, SyncBeat includes an **automatic local synchronization mesh** using `BroadcastChannel` and `localStorage`, so you can immediately test synchronized playback and drift metrics across multiple browser tabs!

### 3. Deploy RTDB Security Rules
In your Firebase Console → Realtime Database → Rules, apply `database.rules.json`.

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Production Build
```bash
npm run build
npm run start
```

---

## 🎵 Bundled Demo Audio Tracks
SyncBeat includes procedurally synthesized same-origin demo audio in `public/audio/`:
1. **Calibration Pulse** (`calibration-pulse.wav`) — 120 BPM transient click track designed specifically for acoustic drift detection.
2. **Neon Drive** (`neon-drive.wav`) — 118 BPM synthwave track with driving bass and drums.
3. **Midnight Lo-Fi** (`midnight-lofi.wav`) — 84 BPM swung chillhop with Rhodes piano.

---

## 🛠 Tech Stack
- **Framework:** Next.js 16 (App Router, TypeScript)
- **Styling:** Tailwind CSS v4 + Lucide React + Radix UI
- **PWA & Offline:** `@ducanh2912/next-pwa` + Service Worker runtime caching
- **Real-Time Data:** Firebase Realtime Database (RTDB)
- **Authentication:** Firebase Auth (Anonymous default + Google OAuth upgrade)
- **Audio Engine:** Web Audio API (`AudioContext`) with HTML5 Audio fallback
