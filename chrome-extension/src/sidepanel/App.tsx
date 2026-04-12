import { useEffect, useMemo, useState } from "react";
import type { AskAgentResponse, ContextSummaryResponse } from "../lib/types/api";
import type { CanvasPageContext } from "../lib/types/canvas";
import type { ActiveTabState, ExtensionMessage } from "../lib/types/messages";
import {
  deriveChecklistTitle,
  derivePromptSuggestions,
  deriveSignals,
  deriveVisibleChecklist,
  deriveWidgetPlan,
  type SignalProfile,
  type WidgetKind
} from "./widget-model";

function dataSourceLabel(source: ContextSummaryResponse["dataSource"]) {
  switch (source) {
    case "database":
      return "Database";
    case "canvas_api":
      return "Canvas API";
    case "dom_fallback":
      return "DOM fallback";
    default:
      return "Unknown";
  }
}

function DataSourceBadge({ source }: { source: ContextSummaryResponse["dataSource"] }) {
  return <span className={`source-badge source-${source}`}>{dataSourceLabel(source)}</span>;
}

function CardHeader({
  title,
  source
}: {
  title: string;
  source: ContextSummaryResponse["dataSource"];
}) {
  return (
    <div className="card-header-row">
      <h2>{title}</h2>
      <DataSourceBadge source={source} />
    </div>
  );
}

async function sendMessage<T>(message: ExtensionMessage): Promise<T> {
  return chrome.runtime.sendMessage(message) as Promise<T>;
}

function titleForPageType(pageType: CanvasPageContext["pageType"]) {
  return pageType.replace("_", " ");
}

function strongestMode(signals: SignalProfile) {
  return signals.pageType;
}

function askPlaceholder(summary: ContextSummaryResponse, signals: SignalProfile) {
  switch (strongestMode(signals)) {
    case "assignment":
      return "Ask about this assignment, rubric, or what you could miss before submitting…";
    case "module":
      return "Ask about prerequisites, what was just learned, or what comes next in this module…";
    case "syllabus":
      return "Ask about grading, attendance, exams, or late policy…";
    case "files":
      return "Ask what matters in this folder or what should go to the web app…";
    case "dashboard":
      return "Ask what to do first across your courses…";
    case "course_home":
      return "Ask what to focus on in this course this week…";
    case "grades":
      return "Ask about your current grade and what could change it next…";
    default:
      return summary.promptSuggestions[0] ?? "Ask something about this Canvas page…";
  }
}

function riskTitle(signals: SignalProfile) {
  if (signals.pageType === "assignment") return "Hidden requirements";
  if (signals.pageType === "module") return "Prerequisite and blocker alerts";
  return "Risk snapshot";
}

function signalLabel(kind: WidgetKind, summary: ContextSummaryResponse, signals: SignalProfile) {
  if (kind === "grade_snapshot") {
    return "Detected from the Canvas grade page";
  }

  if (signals.pageType === "course_home") {
    return "Detected from the course home page";
  }

  return `Detected from the ${summary.context.pageType.replace("_", " ")} page`;
}

function renderWidget(kind: WidgetKind, summary: ContextSummaryResponse, signals: SignalProfile) {
  const { context, courseSnapshot, assignmentSnapshot, gradeSnapshot } = summary;

  switch (kind) {
    case "dashboard_deadlines":
      return (
        <section className="card" key={kind}>
          <CardHeader title="Nearest 3 due items" source={summary.cardSources.snapshot} />
          {context.dashboardDeadlines.length > 0 ? (
            <ul className="deadline-list">
              {context.dashboardDeadlines.slice(0, 3).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p>No future due item detected yet.</p>
          )}
          <p className="single-hint">
            In the future this can come from the shared data layer; for now it uses Canvas DOM and
            token-based enrichment when available.
          </p>
        </section>
      );

    case "course_snapshot":
      return (
        <section className="card" key={kind}>
          <CardHeader title="Course snapshot" source={summary.cardSources.snapshot} />
          <p className="single-hint">{signalLabel(kind, summary, signals)}</p>
          <div className="snapshot-grid">
            <div className="snapshot-block">
              <div className="snapshot-label">Course</div>
              <div className="snapshot-value">
                {courseSnapshot?.courseName ?? context.courseName ?? "Current course"}
              </div>
              <div className="snapshot-meta">
                {courseSnapshot?.courseCode ?? context.courseCode ?? "Course code not detected"}
              </div>
            </div>
            <div className="snapshot-block">
              <div className="snapshot-label">Current pressure</div>
              <div className="snapshot-value">
                {courseSnapshot?.currentPressure ??
                  context.nearestDueText ??
                  "No immediate pressure detected"}
              </div>
            </div>
          </div>
        </section>
      );

    case "assignment_snapshot":
      return (
        <section className="card" key={kind}>
          <CardHeader title="Assignment snapshot" source={summary.cardSources.snapshot} />
          <p className="single-hint">{signalLabel(kind, summary, signals)}</p>
          <div className="snapshot-grid">
            <div className="snapshot-block">
              <div className="snapshot-label">Assignment</div>
              <div className="snapshot-value">
                {assignmentSnapshot?.name ?? context.pageTitle ?? "Current assignment"}
              </div>
            </div>
            <div className="snapshot-block">
              <div className="snapshot-label">Due date</div>
              <div className="snapshot-value">
                {assignmentSnapshot?.dueAt ?? context.detectedDueText ?? "Due date not detected"}
              </div>
            </div>
            <div className="snapshot-block">
              <div className="snapshot-label">Submission type</div>
              <div className="snapshot-value">
                {assignmentSnapshot?.submissionTypes?.join(", ") ??
                  context.detectedSubmissionTypeText ??
                  "Submission type not detected"}
              </div>
            </div>
            <div className="snapshot-block">
              <div className="snapshot-label">Assignment summary</div>
              <div className="snapshot-value">
                {assignmentSnapshot?.summary ?? "No assignment summary detected yet"}
              </div>
            </div>
            <div className="snapshot-block">
              <div className="snapshot-label">Rubric</div>
              <div className="snapshot-value">
                {assignmentSnapshot?.hasRubric || context.rubricDetected
                  ? "Rubric detected"
                  : "Rubric not detected"}
              </div>
            </div>
          </div>
        </section>
      );

    case "module_summary":
      return (
        <section className="card" key={kind}>
          <CardHeader title="Module status summary" source={summary.cardSources.snapshot} />
          <p className="single-hint">{signalLabel(kind, summary, signals)}</p>
          <div className="snapshot-grid">
            <div className="snapshot-block">
              <div className="snapshot-label">Module page</div>
              <div className="snapshot-value">{context.pageTitle ?? "Current module"}</div>
            </div>
            <div className="snapshot-block">
              <div className="snapshot-label">Alerts</div>
              <div className="snapshot-value">
                {context.modulePrerequisiteDetected || context.mustViewDetected
                  ? "Prerequisite or must-view signals detected"
                  : "No obvious module blocker detected"}
              </div>
            </div>
            <div className="snapshot-block">
              <div className="snapshot-label">Last module</div>
              <div className="snapshot-value">{context.modulePastSummary ?? "Not detected yet"}</div>
            </div>
            <div className="snapshot-block">
              <div className="snapshot-label">Next module</div>
              <div className="snapshot-value">{context.moduleNextSummary ?? "Not detected yet"}</div>
            </div>
          </div>
        </section>
      );

    case "syllabus_rules":
      return (
        <section className="card" key={kind}>
          <CardHeader title="Syllabus rules" source={summary.cardSources.snapshot} />
          <p className="single-hint">{signalLabel(kind, summary, signals)}</p>
          <div className="snapshot-grid">
            <div className="snapshot-block">
              <div className="snapshot-label">Attendance</div>
              <div className="snapshot-value">{context.attendancePolicyText ?? "Not detected"}</div>
            </div>
            <div className="snapshot-block">
              <div className="snapshot-label">Grading weights</div>
              <div className="snapshot-value">{context.gradingWeightsText ?? "Not detected"}</div>
            </div>
            <div className="snapshot-block">
              <div className="snapshot-label">Exam dates</div>
              <div className="snapshot-value">{context.examDatesText ?? "Not detected"}</div>
            </div>
            <div className="snapshot-block">
              <div className="snapshot-label">Late policy</div>
              <div className="snapshot-value">{context.latePolicyText ?? "Not detected"}</div>
            </div>
          </div>
        </section>
      );

    case "files_context":
      return (
        <section className="card" key={kind}>
          <CardHeader title="Current folder context" source={summary.cardSources.snapshot} />
          <p className="single-hint">{signalLabel(kind, summary, signals)}</p>
          <div className="snapshot-grid">
            <div className="snapshot-block">
              <div className="snapshot-label">Current folder</div>
              <div className="snapshot-value">{context.folderName ?? "Folder not detected"}</div>
              <div className="snapshot-meta">
                Use the web app if you need deeper upload, parsing, or organization flows.
              </div>
            </div>
          </div>
        </section>
      );

    case "grade_snapshot":
      return (
        <section className="card" key={kind}>
          <CardHeader title="Current grade" source={summary.cardSources.snapshot} />
          <p className="single-hint">{signalLabel(kind, summary, signals)}</p>
          <div className="snapshot-grid">
            <div className="snapshot-block">
              <div className="snapshot-label">Current percent</div>
              <div className="snapshot-value">
                {typeof gradeSnapshot?.currentPercent === "number"
                  ? `${gradeSnapshot.currentPercent.toFixed(1)}%`
                  : "Not detected"}
              </div>
            </div>
            <div className="snapshot-block">
              <div className="snapshot-label">Current letter</div>
              <div className="snapshot-value">
                {gradeSnapshot?.currentLetterGrade ?? "Not detected"}
              </div>
            </div>
          </div>
        </section>
      );

    case "risk_alerts":
      return (
        <section className="card" key={kind}>
          <CardHeader title={riskTitle(signals)} source={summary.cardSources.risk} />
          <p>{summary.pageSummary}</p>
          <ul className="plain-list">
            {summary.alerts.length === 0 && <li>No obvious hidden requirement alerts found.</li>}
            {summary.alerts.map((alert) => (
              <li key={alert.id}>
                <strong>{alert.title}</strong>
                <span>{alert.detail}</span>
              </li>
            ))}
          </ul>
        </section>
      );

    case "checklist": {
      const visibleChecklist = deriveVisibleChecklist(summary);
      if (visibleChecklist.length === 0) return null;

      return (
        <section className="card" key={kind}>
          <CardHeader
            title={deriveChecklistTitle(summary)}
            source={summary.cardSources.checklist}
          />
          <ul className="checklist">
            {visibleChecklist.map((item) => (
              <li key={item.id}>
                <input type="checkbox" checked={Boolean(item.completed)} readOnly />
                <span>{item.label}</span>
              </li>
            ))}
          </ul>
        </section>
      );
    }

    default:
      return null;
  }
}

export function App() {
  const [state, setState] = useState<ActiveTabState | null>(null);
  const [summary, setSummary] = useState<ContextSummaryResponse | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AskAgentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenPageFallback, setTokenPageFallback] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  const context = summary?.context ?? state?.context ?? null;
  const debugMode = state?.settings.debugMode ?? false;
  const signals = useMemo(() => (summary ? deriveSignals(summary) : null), [summary]);
  const widgetPlan = useMemo(
    () => (summary ? deriveWidgetPlan(summary) : []),
    [summary]
  );
  const promptSuggestions = useMemo(
    () => (summary ? derivePromptSuggestions(summary) : []),
    [summary]
  );

  const currentTitle = useMemo(() => {
    if (summary?.context.pageTitle) return summary.context.pageTitle;
    if (state?.context?.pageTitle) return state.context.pageTitle;
    return "Canvas Companion";
  }, [state?.context?.pageTitle, summary?.context.pageTitle]);

  async function loadState(refresh = false) {
    setLoading(true);
    setError(null);

    try {
      const nextState = await sendMessage<ActiveTabState>({
        type: "GET_ACTIVE_TAB_STATE"
      });
      setState(nextState);

      const nextSummary = await sendMessage<ContextSummaryResponse | null>({
        type: "GET_CONTEXT_SUMMARY",
        payload: { refresh }
      });
      setSummary(nextSummary);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load side panel state.");
    } finally {
      setLoading(false);
    }
  }

  async function ask(questionText: string) {
    if (!summary?.context || !questionText.trim()) return;

    setAsking(true);
    try {
      const nextAnswer = await sendMessage<AskAgentResponse>({
        type: "ASK_AGENT",
        payload: {
          context: summary.context,
          question: questionText.trim()
        }
      });
      setAnswer(nextAnswer);
      setQuestion("");
    } finally {
      setAsking(false);
    }
  }

  async function openTokenPage() {
    const result = await sendMessage<{ ok: true; fallbackToOptions?: boolean }>({
      type: "OPEN_WEB_APP_TOKEN_PAGE"
    });
    setTokenPageFallback(Boolean(result.fallbackToOptions));
  }

  useEffect(() => {
    void loadState();
  }, []);

  useEffect(() => {
    let timeoutId: number | undefined;

    const scheduleReload = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        void loadState(true);
      }, 150);
    };

    const handleRuntimeMessage = (message: ExtensionMessage) => {
      if (message.type === "ACTIVE_TAB_CHANGED") {
        scheduleReload();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        scheduleReload();
      }
    };

    const handleFocus = () => {
      scheduleReload();
    };

    chrome.runtime.onMessage.addListener(handleRuntimeMessage);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearTimeout(timeoutId);
      chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  return (
    <main className="panel-shell">
      <header className="panel-header">
        <div>
          <div className="eyebrow">Course Survival Agent</div>
          <h1>{currentTitle}</h1>
          <p className="subtle">{context?.courseName ?? "Canvas page context"}</p>
        </div>
        <div className="header-pills">
          <div className="page-pill">{context ? titleForPageType(context.pageType) : "unknown"}</div>
          <div className={`risk-pill risk-${summary?.riskLevel ?? "low"}`}>
            {summary?.riskLevel ?? "idle"}
          </div>
        </div>
      </header>

      {!state?.hasToken && (
        <section className="card warning-card">
          <strong>Prototype mode</strong>
          <p>
            Add a Canvas token for richer context. The extension still works in DOM-only mode,
            but dashboard deadlines and assignment details become more stable with a token.
          </p>
        </section>
      )}

      {loading && (
        <section className="card">
          <p>Loading current page analysis…</p>
        </section>
      )}

      {error && !loading && (
        <section className="card">
          <strong>Could not load panel state</strong>
          <p>{error}</p>
        </section>
      )}

      {!loading && !summary && (
        <section className="card">
          <strong>Waiting for Canvas page context</strong>
          <p>
            Open a Canvas dashboard, course, assignment, module, syllabus, or files page, then
            refresh this panel. If you just reloaded the extension, refresh the Canvas tab once so
            the content script can attach.
          </p>
          <div className="actions">
            <button className="button secondary" onClick={() => void loadState(true)}>
              Refresh analysis
            </button>
            <button className="button secondary" onClick={() => sendMessage({ type: "OPEN_OPTIONS" })}>
              Settings
            </button>
          </div>
        </section>
      )}

      {!loading && summary && signals && (
        <>
          <section className="card ask-card">
            <div className="card-title-row">
              <div className="title-with-source">
                <h2>Ask agent</h2>
                <DataSourceBadge source={summary.dataSource} />
              </div>
              <button className="button ghost" onClick={() => void loadState(true)}>
                Refresh
              </button>
            </div>
            {promptSuggestions.length > 0 && (
              <div className="prompt-row">
                {promptSuggestions.map((prompt) => (
                  <button
                    key={prompt}
                    className="prompt-chip"
                    onClick={() => void ask(prompt)}
                    disabled={asking}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}
            <textarea
              className="input"
              rows={4}
              placeholder={askPlaceholder(summary, signals)}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
            />
            <div className="actions compact">
              <button
                className="button primary"
                disabled={asking || !question.trim()}
                onClick={() => void ask(question)}
              >
                {asking ? "Thinking…" : "Ask"}
              </button>
            </div>
            {answer && (
              <div className="answer-box">
                <p>{answer.answer}</p>
                {answer.followups?.length ? (
                  <ul className="plain-list">
                    {answer.followups.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )}
          </section>

          <section className="card">
            <h2>Web UI links</h2>
            <div className="actions">
              <button className="button secondary" onClick={() => void openTokenPage()}>
                Enter personal access token
              </button>
              <button className="button primary" onClick={() => sendMessage({ type: "OPEN_FULL_WEB_APP" })}>
                Open full web app
              </button>
              <button className="button secondary" onClick={() => sendMessage({ type: "OPEN_OPTIONS" })}>
                Extension settings
              </button>
            </div>
            {tokenPageFallback ? (
              <p className="single-hint">
                The Web UI token page URL is not configured yet, so the button opened extension settings for now.
              </p>
            ) : (
              <p className="single-hint">
                Widgets below are chosen by page signals, not only by URL type.
              </p>
            )}
          </section>

          <section className="card">
            <CardHeader title="Nearest 3 due items" source={summary.cardSources.snapshot} />
            {summary.context.dashboardDeadlines.length > 0 ? (
              <ul className="deadline-list">
                {summary.context.dashboardDeadlines.slice(0, 3).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : summary.context.nearestDueText ? (
              <ul className="deadline-list">
                <li>{summary.context.nearestDueText}</li>
              </ul>
            ) : (
              <p>No upcoming due item detected yet.</p>
            )}
          </section>

          {widgetPlan.map((item) => renderWidget(item.kind, summary, signals))}

          {debugMode && (
            <>
              <section className="card">
                <div className="actions compact">
                  <button
                    className="button secondary"
                    onClick={() => setShowDebug((current) => !current)}
                  >
                    {showDebug ? "Hide debug details" : "Debug details"}
                  </button>
                </div>
              </section>

              {showDebug && (
                <section className="card">
                  <CardHeader title="Debug details" source={summary.dataSource} />
                  <div className="debug-grid">
                    <div className="snapshot-block">
                      <div className="snapshot-label">Card sources</div>
                      <pre className="debug-pre">
                        {JSON.stringify(summary.cardSources, null, 2)}
                      </pre>
                    </div>
                    <div className="snapshot-block">
                      <div className="snapshot-label">Context</div>
                      <pre className="debug-pre">
                        {JSON.stringify(summary.context, null, 2)}
                      </pre>
                    </div>
                  </div>
                </section>
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}
