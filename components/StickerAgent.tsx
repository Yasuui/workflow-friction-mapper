export type StickerMood = "idle" | "thinking" | "streaming" | "done";

const EMOJI: Record<StickerMood, string> = {
  idle: "🧭",
  thinking: "🤔",
  streaming: "✍️",
  done: "✅",
};

const LABELS: Record<StickerMood, string> = {
  idle: "Workflow agent",
  thinking: "Thinking",
  streaming: "Writing",
  done: "Done",
};

export function StickerAgent({
  mood,
  size = "md",
  className = "",
}: {
  mood: StickerMood;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span className={`sticker sticker-${size} is-${mood} ${className}`.trim()} role="img" aria-label={LABELS[mood]}>
      {EMOJI[mood]}
    </span>
  );
}
