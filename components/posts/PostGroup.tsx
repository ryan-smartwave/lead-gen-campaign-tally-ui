import type { Platform, Post } from "@/lib/types";
import { extractMentions, isRedacted } from "@/lib/caption";
import { PlatformIcon } from "@/components/data/PlatformIcon";
import { Caption } from "./Caption";
import { MentionChips } from "./MentionChips";

/**
 * One collapsible section per hashtag. Collapsed by default so a run with 500
 * posts doesn't render 500 cards; opening one is a deliberate act.
 */
export function PostGroup({
  platform,
  hashtag,
  count,
  posts,
}: {
  platform: Platform;
  hashtag: string;
  count: number;
  posts: Post[];
}) {
  return (
    <details className="card">
      <summary style={{ cursor: "pointer", display: "flex", gap: 8, alignItems: "center" }}>
        <PlatformIcon platform={platform} />
        <span style={{ fontWeight: 600 }}>#{hashtag}</span>
        <span className="muted num" style={{ fontSize: 13 }}>
          {count} post{count === 1 ? "" : "s"}
        </span>
      </summary>

      {platform === "facebook" ? (
        <p className="muted" style={{ fontSize: 12, marginTop: "var(--space-3)" }}>
          Facebook posts have no link: Facebook hides post URLs from the automation layer, so each
          one is identified by a fingerprint of its author and text. Copy a post&rsquo;s text into
          Facebook search to find the original.
        </p>
      ) : null}

      <div className="stack" style={{ marginTop: "var(--space-3)" }}>
        {posts.length === 0 ? (
          <p className="muted" style={{ fontSize: 13 }}>
            No stored post records for this hashtag.
          </p>
        ) : (
          posts.map((post) => (
            <article
              key={post.id}
              className="stack"
              style={{
                gap: 6,
                paddingTop: "var(--space-3)",
                borderTop: "1px solid var(--line)",
              }}
            >
              {post.platform === "instagram" ? (
                <>
                  {post.preview ? (
                    <>
                      <Caption text={post.preview} />
                      <MentionChips handles={extractMentions(post.preview)} />
                    </>
                  ) : (
                    <p className="muted" style={{ fontSize: 13 }}>
                      (no caption captured)
                    </p>
                  )}
                  <a
                    href={post.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 12, fontWeight: 600 }}
                  >
                    Open on Instagram ↗
                  </a>
                </>
              ) : (
                <>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>
                    {isRedacted(post.author) ? (
                      <span className="pill muted" style={{ fontStyle: "italic" }}>
                        name hidden by the automation layer
                      </span>
                    ) : (
                      (post.author ?? "Unknown author")
                    )}
                  </span>
                  {post.text ? <Caption text={post.text} /> : null}
                </>
              )}
            </article>
          ))
        )}
      </div>
    </details>
  );
}
