// hold all tool definitions in one place 
// expose safe lookup by name 
// validate args before execution 

import {z} from "zod";
import type {AgentContext, ToolDefinition} from "@/lib/agent/types";

const echoTool: ToolDefinition<{ text: string}, { echoed: string}> = {
    name: "echo",
    description: "Echo back the given text",
    inputSchema: z.object({
        text: z.string().min(1),
    }),
    execute: async (args, _ctx) => {
        return {echoed: args.text};
    },
    sideEffect: false,
}; 

const TOOL_LIST = [echoTool] as const;

const TOOL_MAP = new Map<string, ToolDefinition>(
    TOOL_LIST.map((tool) => [tool.name, tool])
);

export function getTool(name: string): ToolDefinition | null {
    return TOOL_MAP.get(name) ?? null;
}

export function listTools(): ToolDefinition[] {
    return [...TOOL_LIST];
}

export async function runToolByName(
    name: string,
    rawArgs: unknown,
    ctx: AgentContext
) {
    const tool = getTool(name);
    if (!tool) {
        throw new Error(`Unknown tool: ${name}`);
    }

    const args = tool.inputSchema.parse(rawArgs);
    const data = await tool.execute(args, ctx);
    return data; 
}