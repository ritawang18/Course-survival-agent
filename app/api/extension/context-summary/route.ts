import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  buildExtensionContextSummary,
  type ExtensionCanvasContext
} from "@/lib/extension/context";
import { ExtensionContextSummaryRequestSchema } from "@/lib/extension/request-schemas";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { context } = ExtensionContextSummaryRequestSchema.parse(json) as {
      context: ExtensionCanvasContext;
    };
    const summary = await buildExtensionContextSummary(context);
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
