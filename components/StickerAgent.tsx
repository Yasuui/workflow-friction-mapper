"use client";

import { MapperFace, type MapperMood } from "@/components/MapperFace";

export type StickerMood = MapperMood;

export function StickerAgent({
  mood,
  size = "md",
  className = "",
}: {
  mood: StickerMood;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return <MapperFace mood={mood} size={size} className={className} />;
}
