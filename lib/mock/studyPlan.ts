import type { StudyBlock } from "@/lib/store/types";
import { at } from "./dates";

// date string is ISO. Use at(day, hour, minute) for ISO datetime, but we only care about yyyy-MM-dd for date grouping.
const d = (days: number) => at(days, 0, 0).slice(0, 10);

export const mockStudyBlocks: StudyBlock[] = [
  // Today
  { id: "s1", courseId: "cs344", title: "Project 3 — thread pool skeleton", date: d(0), start: "09:00", end: "11:00", type: "study", difficulty: "hard", priority: "urgent" },
  { id: "s2", courseId: "cs344", title: "CS 344 Lecture — Synchronization", date: d(0), start: "10:30", end: "11:45", type: "class", conflict: true },
  { id: "s3", courseId: "bio150", title: "Pre-lab 5 review", date: d(0), start: "13:00", end: "14:00", type: "study", difficulty: "easy", priority: "urgent" },
  { id: "s4", courseId: "hist210", title: "Read Hobsbawm Ch. 5", date: d(0), start: "15:30", end: "17:00", type: "study", difficulty: "medium", priority: "important" },
  { id: "s5", courseId: "cs344", title: "Office Hours — Prof. Vasquez", date: d(0), start: "16:00", end: "17:00", type: "office_hours" },

  // Tomorrow
  { id: "s6", courseId: "math251", title: "Pset 7 — Gram-Schmidt practice", date: d(1), start: "09:30", end: "12:00", type: "study", difficulty: "medium", priority: "important" },
  { id: "s7", courseId: "econ102", title: "ECON 102 Lecture", date: d(1), start: "09:00", end: "10:15", type: "class" },
  { id: "s8", courseId: "hist210", title: "Paper 3 outline", date: d(1), start: "14:00", end: "16:00", type: "study", difficulty: "medium", priority: "urgent" },
  { id: "s9", courseId: "hist210", title: "Reading Response 9 due", date: d(1), start: "23:59", end: "23:59", type: "deadline" },

  // +2 days
  { id: "s10", courseId: "cs344", title: "Project 3 — implement worker queue", date: d(2), start: "10:00", end: "13:00", type: "study", difficulty: "hard", priority: "urgent" },
  { id: "s11", courseId: "cs344", title: "Project 3 deadline", date: d(2), start: "23:59", end: "23:59", type: "deadline" },
  { id: "s12", courseId: "math251", title: "MATH 251 Lecture", date: d(2), start: "13:00", end: "14:15", type: "class" },

  // +3 days
  { id: "s13", courseId: "bio150", title: "Lab Report 5 writeup", date: d(3), start: "09:00", end: "12:00", type: "study", difficulty: "medium", priority: "urgent" },
  { id: "s14", courseId: "math251", title: "Pset 7 due", date: d(3), start: "17:00", end: "17:00", type: "deadline" },

  // +4 days
  { id: "s15", courseId: "econ102", title: "Pset 5 — monetary policy", date: d(4), start: "10:00", end: "13:00", type: "study", difficulty: "medium", priority: "important" },
  { id: "s16", courseId: "econ102", title: "Pset 5 due", date: d(4), start: "17:00", end: "17:00", type: "deadline" },

  // +5 days
  { id: "s17", courseId: "cs344", title: "Homework 6 — semaphores", date: d(5), start: "09:30", end: "12:00", type: "study", difficulty: "medium", priority: "important" },
  { id: "s18", courseId: "bio150", title: "Quiz 6 flashcards", date: d(5), start: "14:00", end: "15:00", type: "study", difficulty: "easy", priority: "optional" },

  // +6 days
  { id: "s19", courseId: "math251", title: "Quiz 5 review", date: d(6), start: "09:30", end: "11:00", type: "study", difficulty: "easy", priority: "optional" },
  { id: "s20", courseId: "hist210", title: "Paper 3 — draft body", date: d(6), start: "13:00", end: "17:00", type: "study", difficulty: "hard", priority: "urgent" },
];
