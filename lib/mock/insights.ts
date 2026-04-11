import type { InstructorInsight } from "@/lib/store/types";

export const mockInsights: InstructorInsight[] = [
  {
    courseId: "cs344",
    professorName: "Prof. Elena Vasquez",
    universityName: "UC Berkeley",
    rmp: {
      score: 4.3,
      sentiment: "positive",
      summary:
        "Students overwhelmingly praise Prof. Vasquez's clear lectures and fair grading. Projects are demanding but feedback is detailed. Several note that office hours fill up quickly in the weeks before deadlines.",
      quotes: [
        "Projects are tough but you come out actually knowing OS internals.",
        "She responds to Piazza within an hour, honestly amazing.",
        "Go to office hours early, they fill up by the afternoon.",
      ],
      tags: ["Clear lecturer", "Tough projects", "Fair grader", "Responsive"],
    },
    reddit: {
      sentiment: "positive",
      summary:
        "Reddit discussion aligns with RMP. Most common advice: start Project 3 early, attend recitations for synchronization, and use the textbook as a companion rather than primary source.",
      quotes: [
        "Don't skip recitations, they literally walk through project hints.",
        "Textbook is dry but the lectures fill the gaps.",
      ],
      tags: ["Start early", "Attend recitation", "Textbook optional"],
    },
  },
  {
    courseId: "math251",
    professorName: "Prof. Rahul Mehta",
    universityName: "UC Berkeley",
    rmp: {
      score: 4.6,
      sentiment: "positive",
      summary:
        "Prof. Mehta is widely considered one of the best math instructors at the school. Proof-heavy style, beautiful lectures, very generous office hours. Exams are fair but dense — time management matters.",
      quotes: [
        "Genuinely made me love linear algebra.",
        "Exams are fair but long. Budget your time.",
      ],
      tags: ["Beautiful lectures", "Proof-focused", "Generous OH"],
    },
    reddit: {
      sentiment: "positive",
      summary:
        "Reddit threads recommend doing every problem in the textbook before midterms. Several posts mention he drops the lowest pset.",
      quotes: [
        "Best prof I've had. Do every textbook problem.",
        "He drops the lowest pset, don't sweat one bad week.",
      ],
      tags: ["Textbook problems", "Lowest dropped"],
    },
  },
  {
    courseId: "hist210",
    professorName: "Prof. Anna Holloway",
    universityName: "UC Berkeley",
    rmp: {
      score: 3.4,
      sentiment: "mixed",
      summary:
        "Prof. Holloway's lectures are engaging but grading on papers is described as inconsistent. Students recommend meeting with her before submitting major papers.",
      quotes: [
        "Lectures are amazing but paper grading felt arbitrary.",
        "Talk to her before submitting, it saves your grade.",
      ],
      tags: ["Engaging lectures", "Tough grader", "Meet before papers"],
    },
    reddit: {
      sentiment: "mixed",
      summary:
        "Mixed reviews on paper expectations. Consensus: be very specific with thesis statements. Attendance in discussion sections matters a lot.",
      quotes: [
        "Thesis specificity is everything in her class.",
        "Discussion attendance is real — she notices.",
      ],
      tags: ["Thesis first", "Discussion matters"],
    },
  },
  {
    courseId: "econ102",
    professorName: "Prof. David Chen",
    universityName: "UC Berkeley",
    rmp: {
      score: 3.1,
      sentiment: "mixed",
      summary:
        "Prof. Chen's macro course is content-heavy and fast-paced. Most students say lectures mirror the textbook closely. Problem sets are the main learning tool.",
      quotes: [
        "Fast pace, but problem sets carry the learning.",
        "Midterms are hard but reflective of the psets.",
      ],
      tags: ["Fast pace", "Psets matter", "Textbook aligned"],
    },
    reddit: {
      sentiment: "mixed",
      summary:
        "Reddit threads suggest forming study groups for problem sets and practicing past midterms. Some say Midterm 2 is significantly harder than Midterm 1.",
      quotes: [
        "Study groups saved me for the psets.",
        "Midterm 2 is a whole different beast — practice old exams.",
      ],
      tags: ["Study groups", "Practice exams", "Hard M2"],
    },
  },
  {
    courseId: "bio150",
    professorName: "Prof. Sofia Ramirez",
    universityName: "UC Berkeley",
    rmp: {
      score: 4.1,
      sentiment: "positive",
      summary:
        "Prof. Ramirez is organized and her labs are considered the best part of the course. Quizzes reward consistent studying rather than cramming.",
      quotes: [
        "Labs are the highlight — really well-designed.",
        "Keep up with quizzes weekly, don't cram.",
      ],
      tags: ["Organized", "Great labs", "Weekly review"],
    },
    reddit: {
      sentiment: "positive",
      summary:
        "Reddit suggests reviewing lab protocols before each session and using Anki for transcription/translation details.",
      quotes: [
        "Anki deck for this class saved my midterm grade.",
        "Pre-lab reading is non-negotiable.",
      ],
      tags: ["Anki", "Pre-lab reading"],
    },
  },
];
