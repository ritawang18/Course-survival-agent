//insights-tools.ts wraps fetchRmp and fetchReddit for professor review

import { z } from "zod";
import { fetchRmp } from "@/lib/skills/fetchRmp";
import { fetchReddit } from "@/lib/skills/fetchReddit";
import type { ToolDefinition } from "@/lib/agent/types";

export const fetchProfessorRatingTool: ToolDefinition<
    { professorName: string; universityName: string },
    { rating: import("@/lib/skills/fetchRmp").RmpOutput | null }
> = {
    name: "fetch_professor_rating",
    description: "Look up a professor's RateMyProfessors score, difficulty, and recent student comments.", 
    inputSchema: z.object({
        professorName: z.string.min(2),
        universityNmae: z.string.min(2),
    }), 
    execute: async (args, _ctx) => {
        const rating = await fetchRmp({ 
            professorName: args.professorName,
            universityName: args.universityName, 
        }); 
        return {rating};
    }, 
    sideEffect: false, 
}; 

export const fetchProfessorRedditPostsTool: ToolDefinition<
    { professorName: string; universityName: string},
    { posts: import("@/lib/skills/fetchReddit").RedditOutput | null }
> = {
    name: "fetch_professor_reddit_posts",
    description: "Search for student discussion about a professor.",
    inputSchema: z.object({
        professorName: z.string().min(2),
        universityName: z.string().min(2),
    }),
    execute: async (args, _ctx) => {
        const posts = await fetchReddit({
            professorName: args.professorName,
            universityName: args.universityName,
        });
        return { posts }; 
    }, 
    sideEffect: false, 
}; 