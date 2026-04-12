"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  DEFAULT_MODEL_BY_PROVIDER,
  MODEL_PRESETS,
  type AIProvider,
} from "@/lib/ai/models";
import {
  KeyRound,
  Brain,
  School,
  ShieldAlert,
  CheckCircle2,
  Trash2,
} from "lucide-react";

interface TokenState {
  hasLlmSettings: boolean;
  llmProvider: AIProvider;
  llmModel: string;
  llmApiKeyPreview: string | null;
  llmUpdatedAt: string | null;
  hasCanvasToken: boolean;
  canvasTokenPreview: string | null;
  canvasUpdatedAt: string | null;
}

const emptyState: TokenState = {
  hasLlmSettings: false,
  llmProvider: "openai",
  llmModel: DEFAULT_MODEL_BY_PROVIDER.openai,
  llmApiKeyPreview: null,
  llmUpdatedAt: null,
  hasCanvasToken: false,
  canvasTokenPreview: null,
  canvasUpdatedAt: null,
};

async function authFetch(path: string, init?: RequestInit) {
  const supabase = getSupabaseClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new Error("You must be signed in to manage tokens.");
  }

  return fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
}

function formatUpdatedAt(value: string | null) {
  if (!value) return "Not saved yet";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Saved";
  return `Saved ${date.toLocaleString()}`;
}

export default function SettingsPage() {
  const [tokenState, setTokenState] = useState<TokenState>(emptyState);
  const [llmProvider, setLlmProvider] = useState<AIProvider>("openai");
  const [llmModel, setLlmModel] = useState(DEFAULT_MODEL_BY_PROVIDER.openai);
  const [llmApiKey, setLlmApiKey] = useState("");
  const [canvasToken, setCanvasToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingLlm, setSavingLlm] = useState(false);
  const [savingCanvas, setSavingCanvas] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const modelOptions = useMemo(() => MODEL_PRESETS[llmProvider], [llmProvider]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/me/tokens", { method: "GET" });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to load token settings.");
      }
      const next = json as TokenState;
      setTokenState(next);
      setLlmProvider(next.llmProvider);
      setLlmModel(next.llmModel);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load token settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!llmModel || !MODEL_PRESETS[llmProvider].includes(llmModel)) {
      setLlmModel(DEFAULT_MODEL_BY_PROVIDER[llmProvider]);
    }
  }, [llmProvider, llmModel]);

  const saveLlmSettings = async () => {
    setSavingLlm(true);
    setError(null);
    setMessage(null);
    try {
      const res = await authFetch("/api/me/tokens", {
        method: "PUT",
        body: JSON.stringify({
          llmProvider,
          llmModel,
          llmApiKey,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to save LLM settings.");
      }
      const next = json as TokenState;
      setTokenState(next);
      setLlmProvider(next.llmProvider);
      setLlmModel(next.llmModel);
      setLlmApiKey("");
      setMessage(
        `LLM settings saved. The backend will now prefer ${next.llmProvider} with model ${next.llmModel}.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save LLM settings.");
    } finally {
      setSavingLlm(false);
    }
  };

  const clearLlmSettings = async () => {
    setSavingLlm(true);
    setError(null);
    setMessage(null);
    try {
      const res = await authFetch("/api/me/tokens", {
        method: "PUT",
        body: JSON.stringify({ llmApiKey: null }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to clear LLM settings.");
      }
      const next = json as TokenState;
      setTokenState(next);
      setLlmProvider(next.llmProvider);
      setLlmModel(next.llmModel);
      setLlmApiKey("");
      setMessage("LLM settings removed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear LLM settings.");
    } finally {
      setSavingLlm(false);
    }
  };

  const saveCanvasToken = async () => {
    setSavingCanvas(true);
    setError(null);
    setMessage(null);
    try {
      const res = await authFetch("/api/me/tokens", {
        method: "PUT",
        body: JSON.stringify({ canvasToken }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to save Canvas token.");
      }
      setTokenState(json as TokenState);
      setCanvasToken("");
      setMessage("Canvas personal access token saved. Backend Canvas enrichment can now reuse it.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save Canvas token.");
    } finally {
      setSavingCanvas(false);
    }
  };

  const clearCanvasToken = async () => {
    setSavingCanvas(true);
    setError(null);
    setMessage(null);
    try {
      const res = await authFetch("/api/me/tokens", {
        method: "PUT",
        body: JSON.stringify({ canvasToken: null }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to clear Canvas token.");
      }
      setTokenState(json as TokenState);
      setCanvasToken("");
      setMessage("Canvas personal access token removed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear Canvas token.");
    } finally {
      setSavingCanvas(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Settings"
        title="Tokens & integrations"
        description="Choose your LLM provider and model, then save the API key your backend should use."
      />

      <div className="card-surface p-4 mb-5 flex items-start gap-3 border-l-4 border-l-warning">
        <ShieldAlert className="h-4 w-4 text-warning mt-0.5 shrink-0" />
        <div className="text-sm text-muted">
          These secrets are stored server-side for your account. This is still prototype-mode plumbing, not a production-grade secret management system.
        </div>
      </div>

      {error && (
        <div className="card-surface p-4 mb-4 border border-danger/30 text-sm text-danger">
          {error}
        </div>
      )}

      {message && (
        <div className="card-surface p-4 mb-4 border border-success/30 text-sm text-success flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-5">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-[hsl(var(--accent-soft))] flex items-center justify-center">
                <Brain className="h-4 w-4 text-accent" />
              </div>
              <div>
                <CardTitle>LLM provider settings</CardTitle>
                <p className="text-xs text-muted mt-0.5">
                  Used by upload parsing, planner generation, weekly pulse, professor insights, and ask-agent routes.
                </p>
              </div>
            </div>
            <Badge variant={tokenState.hasLlmSettings ? "success" : "muted"}>
              {loading ? "Loading" : tokenState.hasLlmSettings ? "Saved" : "Not saved"}
            </Badge>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="text-xs text-muted">
              Saved key: {tokenState.llmApiKeyPreview ?? "None"}
            </div>
            <div className="text-xs text-muted">
              Provider: {tokenState.llmProvider} · Model: {tokenState.llmModel}
            </div>
            <div className="text-xs text-muted">
              {formatUpdatedAt(tokenState.llmUpdatedAt)}
            </div>

            <div>
              <label className="text-xs font-medium">Provider</label>
              <select
                value={llmProvider}
                onChange={(e) => setLlmProvider(e.target.value as AIProvider)}
                className="mt-1.5 h-9 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:ring-4 focus:ring-[hsl(var(--accent)/0.12)] focus:border-accent/60"
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Claude / Anthropic</option>
                <option value="gemini">Gemini / Google</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium">Model</label>
              <select
                value={llmModel}
                onChange={(e) => setLlmModel(e.target.value)}
                className="mt-1.5 h-9 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:ring-4 focus:ring-[hsl(var(--accent)/0.12)] focus:border-accent/60"
              >
                {modelOptions.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium">API key</label>
              <Input
                type="password"
                value={llmApiKey}
                onChange={(e) => setLlmApiKey(e.target.value)}
                placeholder={`Paste your ${llmProvider} API key`}
                className="mt-1.5"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                onClick={saveLlmSettings}
                loading={savingLlm}
                disabled={!llmApiKey.trim()}
              >
                <KeyRound className="h-4 w-4" />
                Save LLM settings
              </Button>
              <Button
                variant="ghost"
                onClick={clearLlmSettings}
                loading={savingLlm}
                disabled={!tokenState.hasLlmSettings}
              >
                <Trash2 className="h-4 w-4" />
                Clear
              </Button>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-warning/10 flex items-center justify-center">
                <School className="h-4 w-4 text-warning" />
              </div>
              <div>
                <CardTitle>Canvas personal access token</CardTitle>
                <p className="text-xs text-muted mt-0.5">
                  Used for Canvas API enrichment when backend jobs need fresher course data.
                </p>
              </div>
            </div>
            <Badge variant={tokenState.hasCanvasToken ? "success" : "muted"}>
              {loading ? "Loading" : tokenState.hasCanvasToken ? "Saved" : "Not saved"}
            </Badge>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="text-xs text-muted">
              Saved value: {tokenState.canvasTokenPreview ?? "None"}
            </div>
            <div className="text-xs text-muted">
              {formatUpdatedAt(tokenState.canvasUpdatedAt)}
            </div>
            <div>
              <label className="text-xs font-medium">New Canvas PAT</label>
              <Input
                type="password"
                value={canvasToken}
                onChange={(e) => setCanvasToken(e.target.value)}
                placeholder="Paste your Canvas personal access token"
                className="mt-1.5"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                onClick={saveCanvasToken}
                loading={savingCanvas}
                disabled={!canvasToken.trim()}
              >
                <KeyRound className="h-4 w-4" />
                Save Canvas PAT
              </Button>
              <Button
                variant="ghost"
                onClick={clearCanvasToken}
                loading={savingCanvas}
                disabled={!tokenState.hasCanvasToken}
              >
                <Trash2 className="h-4 w-4" />
                Clear
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
