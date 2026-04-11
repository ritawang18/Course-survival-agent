import type { Exam } from "@/lib/store/types";
import { at } from "./dates";

export const mockExams: Exam[] = [
  {
    id: "e1",
    courseId: "econ102",
    title: "Midterm 2",
    date: at(9, 9, 0),
    location: "Evans 60",
    weight: 25,
    topics: ["IS-LM", "Monetary policy", "AD-AS", "Fiscal multipliers"],
  },
  {
    id: "e2",
    courseId: "math251",
    title: "Midterm 2",
    date: at(12, 13, 0),
    location: "Hearst 310",
    weight: 15,
    topics: ["Inner products", "Gram-Schmidt", "QR decomposition", "Diagonalization"],
  },
  {
    id: "e3",
    courseId: "cs344",
    title: "Final Exam",
    date: at(28, 9, 0),
    location: "Gates Auditorium",
    weight: 20,
    topics: ["Scheduling", "Synchronization", "Virtual memory", "File systems"],
  },
  {
    id: "e4",
    courseId: "bio150",
    title: "Final Exam",
    date: at(31, 11, 0),
    location: "Stanley 200",
    weight: 30,
    topics: ["Transcription", "Translation", "Regulation", "Recombinant DNA"],
  },
];
