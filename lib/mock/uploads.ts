import type { UploadArtifact } from "@/lib/store/types";
import { at } from "./dates";

export const mockUploads: UploadArtifact[] = [
  {
    id: "u1",
    fileName: "CS344-Syllabus-Spring.pdf",
    kind: "syllabus",
    status: "parsed",
    uploadedAt: at(-7, 10, 0),
    extracted: {
      deadlines: [
        { label: "Project 1 due", date: at(-20, 23, 59), confidence: 0.98 },
        { label: "Project 2 due", date: at(-6, 23, 59), confidence: 0.97 },
        { label: "Project 3 due", date: at(2, 23, 59), confidence: 0.96 },
        { label: "Homework 6 due", date: at(5, 23, 59), confidence: 0.92 },
      ],
      weights: [
        { name: "Homework", percent: 25, confidence: 0.99 },
        { name: "Projects", percent: 35, confidence: 0.99 },
        { name: "Midterm", percent: 15, confidence: 0.97 },
        { name: "Final", percent: 20, confidence: 0.97 },
        { name: "Participation", percent: 5, confidence: 0.88 },
      ],
      examDates: [
        { label: "Midterm", date: at(-14, 9, 0), confidence: 0.98 },
        { label: "Final Exam", date: at(28, 9, 0), confidence: 0.95 },
      ],
      attendancePolicy: {
        text: "Up to 4 absences allowed. Each additional absence deducts 2% from final grade.",
        confidence: 0.93,
      },
    },
  },
  {
    id: "u2",
    fileName: "HIST210-Syllabus.pdf",
    kind: "syllabus",
    status: "needs_review",
    uploadedAt: at(-5, 10, 0),
    extracted: {
      deadlines: [
        { label: "Paper 3", date: at(7, 23, 59), confidence: 0.71 },
        { label: "Final Paper", date: at(24, 23, 59), confidence: 0.66 },
      ],
      weights: [
        { name: "Reading Responses", percent: 20, confidence: 0.82 },
        { name: "Papers", percent: 40, confidence: 0.78 },
        { name: "Midterm", percent: 15, confidence: 0.85 },
        { name: "Final Paper", percent: 25, confidence: 0.74 },
      ],
      examDates: [
        { label: "Midterm", date: at(-10, 14, 0), confidence: 0.88 },
      ],
      attendancePolicy: {
        text: "Discussion sections required. Unclear penalty threshold — please verify.",
        confidence: 0.52,
      },
    },
  },
  {
    id: "u3",
    fileName: "Project3-Spec.pdf",
    kind: "assignment",
    status: "parsed",
    uploadedAt: at(-3, 10, 0),
    extracted: {
      deadlines: [
        { label: "Project 3 submission", date: at(2, 23, 59), confidence: 0.99 },
      ],
      weights: [],
      examDates: [],
      attendancePolicy: { text: "", confidence: 0 },
    },
  },
];
