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
                (() => {
                  // The real caption when we captured it, else the alt-text preview.
                  const captionText = post.caption ?? post.preview;
                  return (
                    <div className="row items-start gap-3">
                      {post.imageUrl ? (
                        <PostThumb src={post.imageUrl} alt={captionText ?? "Instagram post"} />
                      ) : null}
                      <div className="stack min-w-0 flex-1" style={{ gap: 6 }}>
                        {post.username ? (
                          <span style={{ fontSize: 13, fontWeight: 600 }}>@{post.username}</span>
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
                        {post.likeCount !== null || post.commentCount !== null ? (
                          <span className="muted num" style={{ fontSize: 12 }}>
                            {post.likeCount !== null ? `${num(post.likeCount)} likes` : null}
                            {post.likeCount !== null && post.commentCount !== null ? " · " : null}
                            {post.commentCount !== null ? `${num(post.commentCount)} comments` : null}
                          </span>
                        ) : null}
                        <a
                          href={post.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: 12, fontWeight: 600 }}
                        >
                          Open on Instagram ↗
                        </a>
                      </div>
                    </div>
                  );
                })()
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
