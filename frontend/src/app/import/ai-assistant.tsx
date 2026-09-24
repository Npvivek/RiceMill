"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, MessageCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  createV2Conversation, getV2Conversation, sendV2Message, type Conversation,
} from "@/lib/api/client";

type Props = {
  versionId: string;
  onEvidenceClick: (transactionId: string) => Promise<void>;
};

function errorText(cause: unknown): string {
  return cause instanceof Error ? cause.message : "The assistant is unavailable. Please retry.";
}

function AssistantText({ message, onEvidenceClick }: {
  message: Conversation["messages"][number];
  onEvidenceClick: Props["onEvidenceClick"];
}) {
  if (!message.segments.length) return <span>{message.content}</span>;
  return <span>{message.segments.map((segment, index) => segment.source_ref
    ? <button key={index} type="button" className="rounded text-amber-800 underline underline-offset-2 hover:text-amber-950 dark:text-amber-300"
        title="Show this transaction in the ledger" onClick={() => void onEvidenceClick(segment.source_ref!)}>{segment.text}</button>
    : <span key={index}>{segment.text}</span>)}</span>;
}

export function AiAssistant({ versionId, onEvidenceClick }: Props) {
  const [anomalies, setAnomalies] = useState<Conversation | null>(null);
  const [chat, setChat] = useState<Conversation | null>(null);
  const [question, setQuestion] = useState("");
  const [anomalyBusy, setAnomalyBusy] = useState(true);
  const [chatBusy, setChatBusy] = useState(false);
  const [anomalyError, setAnomalyError] = useState("");
  const [chatError, setChatError] = useState("");

  useEffect(() => {
    let alive = true;
    const savedAnomaly = sessionStorage.getItem(`rice-anomalies:${versionId}`);
    const savedChat = sessionStorage.getItem(`rice-chat:${versionId}`);
    const load = async () => {
      try {
        const record = savedAnomaly ? await getV2Conversation(savedAnomaly)
          : await createV2Conversation(versionId, "anomalies");
        if (alive) {
          sessionStorage.setItem(`rice-anomalies:${versionId}`, record.id);
          setAnomalies(record);
        }
      } catch (cause) {
        if (alive) setAnomalyError(errorText(cause));
      } finally {
        if (alive) setAnomalyBusy(false);
      }
    };
    void load();
    if (savedChat) void getV2Conversation(savedChat).then((record) => {
      if (alive) setChat(record);
    }).catch(() => { sessionStorage.removeItem(`rice-chat:${versionId}`); });
    return () => { alive = false; };
  }, [versionId]);

  async function refreshAnomalies() {
    setAnomalyBusy(true);
    setAnomalyError("");
    try {
      const record = await createV2Conversation(versionId, "anomalies");
      sessionStorage.setItem(`rice-anomalies:${versionId}`, record.id);
      setAnomalies(record);
    } catch (cause) {
      setAnomalyError(errorText(cause));
    } finally {
      setAnomalyBusy(false);
    }
  }

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = question.trim();
    if (!content || chatBusy) return;
    setChatBusy(true);
    setChatError("");
    try {
      const thread = chat ?? await createV2Conversation(versionId, "chat");
      sessionStorage.setItem(`rice-chat:${versionId}`, thread.id);
      const record = await sendV2Message(thread.id, content);
      setChat(record);
      setQuestion("");
    } catch (cause) {
      setChatError(errorText(cause));
    } finally {
      setChatBusy(false);
    }
  }

  const latest = anomalies?.messages.findLast((message) => message.author_type === "assistant");
  return <section className="space-y-5 border-t border-stone-200 pt-5 dark:border-stone-800" aria-label="AI assistant">
    <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900 dark:bg-amber-950/20">
      <h3 className="flex items-center gap-2 text-lg font-semibold"><Sparkles className="h-5 w-5" /> Intelligent anomalies</h3>
      <p className="text-sm text-stone-600 dark:text-stone-400">AI observations from a bounded sample of the original descriptions. Verify cited ledger entries before acting.</p>
      {anomalyBusy && <p role="status" className="flex items-center gap-2 text-sm"><LoaderCircle className="h-4 w-4 animate-spin" /> Reading workbook descriptions…</p>}
      {anomalyError && <p role="alert" className="text-sm text-rose-700">{anomalyError}</p>}
      {latest && <div className="space-y-2 text-sm">
        <p className="font-medium">{latest.response_kind === "fallback" ? "Deterministic fallback" : latest.response_kind === "abstained" ? "Unable to verify" : "AI observation"}</p>
        <p className="whitespace-pre-wrap"><AssistantText message={latest} onEvidenceClick={onEvidenceClick} /></p>
        {latest.response_kind === "fallback" && anomalies?.fallback_findings?.map((finding, index) =>
          <p key={index}><strong>{finding.title}:</strong> {finding.explanation}</p>)}
      </div>}
      <Button type="button" variant="outline" disabled={anomalyBusy} onClick={() => void refreshAnomalies()}>Refresh observations</Button>
    </div>
    <div className="space-y-3 rounded-xl border border-stone-200 p-4 dark:border-stone-800">
      <h3 className="flex items-center gap-2 text-lg font-semibold"><MessageCircle className="h-5 w-5" /> Ask about this workbook</h3>
      <p className="text-sm text-stone-600 dark:text-stone-400">Answers use read-only analysis tools. Figures and raw descriptions must link to exact evidence.</p>
      {chat?.messages.map((message) => <div key={message.id} className={`rounded-lg p-3 text-sm ${message.author_type === "user" ? "bg-stone-100 dark:bg-stone-900" : "bg-amber-50 dark:bg-amber-950/20"}`}>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide">{message.author_type === "user" ? "You" : message.response_kind === "fallback" ? "Deterministic fallback" : "Assistant"}</p>
        <p className="whitespace-pre-wrap">{message.author_type === "assistant" ? <AssistantText message={message} onEvidenceClick={onEvidenceClick} /> : message.content}</p>
        {message.response_kind === "fallback" && chat.fallback_findings?.map((finding, index) =>
          <p key={index} className="mt-2"><strong>{finding.title}:</strong> {finding.explanation}</p>)}
      </div>)}
      <form onSubmit={(event) => void send(event)} className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="workbook-question" className="sr-only">Question about this workbook</label>
        <input id="workbook-question" value={question} maxLength={2000} disabled={chatBusy}
          onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about a transaction or cash flow…"
          className="min-w-0 flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm dark:border-stone-700 dark:bg-gray-900" />
        <Button type="submit" disabled={chatBusy || !question.trim()}>{chatBusy ? "Checking evidence…" : "Ask"}</Button>
      </form>
      {chatError && <p role="alert" className="text-sm text-rose-700">{chatError}</p>}
    </div>
  </section>;
}
