-- Course Tracker — Supabase schema
-- Run this in the Supabase SQL editor (https://supabase.com/dashboard → SQL → New query)
-- to provision the tables used by the app's API routes.

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
