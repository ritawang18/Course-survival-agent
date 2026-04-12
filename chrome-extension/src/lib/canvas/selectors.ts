export const canvasSelectors = {
  title: [
    "h1.title",
    ".assignment-title .title-content",
    ".page-title",
    ".ellipsible",
    "h1"
  ],
  courseName: [
    ".course-title",
    ".header-bar h1",
    "#breadcrumbs span:last-child",
    "nav[aria-label='breadcrumbs'] span:last-child"
  ],
  courseCode: [".course-code", ".header-bar .course-code"],
  dueText: [
    ".assignment-date-due",
    ".due_date_display",
    ".details .due",
    "[data-testid='due-date']"
  ],
  pointsText: [
    ".points_possible",
    ".assignment-points",
    "[data-testid='points-possible']"
  ],
  submissionTypeText: [
    ".submission_types",
    ".student-assignment-overview",
    ".assignment-details"
  ],
  syllabusBody: [".syllabus_body", "#syllabus", ".user_content"],
  folderName: [".ef-folder-content__header", ".current-folder", ".folders .current"],
  dashboardDeadlineItems: [
    "#right-side .todo-list li",
    "#right-side .coming_up li",
    "#right-side [class*='todo'] li",
    "#right-side [class*='coming'] li",
    "[data-testid='todo-list'] li",
    "[data-testid*='todo'] li",
    "[data-testid*='coming'] li",
    "[class*='Todo'] li",
    "[class*='todo'] li",
    "[class*='Coming'] li",
    "[class*='coming'] li",
    "aside li"
  ]
} as const;
