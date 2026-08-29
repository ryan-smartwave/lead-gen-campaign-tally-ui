import { getCampaigns } from "@/lib/data";
import { canRunScrapes } from "@/lib/capability";
import { isDbConfigured } from "@/lib/db";
import * as scraper from "@/lib/scraperClient";
import { CampaignEditor } from "@/components/settings/CampaignEditor";
import { NewCampaign } from "@/components/settings/NewCampaign";
import { SafetySpec } from "@/components/settings/SafetySpec";
import { EmptyState } from "@/components/ui/EmptyState";

export const revalidate = 0;
export const metadata = { title: "Settings · Campaign Tally" };

/** The limits actually in force, from the service; null when unreachable. */
async function getSafetySpec() {
  try {
    const pf = await scraper.preflight();
    return pf.safety ?? null;
  } catch {
    return null;
  }
}

export default async function SettingsPage() {
  // Editable exactly when the scraper service is reachable: it owns the config
  // files, so without it there is nothing to write to.
  const [campaigns, editable, safety] = await Promise.all([
    getCampaigns(),
    canRunScrapes(),
    getSafetySpec(),
  ]);

  return (
    <>
      <section>
        <p className="label">Configuration</p>
        <h1 className="text-[26px] font-bold">Settings</h1>
        <p className="muted text-[13px]">Campaigns and the hashtags tracked for each.</p>
      </section>

      {campaigns.length === 0 ? (
        <>
          {editable ? <NewCampaign /> : null}
          <EmptyState
            glyph="◇"
            headline="No campaigns yet"
            hint={
              editable
                ? "Add one above, then give it the hashtags you want tracked."
                : "Campaigns are set up on the machine that runs the scraper."
            }
          />
        </>
      ) : (
        <>
          {campaigns.map((campaign) => (
            <CampaignEditor key={campaign.slug} campaign={campaign} editable={editable} />
          ))}
          {/* Below the roster: adding a campaign is rare, editing is routine. */}
          {editable ? <NewCampaign /> : null}
        </>
      )}

      <SafetySpec safety={safety} />

      <section className="card">
        <span className="card-title">Where data lives</span>
        <p className="muted text-[13px]">
          Each campaign writes to its own folder under{" "}
          <span className="mono">scraper/data/&lt;id&gt;/</span> — separate duplicate-tracking and
          a separate lock, so two campaigns can never corrupt each other&rsquo;s counts.
          {isDbConfigured()
            ? " Results are also mirrored to your database for viewing on other devices."
            : " No database is configured, so results are readable on this machine only."}
        </p>
      </section>
    </>
  );
}
