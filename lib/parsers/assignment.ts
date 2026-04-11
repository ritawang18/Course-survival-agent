import { extractJSON } from "@/lib/claude";

export interface AssignmentQuestion {
  number: string;        // "Q1", "Problem 2a", etc.
  description: string;
  points: number | null;
  estimatedMinutes: number | null;
}

export interface ConceptDependency {
  concept: string;       // "Linked Lists", "Big-O Notation"
  why: string;           // brief reason this concept is needed
}

export interface AssignmentParseResult {
  title: string | null;
  totalPoints: number | null;
  dueDate: string | null;       // ISO if found
  estimatedHours: number;       // total estimated completion time
  difficulty: "easy" | "medium" | "hard";
  questions: AssignmentQuestion[];
  conceptDependencies: ConceptDependency[];
  implicitRequirements: string[]; // things not stated explicitly but implied
}

const SYSTEM_PROMPT = `You are an expert academic assignment analyzer. Extract structured information from assignment PDFs.

Return ONLY valid JSON. Schema:

{
  "title": "Homework 3: Trees and Recursion" | null,
  "totalPoints": 100 | null,
  "dueDate": "2026-03-15T23:59:00" | null,
  "estimatedHours": 4.5,
  "difficulty": "medium",
  "questions": [
    {
      "number": "Q1",
      "description": "Implement a binary search tree insert method",
      "points": 20,
      "estimatedMinutes": 45
    }
  ],
  "conceptDependencies": [
    {
      "concept": "Binary Trees",
      "why": "Required to implement insert and search methods"
    }
  ],
  "implicitRequirements": [
    "Code must pass provided test suite",
    "Time complexity should be O(log n) — implied by the problem constraints"
  ]
}

Rules for estimatedHours: base on question count and difficulty. Easy: ~30min/question, medium: ~60min, hard: ~90min+.
difficulty: judge by concepts required and question complexity.
implicitRequirements: look for grading rubric hints, style guides mentioned elsewhere, test harness references.
Return ONLY JSON.`;

export async function parseAssignment(text: string): Promise<AssignmentParseResult> {
  const truncated = text.slice(0, 10000);
  return extractJSON<AssignmentParseResult>(
    SYSTEM_PROMPT,
    `Analyze this assignment:\n\n${truncated}`
  );
}
