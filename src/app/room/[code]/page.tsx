import RoomClient from "./RoomClient";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const upper = (code || "").toUpperCase();
  return {
    title: `Room ${upper} · SyncBeat Audio Soundstage`,
    description: `Synchronized high-precision audio streaming in room ${upper}. Sub-30ms drift.`,
  };
}

export default function RoomPage() {
  return <RoomClient />;
}
