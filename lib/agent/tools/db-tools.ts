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
        limit: z.number().min(1).max(50).optional().default(20),
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
            courseId: string;
            courseName: string;
            title: string;
            dueAt: string | null;
            type: string | null;
            status: string | null;
            estimatedHours: number | null;
            difficulty: string | null;
            topic: string | null;
            weight: number | null;
        }[];
    }
> = {
    name: "list_assignments",
    description:
        "List assignments with enough detail to prioritize between them: due date, type, status, estimated hours, difficulty, topic, and grade weight. Filter by course ID(UUID) and/or status (not_started | in_progress | done | overdue).",
    inputSchema: z.object({
        courseId: z.string().uuid().optional(),
        status: z.enum(["not_started", "in_progress", "done", "overdue"]).optional(),
        limit: z.number().int().min(1).max(100).optional().default(30),
    }),
    execute: async (args, ctx: AgentContext) => {
        const supabase = getServiceClient();

        const { data: userCourses, error: courseError } = await supabase
            .from("courses")
            .select("id, course_name, course_id")
            .eq("user_id", ctx.userId);

        if (courseError) throw new Error(`list_assignments course lookup failed: ${courseError.message}`);

        const courseNameById = new Map(
            (userCourses ?? []).map((c) => [c.id as string, (c.course_name ?? c.course_id) as string])
        );
        const courseIds = [...courseNameById.keys()];
        if (courseIds.length === 0) return { assignments: [] };

        const scopedIds = args.courseId ? [args.courseId] : courseIds;

        let query = supabase
            .from("assignments")
            .select(
                "id, course_id, title, due_at, assignment_type, status, estimated_hours, difficulty, topic, weight"
            )
            .in("course_id", scopedIds)
            .order("due_at", { ascending: true })
            .limit(args.limit ?? 30);

        if (args.status) {
            query = query.eq("status", args.status);
        }

        const { data, error } = await query;
        if (error) throw new Error(`list_assignments failed: ${error.message}`);

        return {
            assignments: (data ?? []).map((row) => ({
                id: row.id as string,
                courseId: row.course_id as string,
                courseName: courseNameById.get(row.course_id as string) ?? "Unknown course",
                title: row.title as string,
                dueAt: row.due_at as string | null,
                type: row.assignment_type as string | null,
                status: row.status as string | null,
                estimatedHours: row.estimated_hours as number | null,
                difficulty: row.difficulty as string | null,
                topic: row.topic as string | null,
                weight: row.weight as number | null,
            })),
        };
    },
    sideEffect: false,
};

// Tool 5: get_assignment
export const getAssignmentTool: ToolDefinition<
    { assignmentId: string },
    {
        assignment: {
            id: string;
            courseId: string;
            courseName: string;
            title: string;
            description: string | null;
            dueAt: string | null;
            type: string | null;
            status: string | null;
            estimatedHours: number | null;
            difficulty: string | null;
            topic: string | null;
            weight: number | null;
            pointsPossible: number | null;
            scoreReceived: number | null;
            dependencies: string[];
        } | null;
    }
> = {
    name: "get_assignment",
    description:
        "Get full detail for a single assignment by its UUID: description, points, score received, and concept dependencies, in addition to the fields list_assignments returns.",
    inputSchema: z.object({
        assignmentId: z.string().uuid(),
    }),
    execute: async (args, ctx: AgentContext) => {
        const supabase = getServiceClient();

        const { data, error } = await supabase
            .from("assignments")
            .select(
                "id, course_id, title, description, due_at, assignment_type, status, estimated_hours, difficulty, topic, weight, points_possible, score_received, dependencies"
            )
            .eq("id", args.assignmentId)
            .maybeSingle();

        if (error) throw new Error(`get_assignment failed: ${error.message}`);
        if (!data) return { assignment: null };

        // Confirm the assignment's course belongs to this user before returning it.
        const { data: course, error: courseError } = await supabase
            .from("courses")
            .select("course_name, course_id")
            .eq("id", data.course_id as string)
            .eq("user_id", ctx.userId)
            .maybeSingle();

        if (courseError) throw new Error(`get_assignment course lookup failed: ${courseError.message}`);
        if (!course) return { assignment: null };

        return {
            assignment: {
                id: data.id as string,
                courseId: data.course_id as string,
                courseName: (course.course_name ?? course.course_id) as string,
                title: data.title as string,
                description: data.description as string | null,
                dueAt: data.due_at as string | null,
                type: data.assignment_type as string | null,
                status: data.status as string | null,
                estimatedHours: data.estimated_hours as number | null,
                difficulty: data.difficulty as string | null,
                topic: data.topic as string | null,
                weight: data.weight as number | null,
                pointsPossible: data.points_possible as number | null,
                scoreReceived: data.score_received as number | null,
                dependencies: (data.dependencies as string[] | null) ?? [],
            },
        };
    },
    sideEffect: false,
};

// Tool 6: get_course
export const getCourseTool: ToolDefinition<
    { courseId: string },
    {
        course: {
            id: string;
            courseId: string;
            name: string;
            instructor: string | null;
            term: string | null;
            schedule: string | null;
            credits: number | null;
            location: string | null;
            currentGradePercent: number | null;
            attendanceAttendedCount: number;
            attendanceMissedCount: number;
            attendanceAllowedMisses: number;
        } | null;
    }
> = {
    name: "get_course",
    description:
        "Get full detail for a single course by its UUID: name, instructor, term, schedule, credits, location, and attendance counts.",
    inputSchema: z.object({
        courseId: z.string().uuid(),
    }),
    execute: async (args, ctx: AgentContext) => {
        const supabase = getServiceClient();

        const { data, error } = await supabase
            .from("courses")
            .select(
                "id, course_id, course_name, instructor_name, term, schedule, credits, location, current_grade_percent, attendance_attended_count, attendance_missed_count, attendance_allowed_misses"
            )
            .eq("id", args.courseId)
            .eq("user_id", ctx.userId)
            .maybeSingle();

        if (error) throw new Error(`get_course failed: ${error.message}`);
        if (!data) return { course: null };

        return {
            course: {
                id: data.id as string,
                courseId: data.course_id as string,
                name: (data.course_name ?? data.course_id) as string,
                instructor: data.instructor_name as string | null,
                term: data.term as string | null,
                schedule: data.schedule as string | null,
                credits: data.credits as number | null,
                location: data.location as string | null,
                currentGradePercent: data.current_grade_percent as number | null,
                attendanceAttendedCount: (data.attendance_attended_count as number | null) ?? 0,
                attendanceMissedCount: (data.attendance_missed_count as number | null) ?? 0,
                attendanceAllowedMisses: (data.attendance_allowed_misses as number | null) ?? 0,
            },
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
            .select("current_percent, current_letter_grade, projected_percent, projected_letter_grade")
            .eq("id", args.courseId)
            .maybeSingle(); // returns null instead of error if no row found

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

// Tool 4: get_course_syllabus
export const getCourseSyllabusTool: ToolDefinition<
    { courseId: string },
    {
        syllabus: {
            cutOff: unknown;
            breakDown: unknown;
            examDates: unknown;
            projectDate: unknown;
            gradingPolicy: string | null;
            topicOutline: unknown;
        } | null;
    }
> = {
    name: "get_course_syllabus",
    description:
        "Get the parsed syllabus for a course by its UUID: grade cutoffs, weight breakdown, exam dates, project dates, grading policy, and topic outline.",
    inputSchema: z.object({
        courseId: z.string().uuid(),
    }),
    execute: async (args, ctx: AgentContext) => {
        const supabase = getServiceClient();

        // syllabus rows key off the text course_id, not the courses.id uuid,
        // so first resolve the uuid to its text code (and confirm it's this user's course).
        const { data: course, error: courseError } = await supabase
            .from("courses")
            .select("course_id")
            .eq("id", args.courseId)
            .eq("user_id", ctx.userId)
            .maybeSingle();

        if (courseError) throw new Error(`get_course_syllabus course lookup failed: ${courseError.message}`);
        if (!course) return { syllabus: null };

        const { data, error } = await supabase
            .from("syllabus")
            .select("cut_off, break_down, exam_dates, project_date, grading_policy, topic_outline")
            .eq("course_id", course.course_id as string)
            .maybeSingle();

        if (error) throw new Error(`get_course_syllabus failed: ${error.message}`);
        if (!data) return { syllabus: null };

        return {
            syllabus: {
                cutOff: data.cut_off,
                breakDown: data.break_down,
                examDates: data.exam_dates,
                projectDate: data.project_date,
                gradingPolicy: data.grading_policy as string | null,
                topicOutline: data.topic_outline,
            },
        };
    },
    sideEffect: false,
};
