import { getBusinesses } from "@/lib/data";
import { canRunScrapes } from "@/lib/capability";
import { isDbConfigured } from "@/lib/db";
import { BusinessEditor } from "@/components/settings/BusinessEditor";
import { NewBusiness } from "@/components/settings/NewBusiness";
import { EmptyState } from "@/components/ui/EmptyState";

export const revalidate = 0;
export const metadata = { title: "Settings · Campaign Tally" };

export default async function SettingsPage() {
  // Editable exactly when the scraper service is reachable: it owns the config
  // files, so without it there is nothing to write to.
  const [businesses, editable] = await Promise.all([getBusinesses(), canRunScrapes()]);

  return (
    <>
      <section>
        <p className="label">Configuration</p>
        <h1 className="text-[26px] font-bold">Settings</h1>
        <p className="muted text-[13px]">Businesses and the hashtags tracked for each.</p>
      </section>

      {editable ? <NewBusiness /> : null}

      {businesses.length === 0 ? (
        <EmptyState
          glyph="◇"
          headline="No businesses yet"
          hint={
            editable
              ? "Add one above, then give it the hashtags you want tracked."
              : "Businesses are set up on the machine that runs the scraper."
          }
        />
      ) : (
        businesses.map((business) => (
          <BusinessEditor key={business.slug} business={business} editable={editable} />
        ))
      )}

      <div className="grid-2">
        <section className="card">
          <span className="card-title">Scrape safety limits</span>
          <p className="muted text-[13px]">
            Timing and volume limits are shared by every business and are edited only in{" "}
            <span className="mono">scraper/config.json</span>, never from this app. They are what
            keeps the accounts from being flagged, so there is deliberately no button here that can
            widen them.
          </p>
        </section>

        <section className="card">
          <span className="card-title">Where data lives</span>
          <p className="muted text-[13px]">
            Each business writes to its own folder under{" "}
            <span className="mono">scraper/data/&lt;id&gt;/</span> — separate duplicate-tracking and
            a separate lock, so two businesses can never corrupt each other&rsquo;s counts.
            {isDbConfigured()
              ? " Results are also mirrored to your database for viewing on other devices."
              : " No database is configured, so results are readable on this machine only."}
          </p>
        </section>
      </div>
    </>
  );
}
