import { useEffect, useState } from "react";
import type { ExtensionSettings } from "../lib/types/settings";
import { getSettings, saveSettings } from "../lib/storage/settings-store";
import { clearCanvasToken, getCanvasToken, saveCanvasToken } from "../lib/storage/token-store";
import { DEFAULT_SETTINGS } from "../shared/constants";

export function OptionsPage() {
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void (async () => {
      setSettings(await getSettings());
      setToken((await getCanvasToken()) ?? "");
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <main className="page-shell"><section className="card">Loading settings…</section></main>;
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();

    await saveSettings(settings);

    if (token.trim()) {
      await saveCanvasToken(token);
    } else {
      await clearCanvasToken();
    }

    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  async function handleClearToken() {
    await clearCanvasToken();
    setToken("");
  }

  return (
    <main className="page-shell">
      <section className="hero">
        <div className="eyebrow">Course Survival Agent</div>
        <h1>Extension settings</h1>
        <p>Manual-token prototype mode for Canvas companion sidebar demos.</p>
      </section>

      <section className="card warning-card">
        <strong>Prototype warning</strong>
        <p>
          Your Canvas access token is stored locally in this browser using Chrome
          extension storage. Do not use a shared machine or a high-privilege token.
        </p>
      </section>

      <form className="card form" onSubmit={handleSave}>
        <label>
          <span>Canvas access token</span>
          <textarea
            rows={5}
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="Paste personal Canvas token here"
          />
        </label>

        <label>
          <span>Backend base URL</span>
          <input
            type="url"
            value={settings.backendBaseUrl}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                backendBaseUrl: event.target.value
              }))
            }
          />
        </label>

        <label>
          <span>Full web app URL</span>
          <input
            type="url"
            value={settings.webAppBaseUrl}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                webAppBaseUrl: event.target.value
              }))
            }
          />
        </label>

        <label>
          <span>Web UI token page URL</span>
          <input
            type="url"
            value={settings.webAppTokenUrl}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                webAppTokenUrl: event.target.value
              }))
            }
            placeholder="Defaults to the Web UI /settings page"
          />
        </label>

        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.enableCanvasApiEnrichment}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                enableCanvasApiEnrichment: event.target.checked
              }))
            }
          />
          <span>Use token for richer Canvas API enrichment</span>
        </label>

        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.debugMode}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                debugMode: event.target.checked
              }))
            }
          />
          <span>Enable debug mode in the side panel</span>
        </label>

        <div className="actions">
          <button type="submit" className="button primary">Save settings</button>
          <button type="button" className="button secondary" onClick={() => void handleClearToken()}>
            Clear token
          </button>
        </div>

        {saved && <p className="saved">Settings saved locally.</p>}
      </form>
    </main>
  );
}
