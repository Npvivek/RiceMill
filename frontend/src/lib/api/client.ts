import createClient from "openapi-fetch";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { components, paths } from "./schema";

export type Workspace = components["schemas"]["WorkspaceResponse"];

function api() {
  const baseUrl = process.env.NEXT_PUBLIC_V2_API_URL;
  if (!baseUrl) throw new Error("The v2 API URL is not configured.");
  return createClient<paths>({ baseUrl });
}

async function bearerToken(): Promise<string> {
  const { data, error } = await createSupabaseBrowserClient().auth.getSession();
  if (error || !data.session) throw error ?? new Error("Sign in to use the mill workspace.");
  return data.session.access_token;
}

export async function listV2Workspaces(): Promise<Workspace[]> {
  const { data, error } = await api().GET("/v2/workspaces", {
    headers: { Authorization: `Bearer ${await bearerToken()}` },
  });
  if (error || !data) throw new Error("Workspace request failed.");
  return data;
}

export async function getV2Workspace(workspaceId: string): Promise<Workspace> {
  const { data, error } = await api().GET("/v2/workspaces/{workspace_id}", {
    params: { path: { workspace_id: workspaceId } },
    headers: { Authorization: `Bearer ${await bearerToken()}` },
  });
  if (error || !data) throw new Error("Workspace request failed.");
  return data;
}
