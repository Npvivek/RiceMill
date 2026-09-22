"use client";

import Link, { useLinkStatus } from "next/link";
import { LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function isOrdinaryActivation(event: React.MouseEvent<HTMLAnchorElement>): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

function DashboardLinkLabel({ requested, delayed, retry }: { requested: boolean; delayed: boolean; retry: boolean }) {
  const { pending } = useLinkStatus();
  const isOpening = requested || pending;

  return (
    <>
      <LoaderCircle
        aria-hidden
        className={cn("size-3.5 animate-spin", isOpening ? "opacity-100" : "opacity-0")}
      />
      <span>{retry ? "Try dashboard again" : isOpening ? delayed ? "Still opening…" : "Opening…" : "Mill Dashboard"}</span>
      <span className="sr-only" role="status" aria-live="polite">
        {retry ? "Dashboard is taking longer than expected. Try again." : isOpening ? "Opening" : ""}
      </span>
    </>
  );
}

export function DashboardLink() {
  const [requested, setRequested] = useState(false);
  const [delayed, setDelayed] = useState(false);
  const [retry, setRetry] = useState(false);
  const requestId = useRef<string | null>(null);
  const clickStartedAt = useRef<number | null>(null);

  useEffect(() => {
    if (!requested || !requestId.current || clickStartedAt.current === null) return;
    console.info("[performance] dashboard-link-feedback", {
      requestId: requestId.current,
      clickToFeedbackMs: Math.round(performance.now() - clickStartedAt.current),
    });
  }, [requested]);

  useEffect(() => {
    if (!requested) return;

    const delayedTimer = window.setTimeout(() => setDelayed(true), 8_000);
    const retryTimer = window.setTimeout(() => {
      setRequested(false);
      setRetry(true);
    }, 30_000);

    return () => {
      window.clearTimeout(delayedTimer);
      window.clearTimeout(retryTimer);
    };
  }, [requested]);

  return (
    <Link
      href="/dashboard"
      aria-busy={requested || undefined}
      className={cn(
        buttonVariants({ variant: "outline", size: "sm" }),
        "ml-1 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/50",
        requested && "pointer-events-none",
      )}
      onClick={(event) => {
        if (!isOrdinaryActivation(event)) return;
        if (requested) {
          event.preventDefault();
          return;
        }
        const startedAt = performance.timeOrigin + performance.now();
        const id = crypto.randomUUID();
        requestId.current = id;
        clickStartedAt.current = performance.now();
        sessionStorage.setItem("rice-mill:dashboard-navigation", JSON.stringify({ id, startedAt }));
        setRequested(true);
        setDelayed(false);
        setRetry(false);
      }}
    >
      <DashboardLinkLabel requested={requested} delayed={delayed} retry={retry} />
    </Link>
  );
}
