import type { Platform } from "@/lib/types";

const META: Record<Platform, { label: string; color: string; glyph: string }> = {
  instagram: { label: "Instagram", color: "var(--instagram)", glyph: "◉" },
  facebook: { label: "Facebook", color: "var(--facebook)", glyph: "◆" },
};

export function PlatformIcon({ platform }: { platform: Platform }) {
  const m = META[platform];
  return (
    <span title={m.label} style={{ color: m.color, fontWeight: 700 }}>
      <span aria-hidden="true">{m.glyph}</span>
      <span className="sr-only">{m.label}</span>
    </span>
  );
}

export function platformColor(platform: Platform): string {
  return META[platform].color;
}
