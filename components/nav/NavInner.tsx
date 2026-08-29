"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Campaign } from "@/lib/types";

/** The gradient logo tile plus wordmark; also the nav's Suspense fallback. */
export function BrandMark() {
  return (
    <span className="flex items-center gap-2 text-ink no-underline">
      <span
        aria-hidden="true"
        className="grid h-7 w-7 place-items-center rounded-lg bg-[linear-gradient(135deg,var(--color-accent),#0c8ea4)] font-(family-name:--font-display) text-[13px] font-bold text-white"
      >
        #
      </span>
      <span className="font-(family-name:--font-display) font-bold tracking-tight max-[560px]:hidden">
        Campaign&nbsp;Tally
      </span>
    </span>
  );
}

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/runs", label: "History" },
  { href: "/settings", label: "Settings" },
];

/**
 * Nav links plus the campaign switcher.
 *
 * Client-side because the selected campaign lives in the URL query and a layout
 * never receives searchParams. Keeping the choice in the URL (rather than a
 * cookie) means a shared link shows the sender what they were looking at.
 */
export function NavInner({ campaigns }: { campaigns: Campaign[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const requested = params.get("b");
  const selected = campaigns.find((b) => b.slug === requested) ?? campaigns[0];
  const query = selected ? `?b=${encodeURIComponent(selected.slug)}` : "";

  function pick(slug: string) {
    // A run id belongs to one campaign, so switching goes back to the list.
    const target = pathname.startsWith("/runs/") ? "/runs" : pathname;
    router.push(`${target}?b=${encodeURIComponent(slug)}`);
  }

  return (
    <>
      <Link href={`/${query}`} className="no-underline">
        <BrandMark />
      </Link>
      <div className="flex items-center gap-1 text-sm font-semibold">
        {LINKS.map((link) => {
          const active =
            link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={`${link.href}${link.href === "/settings" ? "" : query}`}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "rounded-full bg-accent-soft px-3 py-1 text-accent no-underline"
                  : "rounded-full px-3 py-1 text-ink-soft no-underline transition-colors hover:bg-surface-2 hover:text-ink"
              }
            >
              {link.label}
            </Link>
          );
        })}
      </div>
      <div className="ml-auto flex items-center gap-2">
        {campaigns.length > 1 ? (
          <label>
            <span className="sr-only">Campaign</span>
            <select
              value={selected?.slug ?? ""}
              onChange={(e) => pick(e.target.value)}
              className="select max-w-[230px]"
            >
              {campaigns.map((b) => (
                <option key={b.slug} value={b.slug}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        ) : selected ? (
          <span className="pill" title="The only campaign configured">
            {selected.name}
          </span>
        ) : null}
      </div>
    </>
  );
}
