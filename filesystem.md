# Filesystem

Annotated tree of the Course Tracker prototype. Paths are relative to the project root.

## Top level

```
.
├── .env                    # Supabase keys (NEXT_PUBLIC_SUPABASE_URL, _ANON_KEY, SERVICE_ROLE_KEY)
├── .eslintrc.json          # extends next/core-web-vitals
├── .gitignore
├── README.md               # project overview, setup, scripts
├── filesystem.md           # this file
├── next-env.d.ts           # Next.js TS ambient types (auto-generated)
├── next.config.mjs         # experimental.webpackBuildWorker = false (Node 22 / Windows fix)
├── package.json            # deps: next 14, react 18, tailwind 3, supabase-js, lucide, date-fns
├── postcss.config.mjs      # tailwind + autoprefixer
├── tailwind.config.ts      # design tokens (colors, fonts, shadows, animations)
├── tsconfig.json           # strict TS, @/* path alias
├── app/                    # Next.js App Router
├── components/             # UI + feature components
└── lib/                    # Store, mock data, utils, supabase client
```

## `app/` — routes and layouts

Next.js App Router. Two route groups: `(auth)` for sign-in / sign-up, `(app)` for the authenticated shell.

```
app/
├── globals.css                      # Tailwind base, CSS vars for light/dark, utilities
├── layout.tsx                       # Root layout: fonts, <Toaster>, AppStoreProvider
├── page.tsx                         # / — session check, redirects to /dashboard or /login
│
├── (auth)/                          # Unauthenticated routes
│   ├── layout.tsx                   # Centered card shell, bounces signed-in users to /dashboard
│   ├── login/
│   │   └── page.tsx                 # Email+password and Google OAuth login
│   └── signup/
│       └── page.tsx                 # Signup with live password strength meter
│
└── (app)/                           # Authenticated shell
    ├── layout.tsx                   # Sidebar + Topbar, auth gate + onAuthStateChange
    ├── dashboard/page.tsx           # Stat tiles, today's plan, weekly workload, deadlines
    ├── courses/
    │   ├── page.tsx                 # Grid of CourseCards
    │   └── [courseId]/page.tsx      # Course detail with tabs (Overview/Assignments/Exams/Modules/Files/Insights)
    ├── planner/page.tsx             # Week + day study planner with Replan button
    ├── calendar/page.tsx            # Month/week calendar + free-slot sidebar + fake Google sync
    ├── assignments/page.tsx         # Filterable assignment table + row drawer
    ├── upload/page.tsx              # UploadZone + parsing result cards
    ├── grades/page.tsx              # Grade calculator with scenario slider
    └── insights/page.tsx            # RMP / Reddit tabs, sentiment, quotes
```

## `components/` — UI primitives and feature components

Flat, feature-scoped folders. `ui/` holds shadcn-style primitives; everything else is feature code.

```
components/
├── attendance/
│   └── AttendanceWidget.tsx         # "Did you go today?" panel; reused on dashboard + course detail
│
├── auth/
│   ├── AuthCard.tsx                 # Shared card shell (title, description, footer) for login/signup
│   └── PasswordField.tsx            # Password input with Eye/EyeOff toggle, forwardRef
│
├── common/
│   ├── CourseColor.ts               # Color map (6 variants: indigo/emerald/amber/rose/sky/violet)
│   ├── EmptyState.tsx               # Icon + title + hint + CTA
│   ├── GradeRing.tsx                # SVG circular progress for grades
│   └── PriorityBadge.tsx            # Urgent/Important/Optional chip
│
├── courses/
│   ├── AIInsightsCard.tsx           # AI-summarized risk + suggestions
│   ├── CourseCard.tsx               # Grid card: color stripe, grade ring, next deadline/exam
│   ├── CourseHeader.tsx             # Course detail hero: title, instructor, schedule, grade ring
│   ├── DependencyGraphCard.tsx      # "Assignment X → requires Lecture Y" list
│   ├── FilesCard.tsx                # Uploaded files for a course
│   ├── GradingWeightsCard.tsx       # Category breakdown with earned/weight
│   ├── LectureModulesList.tsx       # Week-by-week module outline
│   ├── MockExamCard.tsx             # Generated practice questions with Reveal answer
│   └── OfficeHourQuestionsCard.tsx  # Suggested OH questions with copy button
│
├── dashboard/
│   ├── GradeSnapshotCard.tsx        # Current GPA + per-course grade bars
│   ├── QuickActionsBar.tsx          # Upload / Add assignment / Replan buttons
│   ├── StatTile.tsx                 # KPI tile (icon, label, value, delta)
│   ├── TodayPlanPanel.tsx           # Today's tasks with difficulty chips + checkboxes
│   ├── UpcomingExamsCard.tsx        # Next 3 exams with days-until
│   └── WeeklyWorkloadChart.tsx      # Inline SVG stacked bars by day
│
├── deadlines/
│   └── DeadlineList.tsx             # Color-coded list of next-7-day deadlines
│
├── layout/
│   ├── PageHeader.tsx               # Page title + description + actions slot
│   ├── Sidebar.tsx                  # Desktop nav + logo + user card; 8 nav items
│   └── Topbar.tsx                   # ⌘K search, notifications, avatar, command palette
│
├── ui/                              # Generic primitives (shadcn-style)
│   ├── Badge.tsx
│   ├── Button.tsx                   # Variants: default/secondary/ghost/danger; sizes sm/md/lg; loading state
│   ├── Card.tsx
│   ├── Drawer.tsx                   # Right-side Sheet used for assignment detail
│   ├── Input.tsx
│   ├── Modal.tsx                    # Centered dialog (command palette, etc.)
│   ├── Progress.tsx
│   ├── Tabs.tsx
│   └── ToastHost.tsx                # Sonner-style toaster driven by AppStoreProvider
│
└── upload/
    ├── ConfidenceBadge.tsx          # High / Medium / Needs review
    ├── ParsingResultCard.tsx        # Structured extraction preview
    └── UploadZone.tsx               # Dashed drop area, simulated progress
```

## `lib/` — store, mocks, utils, Supabase

```
lib/
├── mock/                            # Seed data (all dates anchored to new Date() at import)
│   ├── assignments.ts               # 15 assignments across statuses and priorities
│   ├── courses.ts                   # 5 courses: CS / Math / History / Econ / Bio
│   ├── dates.ts                     # at(days, hours, minutes) helper → ISO string
│   ├── exams.ts                     # 3 upcoming exams
│   ├── index.ts                     # Aggregated seed export for the store
│   ├── insights.ts                  # RMP/Reddit summaries per course
│   ├── studyPlan.ts                 # ~20 study blocks across a week
│   └── uploads.ts                   # 2 parsed, 1 needs-review syllabus
│
├── store/
│   ├── AppStoreProvider.tsx         # Context + useReducer-ish store, actions, toast system,
│   │                                # useCourse(id) hook. Swap to backend = replace action bodies.
│   └── types.ts                     # Course, Assignment, Exam, StudyBlock, UploadArtifact, etc.
│
├── supabase/
│   └── client.ts                    # Singleton browser client from @supabase/supabase-js
│
└── utils/
    ├── cn.ts                        # clsx + tailwind-merge wrapper
    ├── date.ts                      # relativeDue, weekDays, shortDay, monthLabel, isoDay
    ├── fakeAsync.ts                 # simulateDelay(min, max) for replan/sync/upload
    └── grade.ts                     # weightedGrade, projectedFinal, letter, gpa
```

## How the pieces talk

- **`app/layout.tsx`** wraps the whole app in `AppStoreProvider` and mounts `<ToastHost />`.
- **`AppStoreProvider`** seeds state from `lib/mock/index.ts` and exposes actions like `markAttendance`, `setAssignmentStatus`, `updateGradeScore`, `replanStudy`, `simulateUpload`, `syncGoogleCalendar`, plus a toast system (`pushToast` / `dismissToast`).
- **Pages** read from the store via `useAppStore()` / `useCourse(id)` and call actions directly. No prop drilling past one level.
- **`(app)/layout.tsx`** gates all authenticated routes by calling `supabase.auth.getSession()` and subscribing to `onAuthStateChange`.
- **`(auth)/layout.tsx`** does the reverse — bounces signed-in users out of `/login` and `/signup`.
- **Fake async** flows through `lib/utils/fakeAsync.ts` so loading states feel real and can be tuned in one place.

## Route map

| Path                       | Purpose                                |
| -------------------------- | -------------------------------------- |
| `/`                        | Session check → redirect               |
| `/login`                   | Email+password / Google login          |
| `/signup`                  | Create account                         |
| `/dashboard`               | Overview, stats, today's plan          |
| `/courses`                 | Course grid                            |
| `/courses/[courseId]`      | Course detail with tabs                |
| `/planner`                 | Week + day study planner               |
| `/calendar`                | Month/week calendar + free slots       |
| `/assignments`             | Filterable assignment table            |
| `/upload`                  | Upload + parse syllabus                |
| `/grades`                  | Grade calculator + projections         |
| `/insights`                | Instructor sentiment (RMP / Reddit)    |

14 routes total (including the root and two auth pages).
