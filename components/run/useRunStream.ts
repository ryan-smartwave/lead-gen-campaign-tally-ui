"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RunEvent, RunViewState } from "@/lib/types";
import { initialRunState, reduceRunEvent, reduceRunEvents } from "@/lib/runState";

/**
 * Watches the active run: replay the snapshot, then tail live events.
 *
 * Both paths feed the same pure reducer, and every event carries a sequence
 * number, so a page reload mid-run just replays into the same state instead of
 * needing its own code path.
 */
export function useRunStream() {
  const [state, setState] = useState<RunViewState | null>(null);
  const [connected, setConnected] = useState(false);
  const sourceRef = useRef<EventSource | null>(null);

  const attach = useCallback((sinceSeq: number) => {
    sourceRef.current?.close();
    const es = new EventSource(`/api/run/events?sinceSeq=${sinceSeq}`);
    sourceRef.current = es;

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = () => {
      /* unnamed frames are pings */
    };

    // Every event type is a named SSE event, so subscribe to each.
    const types: RunEvent["type"][] = [
      "run_started",
      "hashtag_started",
      "hashtag_done",
      "hashtag_error",
      "waiting",
      "danger",
      "run_finished",
    ];
    for (const type of types) {
      es.addEventListener(type, (raw) => {
        const event = JSON.parse((raw as MessageEvent).data) as RunEvent;
        setState((prev) => reduceRunEvent(prev ?? initialRunState(), event));
      });
    }
    return es;
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/run/active", { cache: "no-store" });
      const snap = await res.json();
      if (!snap.events?.length) {
        setState(null);
        return;
      }
      const reduced = reduceRunEvents(snap.events as RunEvent[]);
      setState(reduced);
      if (snap.active) attach(reduced.lastSeq);
    } catch {
      /* leave state as-is; the panel shows its own staleness */
    }
  }, [attach]);

  useEffect(() => {
    void refresh();
    return () => sourceRef.current?.close();
  }, [refresh]);

  // Stop tailing once the run reaches a terminal state.
  useEffect(() => {
    if (state && state.status !== "running") {
      sourceRef.current?.close();
      setConnected(false);
    }
  }, [state]);

  return { state, connected, refresh, attach };
}
