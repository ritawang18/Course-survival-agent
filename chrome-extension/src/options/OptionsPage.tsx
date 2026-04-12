import { useEffect, useState } from "react";
import type { ExtensionSettings } from "../lib/types/settings";
import { getSettings, saveSettings } from "../lib/storage/settings-store";
import { DEFAULT_SETTINGS } from "../shared/constants";

export function OptionsPage() {
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void (async () => {
      setSettings(await getSettings());
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <main className="page-shell"><section className="card">Loading settings…</section></main>;
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();

    await saveSettings(settings);

    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  return (
    <main className="page-shell">
      <section className="hero">
        <div className="eyebrow">Course Survival Agent</div>
        <h1>Debug settings</h1>
        <p>Local extension configuration for development, debugging, and demo routing.</p>
      </section>

      <section className="card warning-card">
        <strong>Developer-only settings</strong>
        <p>
          Login, Canvas PAT, and course-linked data all come from the Web UI and server.
          This page is only for local URLs and debug behavior.
        </p>
      </section>

      <form className="card form" onSubmit={handleSave}>
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
          <span>Web UI URL</span>
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
          <button type="submit" className="button primary">Save debug settings</button>
        </div>

        {saved && <p className="saved">Debug settings saved locally.</p>}
      </form>
    </main>
  );
}
