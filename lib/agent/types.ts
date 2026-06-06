// Define AgentRunState, AgentStep, ToolDefinition, ToolResult, AgentConfig 
import {z} from "zod";

export type AgentRole = "user" | "assistant" | "system" | "tool";

export interface AgentMessage {
    role: AgentRole;
    content: string;
    name?: string;
    createAt: string;
}

export type StepStatus = "planned" | "running" | "done" | "failed";

export interface ToolCall {
    toolName: string;
    args: unknown; 
}

export interface ToolResult {
    ok: boolean;
    data?: unknown;
    error?: string; 
}

export interface AgentStep{
    id: string;
    status: StepStatus;
    thought?: string;
    action: "answer" | "tool";
    toolCall?: ToolCall;
    observation?: ToolResult;
    finalAnswer?: string;
    createdAt: string;
    finishedAt?: string;
}

export interface AgentRunState {
    runId: string;
    userId: string;
    status: "running" | "completed" | "failed";
    messages: AgentMessage[];
    steps: AgentStep[];
    maxSteps: number;
    createdAt: string;
    updatedAt: string;
    error?: string;
}

export interface AgentContext {
    userId: string;
    runId: string;
}

export interface ToolDefinition<TArgs = unknown, TResult = unknown> {
    name: string; 
    description: string;
    inputSchema: z.ZodType<TArgs>;
    execute: (args: TArgs, ctx: AgentContext) => Promise<TResult>;
    sideEffect?: boolean; 
}