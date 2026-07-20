// Output interpreter — the native-tool-calling counterpart of a text parser.
//
// With native tool calling the provider already hands back structured tool calls
// (see generateAgentTurn → AgentTurnResult in lib/ai/client.ts), so there is no
// JSON to repair out of prose. This file's whole job is to classify one turn's
// result into a decision the planner can act on: call tools, give the final
// answer, or (degenerate) neither → reprompt.
//
// Pure function, no I/O, no registry dependency. Whether a called tool actually
// exists and whether its args are valid is the planner/registry's job
// (runToolByName already Zod-validates args); keeping that out keeps this tiny.

import type { AgentTurnResult, LLMToolCall } from "@/lib/ai/client";

export type BrainDecision =
  | { kind: "tool"; toolCalls: LLMToolCall[]; assistantText: string | null }
  | { kind: "answer"; finalAnswer: string }
  // error-as-feedback: the planner feeds `error` back as an observation so the
  // model can self-correct, instead of crashing the run.
  | { kind: "invalid"; error: string };

/**
 * Interpret one agent turn. Tool calls win over text (a turn can carry a
 * "thinking out loud" text block alongside its tool_use — we keep it as
 * assistantText but act on the tools).
 */
export function interpretTurn(result: AgentTurnResult): BrainDecision {
  if (result.toolCalls.length > 0) {
    return {
      kind: "tool",
      toolCalls: result.toolCalls,
      assistantText: result.text,
    };
  }

  const answer = (result.text ?? "").trim();
  if (!answer) {
    return {
      kind: "invalid",
      error:
        "You returned neither a tool call nor an answer. Either call one of the available tools or give a final answer to the user.",
    };
  }

  return { kind: "answer", finalAnswer: answer };
}
