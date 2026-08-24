"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Business } from "@/lib/types";

/**
 * Switches which business the screens are showing.
 *
 * The choice lives in the URL rather than a cookie so a link to a dashboard or
 * a run always shows what the sender was looking at.
 */
export function BusinessSwitcher({
  businesses,
  current,
}: {
  businesses: Business[];
  current: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  if (businesses.length === 0) return null;

  function pick(slug: string) {
    const next = new URLSearchParams(params.toString());
    next.set("b", slug);
    // Run detail ids belong to one business, so switching returns to the top.
    const target = pathname.startsWith("/runs/") ? "/runs" : pathname;
    router.push(`${target}?${next.toString()}`);
  }

  if (businesses.length === 1) {
    return (
      <span className="pill" title="The only business configured">
        {businesses[0].name}
      </span>
    );
  }

  return (
    <label className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
      <span className="sr-only">Business</span>
      <select
        value={current}
        onChange={(e) => pick(e.target.value)}
        className="btn btn-sm"
        style={{ paddingRight: 8, maxWidth: 200 }}
      >
        {businesses.map((b) => (
          <option key={b.slug} value={b.slug}>
            {b.name}
          </option>
        ))}
      </select>
    </label>
  );
}
