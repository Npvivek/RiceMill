import createClient from "openapi-fetch";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { components, paths } from "./schema";

export type Workspace = components["schemas"]["WorkspaceResponse"];
export type ImportSummary = components["schemas"]["ImportSummaryResponse"];
export type ImportPage = components["schemas"]["ImportPageResponse"];
export type ImportDetail = components["schemas"]["ImportDetailResponse"];
type ImportError = components["schemas"]["ImportErrorResponse"];

function api() {
  const baseUrl = process.env.NEXT_PUBLIC_V2_API_URL;
  if (!baseUrl) throw new Error("The v2 API URL is not configured.");
  return createClient<paths>({ baseUrl });
}

export async function bearerToken(): Promise<string> {
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

function messageFromError(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return fallback;
}

export async function listV2Imports(page = 1, pageSize = 20): Promise<ImportPage> {
  const { data, error } = await api().GET("/v2/imports", {
    params: { query: { page, page_size: pageSize } },
    headers: { Authorization: `Bearer ${await bearerToken()}` },
  });
  if (error || !data) throw new Error(messageFromError(error, "Imports are unavailable."));
  return data;
}

export async function getV2Import(importId: string, page = 1, pageSize = 50): Promise<ImportDetail> {
  const { data, error } = await api().GET("/v2/imports/{import_id}", {
    params: { path: { import_id: importId }, query: { page, page_size: pageSize } },
    headers: { Authorization: `Bearer ${await bearerToken()}` },
  });
  if (error || !data) throw new Error(messageFromError(error, "Import details are unavailable."));
  return data;
}

export async function uploadV2Import(
  file: File,
  onProgress: (percent: number) => void,
  onParsing: () => void,
): Promise<{ result: ImportSummary; duplicate: boolean }> {
  const token = await bearerToken();
  const baseUrl = process.env.NEXT_PUBLIC_V2_API_URL;
  if (!baseUrl) throw new Error("The v2 API URL is not configured.");
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${baseUrl.replace(/\/$/, "")}/v2/imports`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.timeout = 180_000;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100));
    };
    xhr.upload.onload = onParsing;
    xhr.onerror = () => reject(new Error("The upload could not reach the server. Please retry."));
    xhr.ontimeout = () => reject(new Error("The server took too long. Check imports before retrying."));
    xhr.onload = () => {
      let body: unknown;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        reject(new Error("The server returned an unreadable response."));
        return;
      }
      if (xhr.status !== 200 && xhr.status !== 201) {
        reject(new Error(messageFromError(body as ImportError, `Import failed (HTTP ${xhr.status}).`)));
        return;
      }
      if (!body || typeof body !== "object" || !("id" in body) || typeof body.id !== "string") {
        reject(new Error("The server returned an invalid import record."));
        return;
      }
      resolve({ result: body as ImportSummary, duplicate: xhr.status === 200 });
    };
    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}
