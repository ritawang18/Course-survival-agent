# Course Survival Agent — CLAUDE.md

## What this project is

A student-support AI agent for university coursework. It has three surfaces:

1. **Chrome Extension** — sidebar that appears while the user browses Canvas. Has an "Ask agent" input box for free-form questions.
2. **Next.js Web App** — manages courses, grades, assignments, study plans, and syllabuses.
3. **Backend API** — Next.js App Router API routes that power both surfaces.

The core transformation in progress: converting isolated one-shot LLM API calls into a proper **ReAct agent runtime** — a loop where the LLM thinks, calls tools, observes results, and repeats until it can answer.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router), React 18 |
| Language | TypeScript 5 |
| Database | Supabase (PostgreSQL + Auth) |
| AI providers | OpenAI, Anthropic, Gemini (user-configurable via settings) |
| Schema validation | Zod v4 |
| Styling | Tailwind CSS |
| Calendar | Google Calendar API (googleapis) |
| PDF parsing | pdf-parse |
| Chrome Extension | Vite + React (separate build in `chrome-extension/`) |

---

## Commands

```bash
npm run dev          # start Next.js dev server
npm run build        # production build
npm run typecheck    # tsc --noEmit (no emitted files, just type errors)
npm run lint         # eslint
```

Always run `npm run typecheck` after modifying agent files — the generic types in `ToolDefinition<TArgs, TResult>` catch shape mismatches at compile time.

---

## Directory Structure

```
Course-survival-agent/
├── app/
│   ├── (app)/                    # Authenticated UI pages
│   │   ├── dashboard/            # Overview: grades, deadlines, weekly pulse
│   │   ├── courses/[courseId]/   # Per-course: syllabus, grades, pulse, planner
│   │   ├── assignments/          # All assignments across courses
│   │   ├── grades/               # Grade calculator
│   │   ├── planner/              # Study plan view
│   │   ├── insights/             # Professor RMP/Reddit insights
│   │   ├── calendar/             # Google Calendar integration
│   │   ├── upload/               # Syllabus PDF upload
│   │   └── settings/             # LLM provider/model/API key config
│   │
│   ├── (auth)/                   # Login / signup pages
│   │
│   └── api/
│       ├── agent/
│       │   ├── runs/route.ts           # POST — start a new agent run
│       │   ├── runs/[id]/route.ts      # GET  — poll run status + trace
│       │   └── runs/[id]/input/route.ts # POST — human-in-the-loop reply
│       │
│       ├── extension/
│       │   ├── ask-agent/route.ts      # Legacy: one-shot Q&A from sidepanel
│       │   ├── context-summary/route.ts # Summarise the current Canvas page
│       │   └── session-state/route.ts  # Auth + token status for sidepanel
│       │
│       ├── upload/route.ts             # Accept syllabus PDF, parse, store
│       ├── planner/generate/route.ts   # Generate study plan (migrate → tool)
│       ├── weekly-course-pulse/        # Weekly summary (migrate → tool)
│       ├── professor-insights/route.ts # RMP + Reddit (migrate → tool)
│       ├── grades/                     # Grade calculation routes
│       └── calendar/                   # Google Calendar OAuth + events
│
├── lib/
│   ├── agent/                    # ← AGENT RUNTIME (core of the migration)
│   │   │
│   │   ├── types.ts              # Shared types: AgentRunState, AgentStep,
│   │   │                         #   ToolDefinition<TArgs,TResult>, AgentContext
│   │   │
│   │   ├── brain/                # LLM reasoning layer
│   │   │   ├── model-router.ts   # Thin wrapper over lib/ai/client.resolveAIConfig
│   │   │   ├── prompts.ts        # buildSystemPrompt(tools[]) → string
│   │   │   └── output-parsers.ts # parseLLMOutput(rawText, stepId) → AgentStep
│   │   │
│   │   ├── planner/              # ReAct loop
│   │   │   ├── react-planner.ts  # runReActLoop(state, aiConfig) — main loop
│   │   │   ├── plan-execute.ts   # Plan-and-Execute coordinator (future)
│   │   │   └── step-policy.ts    # shouldStop(state, policy) — step budget
│   │   │
│   │   ├── memory/               # State storage
│   │   │   ├── short-term.ts     # In-process Map: saveRun / getRun / deleteRun
│   │   │   ├── long-term.ts      # Supabase persistent memory (future)
│   │   │   ├── retrieval.ts      # Context ranking / fetch (future)
│   │   │   └── schemas.ts        # Zod schemas for memory records
│   │   │
│   │   ├── tools/                # Tool definitions — each wraps an existing skill
│   │   │   ├── registry.ts       # TOOL_LIST, getTool(), listTools(), runToolByName()
│   │   │   ├── db-tools.ts       # list_courses, list_assignments, get_course_grade
│   │   │   ├── calendar-tools.ts # list_calendar_events
│   │   │   ├── pulse-tools.ts    # generate_weekly_pulse
│   │   │   ├── planner-tools.ts  # generate_study_plan
│   │   │   ├── insights-tools.ts # fetch_professor_rating, fetch_professor_reddit_posts
│   │   │   └── extension-tools.ts # summarize_canvas_page
│   │   │
│   │   ├── perception/           # Input normalization (future)
│   │   │   ├── syllabus-parser.ts   # re-exports lib/parsers/syllabus.ts
│   │   │   ├── assignment-parser.ts # re-exports lib/parsers/assignment.ts
│   │   │   ├── canvas-context.ts    # DOM/page context normalization
│   │   │   └── multimodal.ts        # Image understanding (future)
│   │   │
│   │   ├── skills/               # Composite tool chains (future)
│   │   │   ├── build-weekly-plan.ts
│   │   │   ├── analyze-assignment-risk.ts
│   │   │   └── summarize-course-status.ts
│   │   │
│   │   ├── runtime.ts            # think-act-observe loop (future: replaces react-planner)
│   │   ├── executor.ts           # Tool execution engine with retries (future)
│   │   ├── guardrails.ts         # Auth, permissions, confirmation gates (future)
│   │   └── telemetry.ts          # Token + tool usage traces (future)
│   │
│   ├── ai/
│   │   ├── client.ts             # generateTextWithAI, generateObjectWithAI,
│   │   │                         #   resolveAIConfig(userId), requireAIConfig(userId)
│   │   └── models.ts             # AIProvider type, DEFAULT_MODEL_BY_PROVIDER
│   │
│   ├── db/                       # Supabase data access functions
│   │   ├── courses.ts            # upsertSyllabus, upsertCourse
│   │   ├── assignments.ts        # insertSyllabusAssignments, insertAssignment
│   │   ├── grades.ts             # upsertCourseGrade
│   │   ├── study_plan.ts         # upsertStudyPlan
│   │   ├── study_plan_blocks.ts  # replaceStudyPlanBlocks
│   │   ├── weekly_course_pulse.ts
│   │   ├── user_llm_settings.ts  # getUserLlmSettings (provider/model/key)
│   │   └── user_integration_tokens.ts # Canvas PAT, Google OAuth tokens
│   │
│   ├── skills/                   # Legacy standalone skill functions
│   │   ├── generateWeeklyCoursePulse.ts  # Full weekly pulse pipeline
│   │   ├── fetchRmp.ts           # Rate My Professor GraphQL scraper
│   │   ├── fetchReddit.ts        # Reddit search for professor discussions
│   │   ├── grade-runner.ts       # Grade calculation engine
│   │   ├── grade-policy-compiler.ts
│   │   └── _shared/timeout.ts   # withTimeout() helper
│   │
│   ├── parsers/
│   │   ├── syllabus.ts           # PDF → SyllabusParseResult (LLM-powered)
│   │   └── assignment.ts         # PDF → AssignmentParseResult (LLM-powered)
│   │
│   ├── extension/
│   │   ├── context.ts            # buildAskAgentContext() — enriches Canvas page context
│   │   ├── request-schemas.ts    # Zod schemas for extension API requests
│   │   └── web-auth-bridge.ts
│   │
│   ├── schemas/                  # Zod schemas for LLM output shapes
│   │   ├── weekly-course-pulse.ts
│   │   ├── insight.ts
│   │   └── dashboard-weekly-overview.ts
│   │
│   ├── scheduler.ts              # generateStudyPlan() — LLM-powered planner
│   ├── claude.ts                 # extractJSON() convenience wrapper
│   ├── google-calendar.ts        # OAuth client, token management, event CRUD
│   ├── calendar-auth.ts          # Calendar OAuth flow helpers
│   └── supabase/
│       ├── client.ts             # Browser Supabase client
│       └── server.ts             # Server Supabase client + getUserFromRequest()
│
├── components/                   # React UI components (Tailwind)
├── chrome-extension/             # Separate Vite build
│   └── src/
│       ├── sidepanel/App.tsx     # Main sidepanel UI — "Ask agent" lives here
│       ├── background/           # Service worker
│       ├── content/              # DOM observer + Canvas context scraper
│       └── lib/                  # API client, Canvas parser, storage
│

```

---

## Database Schema (key tables)

| Table | Primary Key | Purpose |
|---|---|---|
| `syllabus` | `course_id` (text) | Parsed syllabus data: weights, exam dates, topic outline |
| `courses` | `uuid` | User's courses. FK: `(user_id, course_id)` unique pair |
| `assignments` | `uuid` | Assignments per course. FK: `course_id → courses.id` |
| `course_grades` | `uuid` (= courses.id) | Current + projected grades, 1-to-1 with courses |
| `study_plan` | `uuid` (= courses.id) | Top-level study plan per course |
| `study_plan_blocks` | `uuid` | Individual scheduled study blocks |
| `attendance_records` | `uuid` | Per-class attendance entries |
| `user_llm_settings` | — | User's chosen AI provider/model/API key |
| `user_integration_tokens` | — | Canvas PAT, Google OAuth tokens |
| `course_canvas_settings` | — | Per-course Canvas base URL + course ID mapping |
| `weekly_course_pulse` | — | Cached weekly pulse outputs |

**Important FK order:** `syllabus` must be inserted before `courses` (FK constraint). Always call `upsertSyllabus()` before `upsertCourse()`.

---

## Agent Architecture

### How the ReAct loop works

```
User question (from Chrome sidepanel or web app chat)
       ↓
POST /api/agent/runs
       ↓
runReActLoop(state, aiConfig)
       │
       ├── [Turn 1] buildConversationPrompt(state)
       │           → call LLM with system prompt + tool list
       │           → parseLLMOutput() → { thought, action: "tool", toolName, toolArgs }
       │           → runToolByName(toolName, toolArgs, ctx)
       │           → append observation to state.messages
       │
       ├── [Turn 2] LLM sees tool result, thinks again...
       │
       └── [Turn N] LLM output: { action: "answer", finalAnswer: "..." }
                   → state.status = "completed"

GET /api/agent/runs/:id   → poll for result
```

### Tool definition pattern

Every tool in `lib/agent/tools/` follows this shape:

```typescript
export const myTool: ToolDefinition<
  { param: string },          // TArgs — what the LLM passes
  { result: SomeType }        // TResult — what execute() returns
> = {
  name: "my_tool",            // LLM uses this name to call the tool
  description: "...",         // LLM reads this to decide when to call it
  inputSchema: z.object({     // Zod validates LLM args at runtime
    param: z.string().min(1),
  }),
  execute: async (args, ctx) => {   // ctx has userId and runId
    // do the work
    return { result: ... };
  },
  sideEffect: false,          // true if the tool writes to DB or external APIs
};
```

Register every new tool in `lib/agent/tools/registry.ts` → `TOOL_LIST` array.

**Note for `brain/prompts.ts` (not yet built):** `listTools()` exposes each tool's `name` and `description` directly, but `inputSchema` is a Zod schema, not JSON — it can't be dropped into the prompt text as-is. Convert it to a JSON-schema-ish arg description (e.g. via `zod-to-json-schema`) so the LLM knows each tool's expected argument shape well enough to produce valid `toolArgs` JSON.

### LLM output format

The system prompt instructs the LLM to always respond with one of:

```json
// When calling a tool:
{ "thought": "...", "action": "tool", "toolName": "list_courses", "toolArgs": {} }

// When ready to answer:
{ "thought": "...", "action": "answer", "finalAnswer": "Full response to user." }
```

`output-parsers.ts` parses this and handles malformed JSON gracefully.

---

## AI Provider Configuration

Users configure their LLM in `app/(app)/settings`. The setting is stored in `user_llm_settings` table (provider + model + api_key).

**Resolution order** in `lib/ai/client.ts → resolveAIConfig(userId)`:
1. User's saved settings in DB
2. Legacy `user_integration_tokens` entry for `"llm"` 
3. Environment variables: `LLM_PROVIDER`, then `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY`

Supported providers: `openai`, `anthropic`, `gemini`.

---

## Data Flow: How information enters the system

```
1. Syllabus upload (user-triggered)
   app/(app)/upload → POST /api/upload
   → lib/parsers/syllabus.ts (LLM extracts structure from PDF)
   → lib/db/courses.ts upsertSyllabus() + upsertCourse()
   → lib/db/assignments.ts insertSyllabusAssignments()

2. Canvas DOM scraping (passive, while user browses)
   chrome-extension/content/dom-observer.ts
   → detects page type, extracts text signals
   → sends to POST /api/extension/context-summary
   → lib/extension/context.ts buildAskAgentContext()
   → used as context when the user asks a question

3. Canvas API enrichment (if user provides PAT)
   weekly-course-pulse uses Canvas assignments + modules API
   stored in user_integration_tokens as provider="canvas"

4. Weekly pulse (server-side, scheduled)
   POST /api/weekly-course-pulse/run-due
   → lib/skills/generateWeeklyCoursePulse.ts
   → LLM generates past-week summary + next-week preview
   → cached in weekly_course_pulse table
```

---

## Key Patterns & Conventions

### Auth in API routes
```typescript
const user = await getUserFromRequest(req);
if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
// user.id is the Supabase auth UUID
```

### Database access
Always use `getServiceClient()` from `lib/supabase/server.ts` in API routes and server-side code. Never use the browser client on the server.

```typescript
const supabase = getServiceClient();
const { data, error } = await supabase.from("courses").select("...").eq("user_id", userId);
if (error) throw new Error(`operation failed: ${error.message}`);
```

### Zod validation in API routes
```typescript
const RequestSchema = z.object({ message: z.string().min(1) });
// parse throws ZodError with helpful messages if invalid
const { message } = RequestSchema.parse(await req.json());
```

### All routes must declare runtime
```typescript
export const runtime = "nodejs";  // top of every API route file
```

### `as const` type assertions on Supabase rows
Supabase returns `any`-typed rows. Cast with `as string`, `as string | null`, etc.
```typescript
id: row.id as string,
name: (row.course_name ?? row.course_id) as string,
```

---

## Current supabase database structure
-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.users (
  id uuid NOT NULL,
  email text,
  full_name text,
  avatar_url text,
  canvas_user_id text,
  canvas_instance_url text,
  canvas_deployment_id text,
  timezone text DEFAULT 'UTC'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.courses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  course_id text NOT NULL,
  course_name text NOT NULL,
  term text,
  instructor_name text,
  current_grade_percent numeric,
  attendance_missed_count integer DEFAULT 0,
  attendance_allowed_misses integer DEFAULT 0,
  location text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  credits integer,
  schedule text,
  CONSTRAINT courses_pkey PRIMARY KEY (id),
  CONSTRAINT courses_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.syllabus(course_id),
  CONSTRAINT courses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL,
  grade_component_id uuid,
  canvas_assignment_id text,
  title text NOT NULL,
  assignment_type text NOT NULL,
  description text,
  due_at timestamp with time zone,
  available_from timestamp with time zone,
  available_until timestamp with time zone,
  points_possible numeric,
  score_received numeric,
  status text DEFAULT 'not_started'::text,
  estimated_hours numeric,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  dependencies ARRAY,
  difficulty text,
  topic text,
  CONSTRAINT assignments_pkey PRIMARY KEY (id),
  CONSTRAINT assignments_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id)
);
CREATE TABLE public.attendance_records (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL,
  class_date date NOT NULL,
  status text NOT NULL DEFAULT 'unknown'::text,
  recorded_by text DEFAULT 'manual'::text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT attendance_records_pkey PRIMARY KEY (id),
  CONSTRAINT attendance_records_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id)
);
CREATE TABLE public.course_grades (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  current_percent numeric,
  current_letter_grade text,
  projected_percent numeric,
  projected_letter_grade text,
  calculated_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  is_pf boolean,
  CONSTRAINT course_grades_pkey PRIMARY KEY (id),
  CONSTRAINT course_grades_id_fkey FOREIGN KEY (id) REFERENCES public.courses(id)
);
CREATE TABLE public.syllabus (
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  cut_off ARRAY,
  break_down ARRAY,
  exam_dates ARRAY,
  project_date ARRAY,
  course_id text NOT NULL,
  grading_policy text,
  grading_code text,
  topic_outline jsonb,
  course_uuid uuid,
  CONSTRAINT syllabus_pkey PRIMARY KEY (course_id),
  CONSTRAINT syllabus_course_uuid_fkey FOREIGN KEY (course_uuid) REFERENCES public.courses(id)
);
CREATE TABLE public.weekly_course_pulse (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  course_uuid uuid NOT NULL,
  course_id text NOT NULL,
  course_name text,
  anchor_date date NOT NULL,
  past_window_start date NOT NULL,
  past_window_end date NOT NULL,
  future_window_start date NOT NULL,
  future_window_end date NOT NULL,
  past_week_learned text NOT NULL,
  next_week_preview text NOT NULL,
  past_week_evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  next_week_evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence double precision NOT NULL DEFAULT 0,
  source_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_context jsonb,
  model text,
  generated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT weekly_course_pulse_pkey PRIMARY KEY (id),
  CONSTRAINT weekly_course_pulse_course_uuid_fkey FOREIGN KEY (course_uuid) REFERENCES public.courses(id)
);
CREATE TABLE public.professor_insights (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  professor_name text NOT NULL,
  university_name text NOT NULL,
  course_id text,
  rmp jsonb,
  reddit jsonb,
  raw_sources jsonb,
  generated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT professor_insights_pkey PRIMARY KEY (id)
);
CREATE TABLE public.user_integration_tokens (
  user_id uuid NOT NULL,
  provider text NOT NULL CHECK (provider = ANY (ARRAY['llm'::text, 'canvas'::text])),
  token text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_integration_tokens_pkey PRIMARY KEY (user_id, provider),
  CONSTRAINT user_integration_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_llm_settings (
  user_id uuid NOT NULL,
  provider text NOT NULL CHECK (provider = ANY (ARRAY['openai'::text, 'anthropic'::text, 'gemini'::text])),
  model text NOT NULL,
  api_key text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_llm_settings_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_llm_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.study_plan_blocks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  course_uuid uuid NOT NULL,
  title text NOT NULL,
  date date NOT NULL,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  type text NOT NULL,
  priority text,
  difficulty text,
  conflict boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT study_plan_blocks_pkey PRIMARY KEY (id),
  CONSTRAINT study_plan_blocks_course_uuid_fkey FOREIGN KEY (course_uuid) REFERENCES public.courses(id)
);
CREATE TABLE public.course_canvas_settings (
  course_uuid uuid NOT NULL,
  canvas_course_id text,
  canvas_base_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT course_canvas_settings_pkey PRIMARY KEY (course_uuid),
  CONSTRAINT course_canvas_settings_course_uuid_fkey FOREIGN KEY (course_uuid) REFERENCES public.courses(id)
);


---

## Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI providers (server-side fallback if user hasn't configured their own key)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=
LLM_PROVIDER=openai        # optional: forces a default provider
LLM_MODEL=gpt-4o-mini      # optional: forces a default model

# Google Calendar OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

# Chrome Extension (set in chrome-extension/.env)
VITE_BACKEND_URL=http://localhost:3000

# Optional
RMP_AUTH_TOKEN=             # Rate My Professor GraphQL auth (default: test:test)
```
