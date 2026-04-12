-- Course Tracker — Supabase schema
-- Run this in the Supabase SQL editor (https://supabase.com/dashboard → SQL → New query)
-- to provision the tables used by the app's API routes.
-- Safe to re-run: every statement is `if not exists` / `add constraint if not exists`.

-- ─── Syllabus / Courses / Assignments (used by /api/upload) ────────────────
-- Order matters: parents before children because of FKs.

create table if not exists syllabus (
  course_id      text primary key,
  break_down     jsonb,
  exam_dates     jsonb,
  project_date   jsonb,
  cut_off        jsonb,
  grading_policy text,
  grading_code   text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists users (
  id                   uuid primary key references auth.users(id) on delete cascade,
  email                text,
  full_name            text,
  avatar_url           text,
  canvas_user_id       text,
  canvas_instance_url  text,
  canvas_deployment_id text,
  timezone             text default 'UTC',
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

create table if not exists courses (
  id                         uuid primary key default gen_random_uuid(),
  user_id                    uuid not null references auth.users(id) on delete cascade,
  course_id                  text not null references syllabus(course_id) on delete cascade,
  course_name                text not null,
  term                       text,
  instructor_name            text,
  syllabus_text              text,
  current_grade_percent      numeric,
  attendance_missed_count    integer default 0,
  attendance_allowed_misses  integer not null default 0,
  location                   text,
  credits                    integer,
  schedule                   text,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  -- Required for upsertCourse's `onConflict: "user_id,course_id"` clause.
  constraint courses_user_id_course_id_key unique (user_id, course_id)
);

create index if not exists idx_courses_user_id on courses (user_id);

create table if not exists assignments (
  id                   uuid primary key default gen_random_uuid(),
  course_id            uuid not null references courses(id) on delete cascade,
  grade_component_id   uuid,
  canvas_assignment_id text,
  title                text not null,
  assignment_type      text not null,
  description          text,
  due_at               timestamptz,
  available_from       timestamptz,
  available_until      timestamptz,
  points_possible      numeric,
  score_received       numeric,
  status               text not null default 'not_started',
  estimated_hours      numeric,
  importance_score     numeric,
  dependencies         text[] default '{}'::text[],
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists idx_assignments_course_id on assignments (course_id);
create index if not exists idx_assignments_due_at on assignments (due_at);

-- ─── Attendance records ──────────────────────────────────────────────────────

create table if not exists attendance_records (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references courses(id) on delete cascade,
  class_date  date not null,
  status      text not null default 'unknown',
  recorded_by text default 'manual',
  notes       text,
  created_at  timestamptz default now()
);

create index if not exists idx_attendance_course_id on attendance_records (course_id);

-- ─── Course grades (1-to-1 with courses, shares the same uuid) ───────────────

create table if not exists course_grades (
  id                     uuid primary key references courses(id) on delete cascade,
  current_percent        numeric,
  current_letter_grade   text,
  projected_percent      numeric,
  projected_letter_grade text,
  is_pf                  boolean,
  calculated_at          timestamptz default now(),
  created_at             timestamptz default now()
);

-- ─── Study plan ──────────────────────────────────────────────────────────────

create table if not exists study_plan (
  id         uuid primary key references courses(id) on delete cascade,
  course_id  text,
  title      text,
  type       text,
  priority   text,
  difficulty text,
  created_at timestamptz not null default now()
);

-- ─── Planner / grades persistence ──────────────────────────────────────────

create table if not exists course_grades (
  id uuid primary key references courses(id) on delete cascade,
  current_percent numeric,
  current_letter_grade text,
  projected_percent numeric,
  projected_letter_grade text,
  is_pf boolean not null default false,
  calculated_at timestamptz not null default now()
);

create table if not exists study_plan (
  id uuid primary key references courses(id) on delete cascade,
  course_id text not null,
  title text not null,
  type text not null,
  priority text not null,
  difficulty text not null,
  updated_at timestamptz not null default now()
);

create table if not exists study_plan_blocks (
  id uuid primary key default gen_random_uuid(),
  course_uuid uuid not null references courses(id) on delete cascade,
  course_id text not null,
  title text not null,
  date date not null,
  start_time time not null,
  end_time time not null,
  type text not null,
  priority text,
  difficulty text,
  conflict boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_study_plan_blocks_course_uuid
  on study_plan_blocks (course_uuid);

create index if not exists idx_study_plan_blocks_date
  on study_plan_blocks (date);

-- ─── Professor insights (used by /api/professor-insights) ─────────────────

create table if not exists professor_insights (
  id              uuid primary key default gen_random_uuid(),
  professor_name  text not null,
  university_name text not null,
  course_id       text,
  rmp             jsonb,
  reddit          jsonb,
  raw_sources     jsonb,
  generated_at    timestamptz not null default now()
);

-- Lookup index for the cache check (24h window) used by /api/professor-insights
create index if not exists idx_prof_insights_lookup
  on professor_insights (lower(professor_name), lower(university_name), generated_at desc);

-- ─── Weekly course pulse ─────────────────────────────────────────────────────

create table if not exists weekly_course_pulse (
  id                  uuid primary key default gen_random_uuid(),
  course_uuid         uuid not null references courses(id) on delete cascade,
  course_id           text not null,
  course_name         text,
  anchor_date         date not null,
  past_window_start   date not null,
  past_window_end     date not null,
  future_window_start date not null,
  future_window_end   date not null,
  past_week_learned   text not null,
  next_week_preview   text not null,
  past_week_evidence  jsonb not null default '[]'::jsonb,
  next_week_evidence  jsonb not null default '[]'::jsonb,
  confidence          double precision not null default 0,
  source_summary      jsonb not null default '{}'::jsonb,
  raw_context         jsonb,
  model               text,
  generated_at        timestamptz not null default now()
);

create unique index if not exists idx_weekly_course_pulse_course_anchor
  on weekly_course_pulse (course_uuid, anchor_date);

-- ─── User integration tokens (used by settings UI + backend token lookup) ──

create table if not exists user_integration_tokens (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('llm', 'canvas')),
  token text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_integration_tokens_pkey primary key (user_id, provider)
);

create index if not exists idx_user_integration_tokens_user_id
  on user_integration_tokens (user_id);

create table if not exists user_llm_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null check (provider in ('openai', 'anthropic', 'gemini')),
  model text not null,
  api_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
