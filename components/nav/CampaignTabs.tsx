import Link from "next/link";
import type { Campaign } from "@/lib/types";

/**
 * One-click switching between campaigns, shown on the campaign-scoped pages.
 *
 * A dropdown hides the roster; an agency running several campaigns wants to
 * hop between them without hunting. Server-rendered plain links so the choice
 * stays in the URL and a shared link shows the same campaign. Hidden for a
 * single campaign (nothing to switch) and past six (the nav select scales
 * better than a wall of tabs).
 */
export function CampaignTabs({
  campaigns,
  selected,
  basePath,
}: {
  campaigns: Campaign[];
  selected: string;
  basePath: string;
}) {
  if (campaigns.length < 2 || campaigns.length > 6) return null;

  return (
    <div className="scroll-x -my-1 flex flex-nowrap gap-1.5 py-1" role="tablist" aria-label="Campaign">
      {campaigns.map((b) => {
        const active = b.slug === selected;
        return (
          <Link
            key={b.slug}
            href={`${basePath}?b=${encodeURIComponent(b.slug)}`}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "pill pill-accent whitespace-nowrap no-underline"
                : "pill whitespace-nowrap no-underline transition-colors hover:border-ink-soft"
            }
          >
            {b.name}
          </Link>
        );
      })}
    </div>
  );
}
