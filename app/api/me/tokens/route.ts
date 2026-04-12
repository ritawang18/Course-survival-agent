import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DEFAULT_MODEL_BY_PROVIDER, type AIProvider } from "@/lib/ai/models";
import { getUserFromRequest } from "@/lib/supabase/server";
import {
  deleteUserIntegrationToken,
  getUserIntegrationTokens,
  maskToken,
  upsertUserIntegrationToken,
} from "@/lib/db/user_integration_tokens";
import {
  deleteUserLlmSettings,
  getUserLlmSettings,
  upsertUserLlmSettings,
} from "@/lib/db/user_llm_settings";

export const runtime = "nodejs";

const ProviderSchema = z.enum(["openai", "anthropic", "gemini"]);

const UpdateSchema = z.object({
  llmProvider: ProviderSchema.optional(),
  llmModel: z.string().trim().min(1).optional(),
  llmApiKey: z.string().trim().min(1).optional().nullable(),
  canvasToken: z.string().trim().min(1).optional().nullable(),
});

function buildResponse(input: {
  llm:
    | {
        provider: AIProvider;
        model: string;
        apiKey: string;
        updatedAt: string | null;
      }
    | null;
  canvasToken: string | null;
  canvasUpdatedAt: string | null;
}) {
  return {
    hasLlmSettings: !!input.llm,
    llmProvider: input.llm?.provider ?? "openai",
    llmModel: input.llm?.model ?? DEFAULT_MODEL_BY_PROVIDER.openai,
    llmApiKeyPreview: input.llm ? maskToken(input.llm.apiKey) : null,
    llmUpdatedAt: input.llm?.updatedAt ?? null,
    hasCanvasToken: !!input.canvasToken,
    canvasTokenPreview: input.canvasToken ? maskToken(input.canvasToken) : null,
    canvasUpdatedAt: input.canvasUpdatedAt,
  };
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [llmSettings, integrationRows] = await Promise.all([
      getUserLlmSettings(user.id),
      getUserIntegrationTokens(user.id),
    ]);

    const legacyLlm = integrationRows.find((row) => row.provider === "llm");
    const canvas = integrationRows.find((row) => row.provider === "canvas");

    return NextResponse.json(
      buildResponse({
        llm: llmSettings
          ? {
              provider: llmSettings.provider,
              model: llmSettings.model,
              apiKey: llmSettings.api_key,
              updatedAt: llmSettings.updated_at,
            }
          : legacyLlm
          ? {
              provider: "openai",
              model: DEFAULT_MODEL_BY_PROVIDER.openai,
              apiKey: legacyLlm.token,
              updatedAt: legacyLlm.updated_at,
            }
          : null,
        canvasToken: canvas?.token ?? null,
        canvasUpdatedAt: canvas?.updated_at ?? null,
      })
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof UpdateSchema>;
  try {
    body = UpdateSchema.parse(await req.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid request body";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    if (
      "llmApiKey" in body ||
      "llmProvider" in body ||
      "llmModel" in body
    ) {
      if (body.llmApiKey === null) {
        await deleteUserLlmSettings(user.id);
        await deleteUserIntegrationToken(user.id, "llm");
      } else if (body.llmApiKey) {
        if (!body.llmProvider) {
          return NextResponse.json(
            { error: "llmProvider is required when saving an LLM API key" },
            { status: 400 }
          );
        }
        const model = body.llmModel?.trim() || DEFAULT_MODEL_BY_PROVIDER[body.llmProvider];
        await upsertUserLlmSettings({
          userId: user.id,
          provider: body.llmProvider,
          model,
          apiKey: body.llmApiKey,
        });
        await deleteUserIntegrationToken(user.id, "llm");
      }
    }

    if ("canvasToken" in body) {
      if (body.canvasToken === null) {
        await deleteUserIntegrationToken(user.id, "canvas");
      } else if (body.canvasToken) {
        await upsertUserIntegrationToken(user.id, "canvas", body.canvasToken);
      }
    }

    const [llmSettings, integrationRows] = await Promise.all([
      getUserLlmSettings(user.id),
      getUserIntegrationTokens(user.id),
    ]);
    const canvas = integrationRows.find((row) => row.provider === "canvas");

    return NextResponse.json({
      ok: true,
      ...buildResponse({
        llm: llmSettings
          ? {
              provider: llmSettings.provider,
              model: llmSettings.model,
              apiKey: llmSettings.api_key,
              updatedAt: llmSettings.updated_at,
            }
          : null,
        canvasToken: canvas?.token ?? null,
        canvasUpdatedAt: canvas?.updated_at ?? null,
      }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
