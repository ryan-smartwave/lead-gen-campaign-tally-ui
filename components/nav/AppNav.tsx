import { Suspense } from "react";
import { ThemeToggle } from "./ThemeToggle";
import { NavInner } from "./NavInner";
import { isScraperHost } from "@/lib/capability";
import { getBusinesses } from "@/lib/data";
import styles from "./AppNav.module.css";

export async function AppNav() {
  const businesses = await getBusinesses();

  return (
    <header className={styles.bar}>
      <nav className={styles.inner}>
        <Suspense fallback={<span className={styles.brand}>Campaign&nbsp;Tally</span>}>
          <NavInner businesses={businesses} />
        </Suspense>
        <div className={styles.trailing}>
          {!isScraperHost() ? (
            <span
              className={`pill ${styles.readonly}`}
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
