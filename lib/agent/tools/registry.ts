// hold all tool definitions in one place 
// expose safe lookup by name 
// validate args before execution 

import {z} from "zod";
import type {AgentContext, ToolDefinition} from "@/lib/agent/types";
//import tools
import {
  listCourseTool,
  listAssignementsTool,
  getCourseGradeTool,
  getCourseSyllabusTool,
  getAssignmentTool,
  getCourseTool,
} from "./db-tools";

import {
  fetchProfessorRatingTool,
  fetchProfessorRedditPostsTool,
} from "./insights-tools";

import { listCalendarEventsTool } from "./calendar-tools";
import { generateStudyPlanTool } from "./planner-tools";
import { calculateGradeScenarioTool } from "./grade-tools";

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

// A registry mixes tools with different TArgs/TResult, so it's stored as
// ToolDefinition<any, any> — each tool's own inputSchema still validates
// its args at runtime in runToolByName below.
type AnyToolDefinition = ToolDefinition<any, any>;

const TOOL_LIST: AnyToolDefinition[] = [
  echoTool,
  listCourseTool,
  listAssignementsTool,
  getCourseGradeTool,
  getCourseSyllabusTool,
  getAssignmentTool,
  getCourseTool,
  fetchProfessorRatingTool,
  fetchProfessorRedditPostsTool,
  listCalendarEventsTool,
  generateStudyPlanTool,
  calculateGradeScenarioTool,
];

const TOOL_MAP = new Map<string, AnyToolDefinition>(
    TOOL_LIST.map((tool) => [tool.name, tool])
);

export function getTool(name: string): AnyToolDefinition | null {
    return TOOL_MAP.get(name) ?? null;
}

export function listTools(): AnyToolDefinition[] {
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