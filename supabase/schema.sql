-- Course Tracker — Supabase schema
-- Run this in the Supabase SQL editor (https://supabase.com/dashboard → SQL → New query)
-- to provision the tables used by the app's API routes.
-- Safe to re-run: every statement is `if not exists` / `add constraint if not exists`.

-- ─── Syllabus / Courses / Assignments (used by /api/upload) ────────────────
-- Order matters: parents before children because of FKs.

create table if not exists syllabus (
  course_id   text primary key,
  break_down  jsonb,
  exam_dates  jsonb,
  project_date jsonb,
  cut_off     jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists courses (
  id                         uuid primary key default gen_random_uuid(),
  user_id                    uuid not null references auth.users(id) on delete cascade,
  course_id                  text not null references syllabus(course_id) on delete cascade,
  course_name                text not null,
  instructor_name            text,
  attendance_allowed_misses  integer not null default 0,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  -- Required for upsertCourse's `onConflict: "user_id,course_id"` clause.
  constraint courses_user_id_course_id_key unique (user_id, course_id)
);

create index if not exists idx_courses_user_id on courses (user_id);

create table if not exists assignments (
  id               uuid primary key default gen_random_uuid(),
  course_id        uuid not null references courses(id) on delete cascade,
  title            text not null,
  assignment_type  text not null,
  due_at           timestamptz,
  status           text not null default 'not_started',
  points_possible  numeric,
  estimated_hours  numeric,
  description      text,
  dependencies     text[] default '{}'::text[],
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_assignments_course_id on assignments (course_id);
create index if not exists idx_assignments_due_at on assignments (due_at);

-- ─── Professor insights (used by /api/professor-insights) ─────────────────

create table if not exists professor_insights (
  id uuid primary key default gen_random_uuid(),
  professor_name text not null,
  university_name text not null,
  course_id text,
  rmp jsonb,
  reddit jsonb,
  raw_sources jsonb,
  generated_at timestamptz not null default now()
);

-- Lookup index for the cache check (24h window) used by /api/professor-insights
create index if not exists idx_prof_insights_lookup
  on professor_insights (lower(professor_name), lower(university_name), generated_at desc);
