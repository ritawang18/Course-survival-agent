// calendar-tools.ts wraps Google Calendar event listing for the agent

import { z } from "zod";
import { listEvents } from "@/lib/google-calendar";
import { getCalendarClient } from "@/lib/calendar-auth";
import type { ToolDefinition } from "@/lib/agent/types";

export const listCalendarEventsTool: ToolDefinition<
    { days?: number },
    {
        events: { id: string; summary: string; start: string; end: string }[];
        connected: boolean;
        error?: string;
    }
> = {
    name: "list_calendar_events",
    description: "List the user's upcoming Google Calendar events for the next N days (default 14). Returns connected: false if the user hasn't linked Google Calendar yet.",
    inputSchema: z.object({
        days: z.number().int().min(1).max(60).optional().default(14),
    }),
    execute: async (args, _ctx) => {
        const auth = await getCalendarClient();
        if (!auth.ok) {
            return { events: [], connected: false, error: auth.error };
        }

        const events = await listEvents(auth.client, args.days ?? 14);
        return { events, connected: true };
    },
    sideEffect: false,
};
