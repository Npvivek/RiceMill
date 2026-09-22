"use client";

import { useEffect } from "react";

type NavigationStart = {
  id: string;
  startedAt: number;
};

export function DashboardNavigationMetrics() {
  useEffect(() => {
    const stored = sessionStorage.getItem("rice-mill:dashboard-navigation");
    sessionStorage.removeItem("rice-mill:dashboard-navigation");
    if (!stored) return;

    try {
      const navigation = JSON.parse(stored) as NavigationStart;
      const elapsed = Date.now() - navigation.startedAt;
      if (!navigation.id || !Number.isFinite(elapsed) || elapsed < 0 || elapsed > 120_000) return;

      console.info("[performance] dashboard-shell-ready", {
        requestId: navigation.id,
        clickToShellMs: Math.round(elapsed),
      });
    } catch {
      // Ignore malformed diagnostic state. It has no bearing on authentication or navigation.
    }
  }, []);

  return null;
}
