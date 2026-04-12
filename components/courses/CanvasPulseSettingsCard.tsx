"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useAppStore } from "@/lib/store/AppStoreProvider";
import type { Course } from "@/lib/store/types";
import { Database, Link2, PlugZap } from "lucide-react";

export function CanvasPulseSettingsCard({ course }: { course: Course }) {
  const { refreshData } = useAppStore();
  const [canvasCourseId, setCanvasCourseId] = useState(course.canvas_course_id ?? "");
  const [canvasBaseUrl, setCanvasBaseUrl] = useState(course.canvas_base_url ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCanvasCourseId(course.canvas_course_id ?? "");
    setCanvasBaseUrl(course.canvas_base_url ?? "");
  }, [course.canvas_course_id, course.canvas_base_url, course.id]);

  async function saveSettings(clear = false) {
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("You must be signed in.");

      const payload = {
        courseUuid: course.id,
        canvasCourseId: clear ? null : canvasCourseId.trim() || null,
        canvasBaseUrl: clear ? null : canvasBaseUrl.trim() || null,
      };

      const res = await fetch("/api/course-canvas-settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to save Canvas pulse settings.");
      }

      if (clear) {
        setCanvasCourseId("");
        setCanvasBaseUrl("");
      }

      await refreshData();
      setMessage(
        clear
          ? "Canvas pulse settings cleared for this course."
          : "Canvas pulse settings saved. Weekly pulse can now use Canvas API enrichment for this course."
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Failed to save Canvas pulse settings."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-warning/10 flex items-center justify-center">
            <PlugZap className="h-4 w-4 text-warning" />
          </div>
          <div>
            <CardTitle>Canvas pulse settings</CardTitle>
            <p className="text-xs text-muted mt-0.5">
              Map this Web UI course to its real Canvas course so weekly pulse can pull Canvas API data.
            </p>
          </div>
        </div>
        <Badge variant={course.canvas_course_id && course.canvas_base_url ? "success" : "muted"}>
          {course.canvas_course_id && course.canvas_base_url ? "Configured" : "Needs config"}
        </Badge>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="rounded-xl border border-border/60 p-3 text-xs text-muted space-y-2">
          <div className="flex items-center gap-2">
            <Database className="h-3.5 w-3.5" />
            <span>
              Current course: <span className="font-medium text-text">{course.code ?? course.course_id}</span>
              {" · "}
              <span className="font-medium text-text">{course.name ?? course.course_name}</span>
            </span>
          </div>
        </div>

        <div className="rounded-xl bg-[hsl(var(--surface-2))] p-3 text-xs text-muted space-y-2">
          <div>
            <span className="font-medium text-text">Canvas course ID</span>: the number in the Canvas URL after{" "}
            <span className="font-mono">/courses/</span>.
          </div>
          <div>
            Example: if the page is{" "}
            <span className="font-mono">https://wustl.instructure.com/courses/12345</span>, then
            the course ID is <span className="font-mono">12345</span>.
          </div>
          <div>
            <span className="font-medium text-text">Canvas base URL</span>: the site origin only.
          </div>
          <div>
            Example: <span className="font-mono">https://wustl.instructure.com</span>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
            {error}
          </div>
        )}

        {message && (
          <div className="rounded-xl border border-success/30 bg-success/5 px-3 py-2 text-xs text-success">
            {message}
          </div>
        )}

        <div>
          <label className="text-xs font-medium">Canvas course ID</label>
          <Input
            value={canvasCourseId}
            onChange={(event) => setCanvasCourseId(event.target.value)}
            placeholder="e.g. 12345"
            className="mt-1.5"
          />
        </div>

        <div>
          <label className="text-xs font-medium">Canvas base URL</label>
          <Input
            value={canvasBaseUrl}
            onChange={(event) => setCanvasBaseUrl(event.target.value)}
            placeholder="https://your-school.instructure.com"
            className="mt-1.5"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            loading={saving}
            disabled={!canvasCourseId.trim() || !canvasBaseUrl.trim()}
            onClick={() => saveSettings(false)}
          >
            Save Canvas mapping
          </Button>
          <Button
            variant="ghost"
            loading={saving}
            onClick={() => saveSettings(true)}
          >
            Clear
          </Button>
          <Link href="/settings" className="text-xs text-accent hover:underline inline-flex items-center gap-1">
            <Link2 className="h-3.5 w-3.5" />
            PAT is managed in settings
          </Link>
        </div>
      </CardBody>
    </Card>
  );
}
