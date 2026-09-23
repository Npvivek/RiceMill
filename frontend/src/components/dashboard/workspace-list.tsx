"use client";

import { useCallback, useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { listV2Workspaces, type Workspace } from "@/lib/api/client";

export function WorkspaceList() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setWorkspaces(await listV2Workspaces());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Workspaces</h1>
        <p className="mt-2 text-sm text-muted-foreground">Mill workspaces available to your account.</p>
      </div>
      <Card>
        <CardContent>
          {loading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
              <LoaderCircle className="h-4 w-4 animate-spin" /> Loading workspaces…
            </p>
          ) : error ? (
            <div className="space-y-3">
              <p className="text-sm">Workspaces are unavailable right now.</p>
              <Button type="button" variant="outline" onClick={() => void load()}>Try again</Button>
            </div>
          ) : workspaces.length === 0 ? (
            <p className="text-sm text-muted-foreground">No workspaces are assigned to this account.</p>
          ) : (
            <ul className="divide-y divide-border">
              {workspaces.map((workspace) => (
                <li key={workspace.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <span className="font-medium">{workspace.name}</span>
                  <span className="text-xs capitalize text-muted-foreground">{workspace.role}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
