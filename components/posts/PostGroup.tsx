import type { Platform, Post } from "@/lib/types";
import { extractMentions, isRedacted } from "@/lib/caption";
import { num } from "@/lib/format";
import { PlatformIcon } from "@/components/data/PlatformIcon";
import { Caption } from "./Caption";
import { MentionChips } from "./MentionChips";
import { PostThumb } from "./PostThumb";

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
    <details className="card group">
      <summary className="flex cursor-pointer list-none items-center gap-2 select-none [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden="true"
          className="text-[11px] text-ink-soft transition-transform group-open:rotate-90"
        >
          ▶
        </span>
        <PlatformIcon platform={platform} />
        <span className="font-semibold">#{hashtag}</span>
        <span className="muted num text-[13px]">
          {count} post{count === 1 ? "" : "s"}
        </span>
      </summary>

      {platform === "facebook" ? (
        <p className="muted" style={{ fontSize: 12, marginTop: "var(--space-3)" }}>
          Facebook links, names and full captions are read passively from the page&rsquo;s own
          responses; a post none of those sources covered shows without a link — copy its text
          into Facebook search to find the original.
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
              {(() => {
                const ig = post.platform === "instagram";
                // The full captured caption when we have it, else the DOM's
                // truncated/alt text.
                const captionText = ig
                  ? (post.caption ?? post.preview)
                  : (post.caption ?? post.text);
                const name = ig
                  ? post.username && `@${post.username}`
                  : (post.username ?? post.author);
                return (
                  <div className="row items-start gap-3">
                    {post.imageUrl ? (
                      <PostThumb src={post.imageUrl} alt={captionText ?? `${post.platform} post`} />
                    ) : null}
                    <div className="stack min-w-0 flex-1" style={{ gap: 6 }}>
                      {name && !isRedacted(name) ? (
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{name}</span>
                      ) : !ig && isRedacted(post.author) && !post.username ? (
                        <span className="pill muted" style={{ fontStyle: "italic" }}>
                          name hidden by the automation layer
                        </span>
                      ) : null}
                      {captionText ? (
                        <>
                          <Caption text={captionText} />
                          <MentionChips handles={extractMentions(captionText)} />
                        </>
                      ) : (
                        <p className="muted" style={{ fontSize: 13 }}>
                          (no caption captured)
                        </p>
                      )}
                      {post.otherHashtags.length ? (
                        <span className="muted" style={{ fontSize: 12 }}>
                          {post.otherHashtags.map((t) => `#${t}`).join(" ")}
                        </span>
                      ) : null}
                      {post.likeCount !== null || post.commentCount !== null ? (
                        <span className="muted num" style={{ fontSize: 12 }}>
                          {post.likeCount !== null ? `${num(post.likeCount)} likes` : null}
                          {post.likeCount !== null && post.commentCount !== null ? " · " : null}
                          {post.commentCount !== null ? `${num(post.commentCount)} comments` : null}
                        </span>
                      ) : null}
                      {post.url ? (
                        <a
                          href={post.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: 12, fontWeight: 600 }}
                        >
                          Open on {ig ? "Instagram" : "Facebook"} ↗
                        </a>
                      ) : null}
                    </div>
                  </div>
                );
              })()}
            </article>
          ))
        )}
      </div>
    </details>
  );
}
