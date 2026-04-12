import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  buildExtensionContextSummary,
  type ExtensionCanvasContext
} from "@/lib/extension/context";
import { ExtensionContextSummaryRequestSchema } from "@/lib/extension/request-schemas";
import { getUserFromRequest } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { context } = ExtensionContextSummaryRequestSchema.parse(json) as {
      context: ExtensionCanvasContext;
    };
    const summary = await buildExtensionContextSummary(context, user.id);
    return NextResponse.json(summary);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: error.flatten() },
        { status: 400 }
      );
    }

    console.error("[extension/context-summary]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
