/**
 * CSV downloads. Plain links, so the browser handles saving and they work with
 * a long-press on a phone; the route sets Content-Disposition.
 */
export function ExportButtons({ campaign, hasPosts }: { campaign: string; hasPosts: boolean }) {
  const href = (kind: string) =>
    `/api/export?kind=${kind}&campaign=${encodeURIComponent(campaign)}`;

  return (
    <section className="card">
      <span className="card-title">Download</span>
      <div className="row gap-2">
        <a className="btn btn-sm no-underline" href={href("tallies")} download>
          ↓ Daily tallies
        </a>
        <a className="btn btn-sm no-underline" href={href("runs")} download>
          ↓ Scrape summary
        </a>
        {hasPosts ? (
          <a className="btn btn-sm no-underline" href={href("posts")} download>
            ↓ Posts with captions
          </a>
        ) : null}
      </div>
      <p className="muted text-xs">
        CSV, properly quoted for captions that contain commas or line breaks, and UTF-8 so emoji
        survive Excel.
      </p>
    </section>
  );
}
