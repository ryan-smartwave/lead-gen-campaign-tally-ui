import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";

export default function RunNotFound() {
  return (
    <EmptyState
      glyph="◇"
      headline="No scrape with that id"
      hint="It may have been from a different machine, or the local data files have since been cleared."
    >
      <Link href="/runs">Back to history</Link>
    </EmptyState>
  );
}
