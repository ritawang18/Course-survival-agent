import type { AppData } from "@/lib/store/types";
import { mockCourses } from "./courses";
import { mockAssignments } from "./assignments";
import { mockExams } from "./exams";
import { mockStudyBlocks } from "./studyPlan";
import { mockUploads } from "./uploads";
import { mockInsights } from "./insights";

export const seedData: AppData = {
  courses: mockCourses,
  assignments: mockAssignments,
  exams: mockExams,
  studyBlocks: mockStudyBlocks,
  uploads: mockUploads,
  insights: mockInsights,
};
