# Course Tracker

An AI-powered course tracker and study planner for students. Upload a syllabus, get your deadlines, exams, grading policy, and attendance rules extracted automatically — then let the app build a prioritized study plan around them.

This repo is a **frontend prototype** built to a Notion/Linear quality bar. All course, assignment, and planning data is mocked; the AI actions (extract, replan, sync) are simulated with realistic loading states. Authentication is wired to Supabase.

## Features

- **Dashboard** — greeting, stat tiles (GPA, deadlines, study hours, attendance risk), today's plan, weekly workload chart, upcoming exams, deadlines.
- **Courses** — grid of course cards with grade rings, drill into a detail page with tabs for Overview, Assignments, Exams, Modules, Files, and Insights.
- **Study Planner** — week and day views, priority legend, replan button with fake async.
- **Calendar** — month/week toggle, free-slot sidebar, fake Google Calendar sync.
- **Assignments** — filterable table with status chips, row drawer for detail and subtasks.
- **Upload** — drag-and-drop zone, simulated parsing, per-field confidence badges, needs-review edits.
- **Grade Calculator** — editable category scores, scenario slider for assumed future grades, missing-work impact.
- **Instructor Insights** — RMP / Reddit tabs with sentiment, quotes, and tag cloud (mock data).
- **Auth** — email + password and Google OAuth via Supabase, with signup password-strength meter.

## Stack

- **Next.js 14** (App Router) + **React 18** + **TypeScript** (strict)
- **Tailwind CSS 3** with custom CSS-variable tokens for light/dark theming
- **lucide-react** icons, **date-fns** for date math
- **@supabase/supabase-js** for authentication
- Lightweight **React Context + useState** store (`lib/store/AppStoreProvider.tsx`) so a future backend swap is a single-file change

No backend, no API routes, no database beyond Supabase auth.

## Getting Started

### 1. Install

```bash
npm install
```

### 2. Configure environment

Create a `.env` file in the project root with your Supabase project keys:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Only the two `NEXT_PUBLIC_` keys are used by the frontend — the service role key is kept for future server-side work. **Never commit `.env`.**

### 3. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll be routed to `/login` (or `/dashboard` if you already have a session).

### 4. Build

```bash
npm run build
npm start
```

## Auth Flow

- `/` checks for an active Supabase session and redirects to `/dashboard` or `/login`.
- `(app)/*` routes are gated — unauthenticated users are bounced to `/login`, and `onAuthStateChange` forces a logout to re-route.
- `(auth)/*` routes bounce already-signed-in users to `/dashboard`.
- Signup supports email-confirmation mode (shows a "check your email" state if Supabase returns no session).

## Project Layout

See [`filesystem.md`](./filesystem.md) for a full annotated tree.

Top level:

```
app/          # Next.js App Router pages (auth group + app group)
components/   # UI primitives + feature components
lib/          # Store, mock data, utils, supabase client
```

## Scripts

| Command         | What it does                              |
| --------------- | ------------------------------------------ |
| `npm run dev`   | Start the dev server on port 3000          |
| `npm run build` | Production build (type-checks the project) |
| `npm start`     | Run the built app                          |
| `npm run lint`  | ESLint (next/core-web-vitals)              |

## Notes

- All mock dates in `lib/mock/` are anchored to `new Date()` at module load, so the prototype always looks current.
- Fake async delays live in `lib/utils/fakeAsync.ts` — tweak the jitter there if the loading states feel too slow or too fast.
- The build has `experimental.webpackBuildWorker: false` set in `next.config.mjs` to work around a Node 22 + Windows Jest-worker crash.

## Out of Scope

- Real PDF parsing (upload is simulated)
- Real Google Calendar OAuth (button is a fake loader)
- Persistent course data (everything lives in the in-memory store)
- Tests


## dev account
email: dev@wustl.edu
password: dev123456
