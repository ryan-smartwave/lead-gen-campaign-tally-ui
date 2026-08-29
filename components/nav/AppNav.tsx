import { Suspense } from "react";
import { ThemeToggle } from "./ThemeToggle";
import { NavInner, BrandMark } from "./NavInner";
import { canRunScrapes } from "@/lib/capability";
import { getCampaigns } from "@/lib/data";

export async function AppNav() {
  const [campaigns, local] = await Promise.all([getCampaigns(), canRunScrapes()]);

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-[color-mix(in_srgb,var(--color-surface)_88%,transparent)] backdrop-blur-md">
      <nav className="mx-auto flex max-w-[1120px] items-center gap-4 px-4 py-2.5">
        <Suspense fallback={<BrandMark />}>
          <NavInner campaigns={campaigns} />
        </Suspense>
        <div className="flex items-center gap-2">
          {!local ? (
            <span
              className="pill muted"
              title="Viewing only — scrapes run on the laptop where Chrome is signed in"
            >
              Read-only
            </span>
          ) : null}
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
