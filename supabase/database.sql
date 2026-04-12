-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.agent_message_reads (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  message_id integer NOT NULL,
  reader_contact_type text NOT NULL,
  chat_id uuid NOT NULL,
  read_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT agent_message_reads_pkey PRIMARY KEY (id),
  CONSTRAINT agent_message_reads_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id),
  CONSTRAINT agent_message_reads_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id)
);
CREATE TABLE public.canvas_file_versions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  file_id uuid NOT NULL,
  version integer NOT NULL,
  change_description text,
  author_id uuid,
  content text,
  storage_path text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT canvas_file_versions_pkey PRIMARY KEY (id),
  CONSTRAINT canvas_file_versions_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.canvas_files(id),
  CONSTRAINT canvas_file_versions_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id)
);
CREATE TABLE public.canvas_files (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  chat_id uuid NOT NULL,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL,
  language text,
  mime_type text NOT NULL,
  content text,
  storage_path text,
  file_size bigint,
  version integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'user'::text CHECK (source = ANY (ARRAY['user'::text, 'agent'::text])),
  comments jsonb DEFAULT '[]'::jsonb,
  CONSTRAINT canvas_files_pkey PRIMARY KEY (id),
  CONSTRAINT canvas_files_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id)
);
CREATE TABLE public.case_tasks (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  case_id uuid NOT NULL,
  subject text NOT NULL,
  description text,
  active_form text NOT NULL DEFAULT ''::text,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text])),
  owner text,
  blocked_by ARRAY DEFAULT '{}'::text[],
  blocks ARRAY DEFAULT '{}'::text[],
  urgency text DEFAULT 'normal'::text CHECK (urgency = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text])),
  result jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  order integer,
  CONSTRAINT case_tasks_pkey PRIMARY KEY (id),
  CONSTRAINT case_tasks_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id)
);
CREATE TABLE public.case_type_skill_links (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  case_type_id text NOT NULL,
  skill_id text NOT NULL,
  skill_type text NOT NULL DEFAULT 'case-type'::text,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT case_type_skill_links_pkey PRIMARY KEY (id)
);
CREATE TABLE public.cases (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  case_type text,
  title text NOT NULL DEFAULT 'Untitled Case'::text,
  status text NOT NULL DEFAULT 'active'::text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT cases_pkey PRIMARY KEY (id),
  CONSTRAINT cases_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.chat_attachments (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  chat_id uuid NOT NULL,
  user_id uuid NOT NULL,
  file_url text NOT NULL,
  file_name text,
  file_type text,
  file_size integer,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT chat_attachments_pkey PRIMARY KEY (id),
  CONSTRAINT fk_chat FOREIGN KEY (chat_id) REFERENCES public.chats(id),
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.chat_participants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'collaborator'::text CHECK (role = ANY (ARRAY['owner'::text, 'attorney'::text, 'collaborator'::text])),
  display_name text,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  invited_at timestamp with time zone DEFAULT now(),
  invited_by uuid,
  last_seen_at timestamp with time zone,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['invited'::text, 'active'::text, 'left'::text])),
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT chat_participants_pkey PRIMARY KEY (id),
  CONSTRAINT chat_participants_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id),
  CONSTRAINT chat_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT chat_participants_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id)
);
CREATE TABLE public.chat_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  consumed_at timestamp with time zone,
  CONSTRAINT chat_queue_pkey PRIMARY KEY (id),
  CONSTRAINT chat_queue_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id)
);
CREATE TABLE public.chats (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  project_id uuid,
  title text,
  model text,
  system_prompt text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  public boolean NOT NULL DEFAULT false,
  pinned boolean NOT NULL DEFAULT false,
  pinned_at timestamp with time zone,
  case_type character varying,
  container_id text,
  has_active_correspondence boolean DEFAULT false,
  correspondence_count integer DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  case_type_version text DEFAULT '1.0.0'::text,
  case_type_config_snapshot jsonb,
  case_id uuid,
  contact_type text,
  unread_count integer NOT NULL DEFAULT 0,
  agent_status text DEFAULT 'idle'::text CHECK (agent_status = ANY (ARRAY['idle'::text, 'working'::text, 'waiting_input'::text, 'error'::text])),
  current_task_id text,
  questionnaire_completed_at timestamp with time zone,
  CONSTRAINT chats_pkey PRIMARY KEY (id),
  CONSTRAINT chats_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT chats_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id),
  CONSTRAINT chats_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id)
);
CREATE TABLE public.correspondence_threads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL,
  user_id uuid NOT NULL,
  subject text NOT NULL,
  external_party_email text NOT NULL,
  external_party_name text,
  external_party_role text,
  gmail_thread_id text UNIQUE,
  status text NOT NULL DEFAULT 'active'::text,
  current_stage text NOT NULL DEFAULT 'INITIATED'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  last_message_at timestamp with time zone,
  CONSTRAINT correspondence_threads_pkey PRIMARY KEY (id),
  CONSTRAINT correspondence_threads_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id),
  CONSTRAINT correspondence_threads_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.document_store_files (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  store_id uuid NOT NULL,
  chat_id uuid NOT NULL,
  google_file_name text NOT NULL,
  original_filename text NOT NULL,
  mime_type text,
  file_size integer,
  status text DEFAULT 'indexed'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT document_store_files_pkey PRIMARY KEY (id),
  CONSTRAINT document_store_files_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.document_stores(id),
  CONSTRAINT document_store_files_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id)
);
CREATE TABLE public.document_stores (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  chat_id uuid NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  store_name text NOT NULL,
  display_name text,
  file_count integer DEFAULT 0,
  status text DEFAULT 'active'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT document_stores_pkey PRIMARY KEY (id),
  CONSTRAINT document_stores_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id),
  CONSTRAINT document_stores_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.dynamic_case_types (
  id text NOT NULL,
  display_name text NOT NULL,
  display_description text NOT NULL,
  prompt_text text NOT NULL,
  category text NOT NULL,
  maturity text DEFAULT 'beta'::text,
  icon_name text DEFAULT 'Briefcase'::text,
  invitation_code text UNIQUE,
  manifest jsonb NOT NULL,
  questionnaire jsonb,
  is_active boolean DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT dynamic_case_types_pkey PRIMARY KEY (id),
  CONSTRAINT dynamic_case_types_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL,
  user_id uuid,
  event_type text NOT NULL,
  description text NOT NULL,
  category text,
  related_entity_type text,
  related_entity_id text,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT events_pkey PRIMARY KEY (id),
  CONSTRAINT events_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id),
  CONSTRAINT events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.feedback (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  message text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  image_urls ARRAY,
  CONSTRAINT feedback_pkey PRIMARY KEY (id),
  CONSTRAINT feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.invitations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  token uuid NOT NULL UNIQUE,
  chat_id uuid NOT NULL,
  email text,
  role text NOT NULL DEFAULT 'attorney'::text CHECK (role = ANY (ARRAY['attorney'::text, 'collaborator'::text])),
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'expired'::text, 'revoked'::text])),
  invited_by uuid NOT NULL,
  invited_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  accepted_at timestamp with time zone,
  accepted_by uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT invitations_pkey PRIMARY KEY (id),
  CONSTRAINT invitations_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id),
  CONSTRAINT invitations_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id),
  CONSTRAINT invitations_accepted_by_fkey FOREIGN KEY (accepted_by) REFERENCES auth.users(id)
);
CREATE TABLE public.messages (
  id integer NOT NULL DEFAULT nextval('messages_id_seq'::regclass),
  chat_id uuid NOT NULL,
  user_id uuid,
  content text,
  role text NOT NULL CHECK (role = ANY (ARRAY['system'::text, 'user'::text, 'assistant'::text, 'data'::text])),
  experimental_attachments jsonb,
  parts jsonb,
  created_at timestamp with time zone DEFAULT now(),
  message_group_id text,
  model text,
  sender_id uuid,
  sender_type text DEFAULT 'client'::text CHECK (sender_type = ANY (ARRAY['client'::text, 'ai'::text, 'attorney'::text, 'system'::text, 'specialist'::text, 'coordinator'::text, 'staff'::text])),
  CONSTRAINT messages_pkey PRIMARY KEY (id),
  CONSTRAINT messages_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id),
  CONSTRAINT messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id)
);
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  chat_id uuid,
  title text NOT NULL,
  message text NOT NULL,
  ai_summary text,
  type text NOT NULL,
  urgency text NOT NULL DEFAULT 'normal'::text,
  case_type text,
  read boolean NOT NULL DEFAULT false,
  read_at timestamp with time zone,
  dismissed boolean NOT NULL DEFAULT false,
  dismissed_at timestamp with time zone,
  email_sent boolean DEFAULT false,
  email_sent_at timestamp with time zone,
  email_error text,
  dedup_key text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT notifications_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id)
);
CREATE TABLE public.page_views (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  session_id text NOT NULL,
  path text NOT NULL,
  page_type text NOT NULL,
  referrer text,
  entered_at timestamp with time zone NOT NULL DEFAULT now(),
  left_at timestamp with time zone,
  duration_ms integer,
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT page_views_pkey PRIMARY KEY (id),
  CONSTRAINT page_views_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.portal_articles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  case_type text NOT NULL,
  slug text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  summary text,
  category text NOT NULL,
  tags ARRAY,
  featured boolean DEFAULT false,
  publish_date date DEFAULT CURRENT_DATE,
  source_url text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT portal_articles_pkey PRIMARY KEY (id)
);
CREATE TABLE public.portal_cases (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  case_type text NOT NULL,
  identifier text NOT NULL,
  title text NOT NULL,
  status text DEFAULT 'pending'::text,
  filing_date date,
  data jsonb DEFAULT '{}'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT portal_cases_pkey PRIMARY KEY (id)
);
CREATE TABLE public.portal_entities (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  case_type text NOT NULL,
  entity_type text NOT NULL,
  name text NOT NULL,
  slug text,
  description text,
  data jsonb DEFAULT '{}'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT portal_entities_pkey PRIMARY KEY (id)
);
CREATE TABLE public.preview_deployments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  url text NOT NULL UNIQUE,
  branch text,
  commit_sha text,
  commit_message text,
  author text,
  vercel_env text NOT NULL DEFAULT 'preview'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT preview_deployments_pkey PRIMARY KEY (id)
);
CREATE TABLE public.projects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT projects_pkey PRIMARY KEY (id),
  CONSTRAINT projects_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.skill_editors (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  email text NOT NULL UNIQUE,
  display_name text,
  added_by text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT skill_editors_pkey PRIMARY KEY (id),
  CONSTRAINT skill_editors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.skill_edits (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  editor_id uuid NOT NULL,
  skill_id text NOT NULL,
  file_path text NOT NULL,
  original_content text NOT NULL,
  proposed_content text NOT NULL,
  diff_text text,
  edit_summary text,
  has_frontmatter_change boolean DEFAULT false,
  has_tool_reference_change boolean DEFAULT false,
  changed_line_count integer DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'applied'::text])),
  reviewer_id uuid,
  reviewer_email text,
  review_comment text,
  reviewed_at timestamp with time zone,
  applied_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  github_commit_sha text,
  committed_to_github_at timestamp with time zone,
  CONSTRAINT skill_edits_pkey PRIMARY KEY (id),
  CONSTRAINT skill_edits_editor_id_fkey FOREIGN KEY (editor_id) REFERENCES auth.users(id),
  CONSTRAINT skill_edits_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES auth.users(id)
);
CREATE TABLE public.skill_files (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  skill_id text NOT NULL,
  skill_type text NOT NULL CHECK (skill_type = ANY (ARRAY['case-type'::text, 'standalone'::text])),
  file_path text NOT NULL,
  content text NOT NULL,
  file_extension text NOT NULL,
  is_binary boolean DEFAULT false,
  file_size integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT skill_files_pkey PRIMARY KEY (id)
);
CREATE TABLE public.skill_sync_log (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  direction text NOT NULL CHECK (direction = ANY (ARRAY['github_to_supabase'::text, 'portal_to_github'::text])),
  commit_sha text,
  files jsonb NOT NULL DEFAULT '[]'::jsonb,
  triggered_by text NOT NULL CHECK (triggered_by = ANY (ARRAY['ci'::text, 'portal_apply'::text, 'manual'::text])),
  status text NOT NULL DEFAULT 'success'::text CHECK (status = ANY (ARRAY['success'::text, 'partial_failure'::text, 'failed'::text])),
  error_message text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT skill_sync_log_pkey PRIMARY KEY (id)
);
CREATE TABLE public.token_usage (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  chat_id text NOT NULL,
  user_id uuid NOT NULL,
  model text NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer DEFAULT (input_tokens + output_tokens),
  estimated_cost_usd numeric NOT NULL DEFAULT 0,
  step_count integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  ttft_breakdown jsonb,
  cache_read_tokens integer DEFAULT 0,
  cache_write_tokens integer DEFAULT 0,
  finish_reason text,
  step_details jsonb,
  CONSTRAINT token_usage_pkey PRIMARY KEY (id)
);
CREATE TABLE public.tracker_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  title text NOT NULL,
  description text NOT NULL,
  contribution_type text NOT NULL DEFAULT 'feature'::text,
  status text NOT NULL DEFAULT 'open'::text,
  status_message text,
  github_issue_url text,
  github_pr_url text,
  github_pr_number integer,
  github_pr_title text,
  implemented_by text,
  implemented_at timestamp with time zone,
  merged_at timestamp with time zone,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tracker_items_pkey PRIMARY KEY (id),
  CONSTRAINT user_contributions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.user_keys (
  user_id uuid NOT NULL,
  provider text NOT NULL,
  encrypted_key text NOT NULL,
  iv text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_keys_pkey PRIMARY KEY (user_id, provider),
  CONSTRAINT user_keys_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.user_preferences (
  user_id uuid NOT NULL,
  layout text DEFAULT 'fullscreen'::text,
  prompt_suggestions boolean DEFAULT true,
  show_tool_invocations boolean DEFAULT true,
  show_conversation_previews boolean DEFAULT true,
  multi_model_enabled boolean DEFAULT false,
  hidden_models ARRAY DEFAULT '{}'::text[],
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  language character varying DEFAULT 'en'::character varying,
  language_modal_shown boolean DEFAULT false,
  notification_settings jsonb DEFAULT '{"emailEnabled": true, "inAppEnabled": true, "urgencyThreshold": "normal"}'::jsonb,
  CONSTRAINT user_preferences_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.users (
  id uuid NOT NULL,
  email text NOT NULL,
  anonymous boolean,
  daily_message_count integer,
  daily_reset timestamp with time zone,
  display_name text,
  favorite_models ARRAY,
  message_count integer,
  premium boolean,
  profile_image text,
  created_at timestamp with time zone DEFAULT now(),
  last_active_at timestamp with time zone DEFAULT now(),
  daily_pro_message_count integer,
  daily_pro_reset timestamp with time zone,
  system_prompt text,
  gmail_email text,
  gmail_access_token text,
  gmail_refresh_token text,
  gmail_token_expires_at timestamp with time zone,
  gmail_connected_at timestamp with time zone,
  gmail_watch_expiration timestamp with time zone,
  gmail_history_id text,
  gmail_watch_enabled boolean DEFAULT false,
  unlocked_case_types jsonb DEFAULT '[]'::jsonb,
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.utility_skills (
  id text NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'document'::text,
  is_active boolean NOT NULL DEFAULT true,
  synced_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT utility_skills_pkey PRIMARY KEY (id)
);
CREATE TABLE public.worldtro_brands (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  brand_name text NOT NULL,
  brand_url text,
  brand_name_en text,
  brand_name_cn text,
  brand_type text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT worldtro_brands_pkey PRIMARY KEY (id)
);
CREATE TABLE public.worldtro_cases (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  case_number text NOT NULL UNIQUE,
  case_url text,
  filing_date text,
  plaintiff text,
  state text,
  law_firm text,
  has_defendant_list boolean DEFAULT false,
  brand_id bigint,
  error text,
  scraped_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  verified_at timestamp with time zone,
  page_hash text,
  CONSTRAINT worldtro_cases_pkey PRIMARY KEY (id),
  CONSTRAINT worldtro_cases_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.worldtro_brands(id)
);
CREATE TABLE public.worldtro_defendants (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  local_id text,
  case_id bigint NOT NULL,
  store_name text NOT NULL,
  email text,
  country text,
  store_link text,
  platform text,
  addition_info text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT worldtro_defendants_pkey PRIMARY KEY (id),
  CONSTRAINT worldtro_defendants_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.worldtro_cases(id)
);
CREATE TABLE public.worldtro_docket_entries (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  case_id bigint NOT NULL,
  entry_number integer,
  entry_date text,
  description text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT worldtro_docket_entries_pkey PRIMARY KEY (id),
  CONSTRAINT worldtro_docket_entries_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.worldtro_cases(id)
);