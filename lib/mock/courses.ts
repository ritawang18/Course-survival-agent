import type { Course } from "@/lib/store/types";

export const mockCourses: Course[] = [
  {
    id: "cs344",
    code: "CS 344",
    name: "Operating Systems",
    instructor: "Prof. Elena Vasquez",
    color: "indigo",
    credits: 4,
    schedule: "Mon / Wed · 10:30 – 11:45",
    room: "Gates 104",
    currentGrade: 88.4,
    gradingWeights: [
      { id: "hw", name: "Homework", weight: 25, earned: 91 },
      { id: "proj", name: "Projects", weight: 35, earned: 87 },
      { id: "mid", name: "Midterm", weight: 15, earned: 84 },
      { id: "final", name: "Final Exam", weight: 20 },
      { id: "part", name: "Participation", weight: 5, earned: 95 },
    ],
    attendancePolicy: {
      maxAbsences: 4,
      penaltyPerAbsence: 2,
      note: "After 4 absences, 2% is deducted per additional absence.",
    },
    missedClasses: 2,
    files: [
      { id: "f1", name: "CS344-Syllabus-Spring.pdf", uploadedAt: "2026-02-04", kind: "syllabus", pages: 8 },
      { id: "f2", name: "Lecture-09-Scheduling.pdf", uploadedAt: "2026-03-22", kind: "notes", pages: 22 },
    ],
    modules: [
      { id: "m1", title: "Processes & Threads", week: 1, status: "done", resources: 6 },
      { id: "m2", title: "Scheduling Algorithms", week: 2, status: "done", resources: 5 },
      { id: "m3", title: "Synchronization", week: 3, status: "in_progress", resources: 7 },
      { id: "m4", title: "Virtual Memory", week: 4, status: "upcoming", resources: 4 },
    ],
    aiSummary:
      "This week focuses on synchronization primitives. Prior assignments indicate you struggle slightly with semaphore ordering — plan 2 extra hours reviewing Lecture 11 before starting Project 3.",
    officeHourQuestions: [
      "Can you walk through the reader-writer lock edge case from Project 3?",
      "How should we handle priority inversion in the nested lock example?",
      "Is the exam scope limited to Chapters 5–8 of the textbook?",
    ],
    mockExamQuestions: [
      { q: "Explain the difference between preemptive and non-preemptive scheduling.", a: "Preemptive allows the OS to interrupt a running task; non-preemptive waits for voluntary yield." },
      { q: "What causes priority inversion and how is it resolved?", a: "A low-priority task holds a resource a high-priority task needs. Priority inheritance temporarily boosts the holder's priority." },
    ],
    dependencyNotes: [
      { from: "Project 3: Thread Pool", to: "Lecture 11: Monitors", why: "Uses monitor pattern covered only in lecture 11." },
      { from: "Homework 6", to: "Project 2", why: "Builds on the scheduler from Project 2." },
    ],
  },
  {
    id: "math251",
    code: "MATH 251",
    name: "Linear Algebra",
    instructor: "Prof. Rahul Mehta",
    color: "emerald",
    credits: 3,
    schedule: "Tue / Thu · 13:00 – 14:15",
    room: "Hearst 310",
    currentGrade: 92.1,
    gradingWeights: [
      { id: "hw", name: "Problem Sets", weight: 30, earned: 94 },
      { id: "quiz", name: "Quizzes", weight: 15, earned: 90 },
      { id: "mid", name: "Midterm 1", weight: 20, earned: 91 },
      { id: "mid2", name: "Midterm 2", weight: 15 },
      { id: "final", name: "Final Exam", weight: 20 },
    ],
    attendancePolicy: {
      maxAbsences: 3,
      penaltyPerAbsence: 1.5,
      note: "Attendance counted via in-class quizzes.",
    },
    missedClasses: 1,
    files: [
      { id: "f1", name: "MATH251-Syllabus.pdf", uploadedAt: "2026-02-01", kind: "syllabus", pages: 6 },
    ],
    modules: [
      { id: "m1", title: "Vector Spaces", week: 1, status: "done", resources: 4 },
      { id: "m2", title: "Linear Maps", week: 2, status: "done", resources: 5 },
      { id: "m3", title: "Eigenvalues", week: 3, status: "in_progress", resources: 6 },
      { id: "m4", title: "Diagonalization", week: 4, status: "upcoming", resources: 3 },
    ],
    aiSummary:
      "You consistently score highest on proof-based problems. Midterm 2 emphasizes computation — budget practice for Gram-Schmidt and QR.",
    officeHourQuestions: [
      "Can you review an example where eigenvectors are not linearly independent?",
      "What's the intuition behind projection matrices?",
    ],
    mockExamQuestions: [
      { q: "Define an eigenvalue of a linear map T: V → V.", a: "A scalar λ such that Tv = λv for some nonzero v ∈ V." },
    ],
    dependencyNotes: [
      { from: "Pset 7", to: "Lecture 12: Inner Products", why: "Requires orthogonality definitions." },
    ],
  },
  {
    id: "hist210",
    code: "HIST 210",
    name: "Modern European History",
    instructor: "Prof. Anna Holloway",
    color: "amber",
    credits: 3,
    schedule: "Mon / Wed · 14:00 – 15:15",
    room: "Dwinelle 145",
    currentGrade: 84.5,
    gradingWeights: [
      { id: "read", name: "Reading Responses", weight: 20, earned: 88 },
      { id: "papers", name: "Papers", weight: 40, earned: 82 },
      { id: "mid", name: "Midterm", weight: 15, earned: 85 },
      { id: "final", name: "Final Paper", weight: 25 },
    ],
    attendancePolicy: {
      maxAbsences: 3,
      penaltyPerAbsence: 3,
      note: "Discussion sections are mandatory. 3% penalty per unexcused absence beyond 3.",
    },
    missedClasses: 3,
    files: [
      { id: "f1", name: "HIST210-Syllabus.pdf", uploadedAt: "2026-01-30", kind: "syllabus", pages: 12 },
      { id: "f2", name: "Reading-List.pdf", uploadedAt: "2026-01-30", kind: "notes", pages: 4 },
    ],
    modules: [
      { id: "m1", title: "The French Revolution", week: 1, status: "done", resources: 8 },
      { id: "m2", title: "Industrial Britain", week: 2, status: "done", resources: 6 },
      { id: "m3", title: "Nationalism 1848", week: 3, status: "in_progress", resources: 5 },
      { id: "m4", title: "The Great War", week: 4, status: "upcoming", resources: 9 },
    ],
    aiSummary:
      "You're near the attendance threshold (3/3). Your papers consistently lose points on thesis specificity — consider booking a writing center session.",
    officeHourQuestions: [
      "Could you review my thesis for the final paper before I expand the argument?",
      "Which secondary sources do you recommend for the 1848 revolutions?",
    ],
    mockExamQuestions: [
      { q: "Discuss the economic causes of the 1848 revolutions.", a: "Food shortages, industrial unemployment, and middle-class frustration with restricted suffrage converged across European capitals." },
    ],
    dependencyNotes: [
      { from: "Final Paper", to: "Paper 2 feedback", why: "Builds on argumentation from Paper 2." },
    ],
  },
  {
    id: "econ102",
    code: "ECON 102",
    name: "Macroeconomics",
    instructor: "Prof. David Chen",
    color: "sky",
    credits: 4,
    schedule: "Tue / Thu · 09:00 – 10:15",
    room: "Evans 60",
    currentGrade: 79.2,
    gradingWeights: [
      { id: "ps", name: "Problem Sets", weight: 20, earned: 82 },
      { id: "mid1", name: "Midterm 1", weight: 25, earned: 74 },
      { id: "mid2", name: "Midterm 2", weight: 25 },
      { id: "final", name: "Final Exam", weight: 30 },
    ],
    attendancePolicy: {
      maxAbsences: 5,
      penaltyPerAbsence: 1,
      note: "Lectures recorded. Light attendance policy.",
    },
    missedClasses: 4,
    files: [
      { id: "f1", name: "ECON102-Syllabus-v2.pdf", uploadedAt: "2026-02-05", kind: "syllabus", pages: 10 },
    ],
    modules: [
      { id: "m1", title: "IS-LM Model", week: 1, status: "done", resources: 5 },
      { id: "m2", title: "Monetary Policy", week: 2, status: "in_progress", resources: 6 },
      { id: "m3", title: "Open Economy", week: 3, status: "upcoming", resources: 4 },
    ],
    aiSummary:
      "Midterm 1 score was below your target. Focus on practice problems for monetary policy transmission — that's the weakest area in your problem sets.",
    officeHourQuestions: [
      "Can you go through an example of AD-AS shifts under supply shocks?",
      "What's the intuition for liquidity traps in IS-LM?",
    ],
    mockExamQuestions: [
      { q: "Explain the monetary transmission mechanism.", a: "Central bank changes policy rate → affects market rates → influences investment and consumption → shifts aggregate demand → changes output and prices." },
    ],
    dependencyNotes: [
      { from: "Problem Set 5", to: "Lecture 8: IS-LM", why: "Directly applies the model." },
    ],
  },
  {
    id: "bio150",
    code: "BIO 150",
    name: "Molecular Biology",
    instructor: "Prof. Sofia Ramirez",
    color: "rose",
    credits: 4,
    schedule: "Mon / Wed / Fri · 11:00 – 11:50",
    room: "Stanley 200",
    currentGrade: 86.7,
    gradingWeights: [
      { id: "lab", name: "Lab Reports", weight: 30, earned: 89 },
      { id: "quiz", name: "Quizzes", weight: 15, earned: 84 },
      { id: "mid", name: "Midterm", weight: 25, earned: 86 },
      { id: "final", name: "Final Exam", weight: 30 },
    ],
    attendancePolicy: {
      maxAbsences: 2,
      penaltyPerAbsence: 4,
      note: "Lab attendance is strictly enforced. 4% penalty per missed lab.",
    },
    missedClasses: 0,
    files: [
      { id: "f1", name: "BIO150-Syllabus.pdf", uploadedAt: "2026-02-02", kind: "syllabus", pages: 9 },
      { id: "f2", name: "Lab-Manual.pdf", uploadedAt: "2026-02-02", kind: "notes", pages: 40 },
    ],
    modules: [
      { id: "m1", title: "DNA Replication", week: 1, status: "done", resources: 7 },
      { id: "m2", title: "Transcription", week: 2, status: "done", resources: 8 },
      { id: "m3", title: "Translation & Regulation", week: 3, status: "in_progress", resources: 6 },
      { id: "m4", title: "Recombinant DNA", week: 4, status: "upcoming", resources: 5 },
    ],
    aiSummary:
      "Strong lab performance. The midterm emphasized regulation — schedule a review of operon models before the final.",
    officeHourQuestions: [
      "Can you clarify the difference between lac and trp operon regulation?",
      "How are CRISPR-Cas9 specificity issues addressed in research?",
    ],
    mockExamQuestions: [
      { q: "Describe the role of sigma factors in transcription initiation.", a: "Sigma factors bind RNA polymerase to enable promoter recognition, then dissociate after transcription begins." },
    ],
    dependencyNotes: [
      { from: "Lab Report 5", to: "Lab 4 results", why: "Uses the same cell extract." },
    ],
  },
];
