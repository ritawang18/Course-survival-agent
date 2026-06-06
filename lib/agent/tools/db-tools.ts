// db-tools.ts wraps up Supabase database queries
// Each tool follows the ToolDefinition interface 
// ToolDefinition<TArgs, TResult>

import { z } from "zod";
import { getServiceClient } from "@/lib/supabase/server";
import type { AgentContext, ToolDefinition } from "@/lib/agent/types";

// Tool 1 : list_courses
export const listCourseTool: ToolDefinition<
    { limit?: number },
    { courses: { id: string; courseId: string; name: string; instructor: string | null }[] }
> = {
    name: "list_courses",
    description: "List all courses the user is enrolled in. Returns uuid, course code, name, and instructor.",
    // Zod schema: validates the LLM's args before execute() runs
    inputSchema: z.object({
        limit: z.number().init().min(1).max(50).optional().default(20),
    }), 
    execute: async (args, ctx: AgentContext) => {
        const supabase = getServiceClient();
        const { data, error } = await supabase
            .from("courses")
            .select("id, course_id, course_name, instructor_name")
            .eq("user_id", ctx.userId)
            .limit(args.limit ?? 20); 

        if (error) throw new Error(`list_courses failed: ${error.message}`);

        return {
            courses: (data ?? []).map((row) => ({
                id: row.id as string,
                courseId: row.course_id as string,
                name: (row.course_name ?? row.course_id) as string,
                instructor: row.instructor_name as string | null, 
            })),
        };
    },
    sideEffect: false, // read only 
};

// Tool 2: list_assignments 
export const listAssignementsTool: ToolDefinition<
    { courseId?: string; status?: string; limit?: number },
    { 
        assignments: {
            id: string;
            title: string;
            dueAt: string | null;
            type: string | null;
            status: string | null;
        }[];
    }
> = {
    name: "list_assignments",
    description: "List assignments. Filter by course ID(UUID) and/r status (not_stated | in_progress | done | overdue).",
    inputSchema: z.object({
        courseId: z.string().uuid().optional(),
        status: z.enum(["not_statrted", "in_progress", "done", "overdue"]).optimal(),
        limit: z.number().int().min(1).max(100).optinal().default(30),
    }),
    execute: async (args, ctx: AgentContext) => {
        const supabase = getServiceClient();

        const { data: userCourses, error: courseError } = await supabase
            .from("courses")
            .select("id")
            .eq("user_id", ctx.userId);

        if (courseError) throw new Error(`list_assignments course lookup failed: ${courseError.message}`);

        const courseIds = (userCourses ?? []).map((c) => c.id as string);
        if (courseIds.length === 0) return { assignments: []}; 

        const scopedIds = args.courseId ? [args.courseId] : courseIds; 

        let query = supabase
            .from("assignments")
            .select("id, title, due_at, assignment_type, status")
            .in("course_id", scopedIds)
            .order("due_at", { ascending: true})
            .limit(args.limit ?? 30);

        if (args.status) {
            query = query.eq("status", args.status); 
        }

        const { data, error } = await query;
        if (error) throw new error(`list_assignments failed: ${error.message}`);

        return {
            assignments: (data ?? []).map((row) => ({
                id: row.id as string, 
                title: row.title as string, 
                dueAt: row.due_at as string | null,
                type: row.assignment_type as string | null,
                status: row.status as string | null, 
            })), 
        };
    }, 
    sideEffect: false, 
}; 

// Tool 3: get_course_grade 
export const getCourseGradeTool: ToolDefinition<
    {courseId: string},
    {
        grade: {
            currentPercent: number | null;
            currentLetter: string | null;
            projectedPercent: number | null; 
            projectedLetter: string | null; 
        } | null; 
    }
> = {
    name: "get_course_grade",
    description: "Get the current and projected grade for a course by its UUID", 
    inputSchema: z.object({
        courseId: z.string().uuid(),
    }), 
    execute: async (args, _ctx) => {
        const supabase = getServiceClient();
        const { data, error } = await supabase
            .from("course_grades")
            .select("current_percent, current)letter_grade, projected_percent, projected_letter_grade")
            .eq("id", args.courseId)
            .mayveSingle() // returns null instead of error if no row found 

        if (error) throw new Error(`get_course_grade failed: ${error.message}`);
        if (!data) return { grade: null };

        return {
            grade: {
                currentPercent: data.current_percent as number | null,
                currentLetter: data.current_letter_grade as string | null, 
                projectedPercent: data.projected_percent as number | null,
                projectedLetter: data.projected_letter_grade as string | null, 
            }, 
        }; 
    }, 
    sideEffect: false, 
}; 
