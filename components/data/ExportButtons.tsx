/**
 * CSV downloads. Plain links, so the browser handles saving and they work with
 * a long-press on a phone; the route sets Content-Disposition.
 */
export function ExportButtons({ business, hasPosts }: { business: string; hasPosts: boolean }) {
  const href = (kind: string) =>
    `/api/export?kind=${kind}&business=${encodeURIComponent(business)}`;

  return (
    <section className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="card-title">Download</span>
        <span className="row" style={{ gap: "var(--space-2)" }}>
          <a className="btn btn-sm" href={href("tallies")} download>
            Daily tallies
          </a>
          <a className="btn btn-sm" href={href("runs")} download>
            Scrape summary
          </a>
          {hasPosts ? (
            <a className="btn btn-sm" href={href("posts")} download>
              Posts with captions
            </a>
          ) : null}
        </span>
      </div>
      <p className="muted" style={{ fontSize: 12 }}>
        CSV, properly quoted for captions that contain commas or line breaks, and UTF-8 so emoji
        survive Excel.
      </p>
    </section>
  );
}
