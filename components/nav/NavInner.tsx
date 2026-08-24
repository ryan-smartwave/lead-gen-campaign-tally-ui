"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Business } from "@/lib/types";
import styles from "./AppNav.module.css";

/**
 * Nav links plus the business switcher.
 *
 * Client-side because the selected business lives in the URL query and a layout
 * never receives searchParams. Keeping the choice in the URL (rather than a
 * cookie) means a shared link shows the sender what they were looking at.
 */
export function NavInner({ businesses }: { businesses: Business[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const requested = params.get("b");
  const selected = businesses.find((b) => b.slug === requested) ?? businesses[0];
  const query = selected ? `?b=${encodeURIComponent(selected.slug)}` : "";

  function pick(slug: string) {
    // A run id belongs to one business, so switching goes back to the list.
    const target = pathname.startsWith("/runs/") ? "/runs" : pathname;
    router.push(`${target}?b=${encodeURIComponent(slug)}`);
  }

  return (
    <>
      <Link href={`/${query}`} className={styles.brand}>
        Campaign&nbsp;Tally
      </Link>
      <div className={styles.links}>
        <Link href={`/${query}`}>Dashboard</Link>
        <Link href={`/runs${query}`}>History</Link>
        <Link href="/settings">Settings</Link>
      </div>
      <div className={styles.right}>
        {businesses.length > 1 ? (
          <label>
            <span className="sr-only">Business</span>
            <select
              value={selected?.slug ?? ""}
              onChange={(e) => pick(e.target.value)}
              className="btn btn-sm"
              style={{ maxWidth: 190 }}
            >
              {businesses.map((b) => (
                <option key={b.slug} value={b.slug}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        ) : selected ? (
          <span className="pill" title="The only business configured">
            {selected.name}
          </span>
        ) : null}
      </div>
    </>
  );
}
