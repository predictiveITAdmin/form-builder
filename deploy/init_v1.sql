\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned

-- ------------------------------------------------------------
-- One-time guard: if init_v1 already applied, quit immediately
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  id text PRIMARY KEY,
  applied_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

SELECT EXISTS (
  SELECT 1 FROM public.schema_migrations WHERE id = 'init_v1'
) AS already_applied \gset

\if :already_applied
  \echo 'init_v1 already applied, skipping.'
  \quit
\endif

BEGIN;

-- ------------------------------------------------------------------
-- Sequences
-- ------------------------------------------------------------------
CREATE SEQUENCE "public"."fieldoptions_option_id_seq"
  AS integer
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 2147483647
  NO CYCLE;

CREATE SEQUENCE "public"."form_access_form_access_id_seq"
  AS integer
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 2147483647
  NO CYCLE;

CREATE SEQUENCE "public"."formfields_field_id_seq"
  AS integer
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 2147483647
  NO CYCLE;

CREATE SEQUENCE "public"."forms_form_id_seq"
  AS integer
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 2147483647
  NO CYCLE;

CREATE SEQUENCE "public"."formsessions_session_id_seq"
  AS integer
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 2147483647
  NO CYCLE;

CREATE SEQUENCE "public"."formsteps_step_id_seq"
  AS integer
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 2147483647
  NO CYCLE;

CREATE SEQUENCE "public"."permissions_permission_id_seq"
  AS integer
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 2147483647
  NO CYCLE;

CREATE SEQUENCE "public"."responses_response_id_seq"
  AS integer
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 2147483647
  NO CYCLE;

CREATE SEQUENCE "public"."responsevalueoptions_response_value_option_id_seq"
  AS integer
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 2147483647
  NO CYCLE;

CREATE SEQUENCE "public"."responsevalues_response_value_id_seq"
  AS integer
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 2147483647
  NO CYCLE;

CREATE SEQUENCE "public"."role_permissions_role_permission_id_seq"
  AS integer
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 2147483647
  NO CYCLE;

CREATE SEQUENCE "public"."roles_role_id_seq"
  AS integer
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 2147483647
  NO CYCLE;

CREATE SEQUENCE "public"."user_roles_user_role_id_seq"
  AS integer
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 2147483647
  NO CYCLE;

CREATE SEQUENCE "public"."users_user_id_seq"
  AS integer
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  MAXVALUE 2147483647
  NO CYCLE;

-- ------------------------------------------------------------------
-- Tables
-- ------------------------------------------------------------------
CREATE TABLE "public"."fieldoptions" (
  "option_id" integer DEFAULT nextval('fieldoptions_option_id_seq'::regclass) NOT NULL,
  "form_field_id" integer NOT NULL,
  "value" character varying(400) NOT NULL,
  "label" character varying(400) NOT NULL,
  "is_default" boolean DEFAULT false NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "source" character varying(12) NOT NULL,
  "updated_at" timestamp(3) without time zone DEFAULT (now() AT TIME ZONE 'UTC'::text) NOT NULL
);

CREATE TABLE "public"."form_access" (
  "form_access_id" integer DEFAULT nextval('form_access_form_access_id_seq'::regclass) NOT NULL,
  "form_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "granted_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "granted_by" integer
);

CREATE TABLE "public"."formfields" (
  "field_id" integer DEFAULT nextval('formfields_field_id_seq'::regclass) NOT NULL,
  "form_id" integer NOT NULL,
  "key_name" character varying(100) NOT NULL,
  "label" character varying(300) NOT NULL,
  "help_text" character varying(1000),
  "field_type" character varying(40) NOT NULL,
  "required" boolean DEFAULT false NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "config_json" text,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp(3) without time zone DEFAULT (now() AT TIME ZONE 'UTC'::text) NOT NULL,
  "updated_at" timestamp(3) without time zone DEFAULT (now() AT TIME ZONE 'UTC'::text) NOT NULL,
  "form_step_id" integer
);

CREATE TABLE "public"."forms" (
  "form_id" integer DEFAULT nextval('forms_form_id_seq'::regclass) NOT NULL,
  "title" character varying(300) NOT NULL,
  "description" text,
  "status" character varying(32) DEFAULT 'Draft'::character varying NOT NULL,
  "owner_user_id" integer,
  "is_anonymous" boolean DEFAULT false NOT NULL,
  "created_at" timestamp(3) without time zone DEFAULT (now() AT TIME ZONE 'UTC'::text) NOT NULL,
  "updated_at" timestamp(3) without time zone DEFAULT (now() AT TIME ZONE 'UTC'::text) NOT NULL,
  "rpa_webhook_url" character varying(1000),
  "rpa_secret" character varying(128),
  "rpa_timeout_ms" integer DEFAULT 8000 NOT NULL,
  "rpa_retry_count" integer DEFAULT 3 NOT NULL,
  "form_key" character varying(120),
  "rpa_header_key" text NOT NULL,
  "usage_mode" character varying(20) DEFAULT 'standalone'::character varying NOT NULL
);

CREATE TABLE "public"."formsessions" (
  "session_id" integer DEFAULT nextval('formsessions_session_id_seq'::regclass) NOT NULL,
  "form_id" integer NOT NULL,
  "user_id" integer,
  "session_token" character varying(256) NOT NULL,
  "current_step" integer DEFAULT 1 NOT NULL,
  "total_steps" integer DEFAULT 1 NOT NULL,
  "is_completed" boolean DEFAULT false NOT NULL,
  "expires_at" timestamp(3) without time zone,
  "client_ip" character varying(64),
  "user_agent" character varying(512),
  "created_at" timestamp(3) without time zone DEFAULT (now() AT TIME ZONE 'UTC'::text) NOT NULL,
  "updated_at" timestamp(3) without time zone DEFAULT (now() AT TIME ZONE 'UTC'::text) NOT NULL,
  "completed_at" timestamp(3) without time zone,
  "is_active" boolean DEFAULT true NOT NULL,
  "reminder_sent_at" timestamp without time zone,
  "workflow_run_id" integer,
  "workflow_item_id" integer
);

CREATE TABLE "public"."formsteps" (
  "step_id" integer DEFAULT nextval('formsteps_step_id_seq'::regclass) NOT NULL,
  "form_id" integer NOT NULL,
  "step_number" integer NOT NULL,
  "step_title" character varying(300) NOT NULL,
  "step_description" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp(3) without time zone DEFAULT (now() AT TIME ZONE 'UTC'::text) NOT NULL,
  "updated_at" timestamp(3) without time zone DEFAULT (now() AT TIME ZONE 'UTC'::text) NOT NULL
);

CREATE TABLE "public"."permissions" (
  "permission_id" integer DEFAULT nextval('permissions_permission_id_seq'::regclass) NOT NULL,
  "permission_name" character varying(100) NOT NULL,
  "permission_code" character varying(100) NOT NULL,
  "description" text,
  "resource" character varying(100),
  "action" character varying(50),
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "public"."responses" (
  "response_id" integer DEFAULT nextval('responses_response_id_seq'::regclass) NOT NULL,
  "form_id" integer NOT NULL,
  "user_id" integer,
  "submitted_at" timestamp(3) without time zone DEFAULT (now() AT TIME ZONE 'UTC'::text) NOT NULL,
  "client_ip" character varying(64),
  "user_agent" character varying(512),
  "meta_json" text,
  "session_id" integer,
  "workflow_run_id" integer,
  "workflow_item_id" integer
);

CREATE TABLE "public"."responsevalueoptions" (
  "response_value_option_id" integer DEFAULT nextval('responsevalueoptions_response_value_option_id_seq'::regclass) NOT NULL,
  "response_value_id" integer NOT NULL,
  "field_option_id" integer,
  "option_value" character varying(400) NOT NULL,
  "option_label" character varying(400),
  "created_at" timestamp(3) without time zone DEFAULT (now() AT TIME ZONE 'UTC'::text) NOT NULL
);

CREATE TABLE "public"."responsevalues" (
  "response_value_id" integer DEFAULT nextval('responsevalues_response_value_id_seq'::regclass) NOT NULL,
  "response_id" integer NOT NULL,
  "form_field_id" integer NOT NULL,
  "value_text" text,
  "value_number" numeric(38,10),
  "value_date" date,
  "value_datetime" timestamp(3) without time zone,
  "value_bool" boolean,
  "created_at" timestamp(3) without time zone DEFAULT (now() AT TIME ZONE 'UTC'::text) NOT NULL
);

CREATE TABLE "public"."role_permissions" (
  "role_permission_id" integer DEFAULT nextval('role_permissions_role_permission_id_seq'::regclass) NOT NULL,
  "role_id" integer NOT NULL,
  "permission_id" integer NOT NULL,
  "granted_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "granted_by" integer
);

CREATE TABLE "public"."roles" (
  "role_id" integer DEFAULT nextval('roles_role_id_seq'::regclass) NOT NULL,
  "role_name" character varying(100) NOT NULL,
  "role_code" character varying(100) NOT NULL,
  "description" text,
  "is_system_role" boolean DEFAULT false NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "public"."user_roles" (
  "user_role_id" integer DEFAULT nextval('user_roles_user_role_id_seq'::regclass) NOT NULL,
  "user_id" integer NOT NULL,
  "role_id" integer NOT NULL,
  "assigned_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "assigned_by" integer,
  "expires_at" timestamp without time zone
);

CREATE TABLE "public"."users" (
  "user_id" integer DEFAULT nextval('users_user_id_seq'::regclass) NOT NULL,
  "entra_object_id" character varying(50),
  "email" character varying(256) NOT NULL,
  "display_name" character varying(200),
  "user_type" character varying(20) DEFAULT 'Internal'::character varying NOT NULL,
  "password_hash" bytea,
  "password_salt" bytea,
  "invite_token" character varying(256),
  "invite_token_expires_at" timestamp(3) without time zone,
  "created_at" timestamp(3) without time zone DEFAULT (now() AT TIME ZONE 'UTC'::text) NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL
);

CREATE TABLE "public"."file_uploads" (
  "file_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "container" text NOT NULL,
  "blob_name" text NOT NULL UNIQUE,
  "original_name" text NOT NULL,
  "mime_type" text,
  "size_bytes" bigint NOT NULL,
  "sha256" text,
  "etag" text,
  "status" text NOT NULL DEFAULT 'active',
  "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" timestamptz,
  "uploaded_by" integer NOT NULL,
  "session_token" text,
  "response_id" integer,
  "form_field_id" integer,
  CONSTRAINT "chk_file_uploads_status" CHECK (status IN ('active', 'replaced', 'deleted'))
);

CREATE TABLE "public"."workflows" (
  "workflow_id" serial PRIMARY KEY,
  "workflow_key" character varying(100) UNIQUE,
  "title" character varying(255) NOT NULL,
  "description" text,
  "status" character varying(20) NOT NULL DEFAULT 'active',
  "created_by" integer,
  "created_at" timestamp without time zone NOT NULL DEFAULT NOW(),
  "updated_at" timestamp without time zone NOT NULL DEFAULT NOW()
);

CREATE TABLE "public"."workflow_forms" (
  "workflow_form_id" serial PRIMARY KEY,
  "workflow_id" integer NOT NULL,
  "form_id" integer NOT NULL,
  "required" boolean NOT NULL DEFAULT TRUE,
  "default_name" TEXT,
  "allow_multiple" boolean NOT NULL DEFAULT FALSE,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp without time zone NOT NULL DEFAULT NOW(),
  "updated_at" timestamp without time zone NOT NULL DEFAULT NOW()
);

CREATE TABLE "public"."workflow_runs" (
  "workflow_run_id" serial PRIMARY KEY,
  "workflow_id" integer NOT NULL,
  "display_name" character varying(255) NOT NULL,
  "status" character varying(20) NOT NULL DEFAULT 'not_started',
  "locked_at" timestamp without time zone,
  "locked_by" integer,
  "created_by" integer,
  "cancelled_at" timestamp without time zone,
  "cancelled_reason" text,
  "created_at" timestamp without time zone NOT NULL DEFAULT NOW(),
  "updated_at" timestamp without time zone NOT NULL DEFAULT NOW(),
  CONSTRAINT "workflow_runs_status_chk" CHECK (status IN ('not_started','in_progress','completed','cancelled'))
);

CREATE TABLE "public"."workflow_items" (
  "workflow_item_id" serial PRIMARY KEY,
  "workflow_run_id" integer NOT NULL,
  "workflow_form_id" integer NOT NULL,
  "display_name" text,
  "sequence_num" integer NOT NULL DEFAULT 1,
  "status" character varying(20) NOT NULL DEFAULT 'not_started',
  "assigned_user_id" integer,
  "skipped_reason" text,
  "completed_at" timestamp without time zone,
  "created_at" timestamp without time zone NOT NULL DEFAULT NOW(),
  "updated_at" timestamp without time zone NOT NULL DEFAULT NOW(),
  CONSTRAINT "workflow_items_status_chk" CHECK (status IN ('not_started','in_progress','submitted','skipped'))
);

CREATE TABLE IF NOT EXISTS "public"."options_jobs" (
  "job_id" uuid PRIMARY KEY,
  "form_key" character varying(120) NOT NULL,
  "field_id" integer NOT NULL,
  "requester_user_id" integer NULL,
  "requester_email" character varying(400) NULL,
  "requester_type" character varying(20) NULL,
  "callback_token" character varying(128) NOT NULL,
  "status" character varying(20) NOT NULL DEFAULT 'pending',
  "created_at" timestamp without time zone DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL,
  "completed_at" timestamp without time zone NULL,
  "last_error" text NULL
);

CREATE TABLE "public"."settings" (
  "property" character varying(100) PRIMARY KEY,
  "value" text,
  "meta" jsonb,
  "last_updated" timestamp with time zone DEFAULT NOW(),
  "updated_by" integer
);

CREATE TABLE audit_logs (
  id              BIGSERIAL PRIMARY KEY,
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  user_id         TEXT,                        -- account.localAccountId (OID)
  username        TEXT,                        -- account.username / UPN
  user_name       TEXT,                        -- account.name (display name)
  ip_address      INET,

  http_method     TEXT NOT NULL,               -- POST, PUT, PATCH, DELETE
  route           TEXT NOT NULL,               -- /api/forms/123
  resource_type   TEXT,                        -- "forms", "responses", etc.
  resource_id     TEXT,                        -- parsed from URL
  sub_resource_id TEXT,
  auth_source     TEXT,
  request_body    JSONB,                       -- sanitized body (no passwords)
  response_status INTEGER,
  
  session_id      TEXT,
  user_agent      TEXT
);

-- Indexes for common query patterns
CREATE INDEX idx_audit_user_id    ON audit_logs(user_id);
CREATE INDEX idx_audit_timestamp  ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_resource   ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_route      ON audit_logs(route);

-- ------------------------------------------------------------------
-- Link sequences to their owning columns
-- ------------------------------------------------------------------
ALTER SEQUENCE "public"."fieldoptions_option_id_seq" OWNED BY "public"."fieldoptions"."option_id";
ALTER SEQUENCE "public"."form_access_form_access_id_seq" OWNED BY "public"."form_access"."form_access_id";
ALTER SEQUENCE "public"."formfields_field_id_seq" OWNED BY "public"."formfields"."field_id";
ALTER SEQUENCE "public"."forms_form_id_seq" OWNED BY "public"."forms"."form_id";
ALTER SEQUENCE "public"."formsessions_session_id_seq" OWNED BY "public"."formsessions"."session_id";
ALTER SEQUENCE "public"."formsteps_step_id_seq" OWNED BY "public"."formsteps"."step_id";
ALTER SEQUENCE "public"."permissions_permission_id_seq" OWNED BY "public"."permissions"."permission_id";
ALTER SEQUENCE "public"."responses_response_id_seq" OWNED BY "public"."responses"."response_id";
ALTER SEQUENCE "public"."responsevalueoptions_response_value_option_id_seq" OWNED BY "public"."responsevalueoptions"."response_value_option_id";
ALTER SEQUENCE "public"."responsevalues_response_value_id_seq" OWNED BY "public"."responsevalues"."response_value_id";
ALTER SEQUENCE "public"."role_permissions_role_permission_id_seq" OWNED BY "public"."role_permissions"."role_permission_id";
ALTER SEQUENCE "public"."roles_role_id_seq" OWNED BY "public"."roles"."role_id";
ALTER SEQUENCE "public"."user_roles_user_role_id_seq" OWNED BY "public"."user_roles"."user_role_id";
ALTER SEQUENCE "public"."users_user_id_seq" OWNED BY "public"."users"."user_id";

-- ------------------------------------------------------------------
-- Constraints (PK/UNIQUE/CHECK first, then FKs)
-- ------------------------------------------------------------------

-- PK / UNIQUE / CHECK
ALTER TABLE "public"."users"
  ADD CONSTRAINT "users_pkey" PRIMARY KEY (user_id);

ALTER TABLE "public"."users"
  ADD CONSTRAINT "users_email_key" UNIQUE (email);

ALTER TABLE "public"."users"
  ADD CONSTRAINT "ck_users_usertype"
  CHECK (user_type::text = ANY (ARRAY['Internal'::character varying, 'External'::character varying]::text[]));

ALTER TABLE "public"."roles"
  ADD CONSTRAINT "roles_pkey" PRIMARY KEY (role_id);

ALTER TABLE "public"."permissions"
  ADD CONSTRAINT "permissions_pkey" PRIMARY KEY (permission_id);

ALTER TABLE "public"."role_permissions"
  ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY (role_permission_id);

ALTER TABLE "public"."role_permissions"
  ADD CONSTRAINT "uq_role_permission" UNIQUE (role_id, permission_id);

ALTER TABLE "public"."user_roles"
  ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY (user_role_id);

ALTER TABLE "public"."forms"
  ADD CONSTRAINT "forms_pkey" PRIMARY KEY (form_id);

ALTER TABLE "public"."forms"
  ADD CONSTRAINT "uq_forms_form_key" UNIQUE (form_key);

ALTER TABLE "public"."forms"
  ADD CONSTRAINT "forms_usage_mode_chk"
  CHECK (usage_mode::text = ANY (ARRAY['standalone'::character varying, 'workflow_only'::character varying, 'both'::character varying]::text[]));

ALTER TABLE "public"."formsteps"
  ADD CONSTRAINT "formsteps_pkey" PRIMARY KEY (step_id);

ALTER TABLE "public"."formsteps"
  ADD CONSTRAINT "uq_formsteps_form_number" UNIQUE (form_id, step_number);

ALTER TABLE "public"."formfields"
  ADD CONSTRAINT "formfields_pkey" PRIMARY KEY (field_id);

ALTER TABLE "public"."formfields"
  ADD CONSTRAINT "uq_formfields_form_key" UNIQUE (form_id, key_name);

ALTER TABLE "public"."fieldoptions"
  ADD CONSTRAINT "fieldoptions_pkey" PRIMARY KEY (option_id);

ALTER TABLE "public"."form_access"
  ADD CONSTRAINT "form_access_pkey" PRIMARY KEY (form_access_id);

ALTER TABLE "public"."formsessions"
  ADD CONSTRAINT "formsessions_pkey" PRIMARY KEY (session_id);

ALTER TABLE "public"."formsessions"
  ADD CONSTRAINT "formsessions_session_token_key" UNIQUE (session_token);

ALTER TABLE "public"."responses"
  ADD CONSTRAINT "responses_pkey" PRIMARY KEY (response_id);

ALTER TABLE "public"."responsevalues"
  ADD CONSTRAINT "responsevalues_pkey" PRIMARY KEY (response_value_id);

ALTER TABLE "public"."responsevalues"
  ADD CONSTRAINT "uq_responsevalues_response_field" UNIQUE (response_id, form_field_id);

ALTER TABLE "public"."responsevalueoptions"
  ADD CONSTRAINT "responsevalueoptions_pkey" PRIMARY KEY (response_value_option_id);

ALTER TABLE "public"."workflow_forms"
  ADD CONSTRAINT "uq_workflow_forms" UNIQUE (workflow_id, form_id);

ALTER TABLE "public"."workflow_items"
  ADD CONSTRAINT "uq_workflow_item_sequence" UNIQUE (workflow_run_id, workflow_form_id, sequence_num);

-- ============================================================================
-- FOREIGN KEYS WITH CASCADE DELETE BEHAVIOR
-- ============================================================================

-- ----------------------------------------------------------------------------
-- USERS CASCADE CHAIN
-- When a user is deleted:
--   - CASCADE: responses, file_uploads, form_access, user_roles
--   - SET NULL: forms (owner), formsessions, workflows, workflow_runs, etc.
-- ----------------------------------------------------------------------------

-- forms: SET NULL (form persists when owner deleted)
ALTER TABLE "public"."forms"
  ADD CONSTRAINT "fk_forms_owner"
  FOREIGN KEY (owner_user_id)
  REFERENCES "public"."users"(user_id) ON DELETE SET NULL;

-- responses: CASCADE (user's submissions deleted)
ALTER TABLE "public"."responses"
  ADD CONSTRAINT "fk_responses_users"
  FOREIGN KEY (user_id)
  REFERENCES "public"."users"(user_id) ON DELETE CASCADE;

-- formsessions: SET NULL (sessions continue to exist)
ALTER TABLE "public"."formsessions"
  ADD CONSTRAINT "fk_formsessions_users"
  FOREIGN KEY (user_id)
  REFERENCES "public"."users"(user_id) ON DELETE SET NULL;

-- form_access: CASCADE (access grants removed)
ALTER TABLE "public"."form_access"
  ADD CONSTRAINT "fk_form_access_user"
  FOREIGN KEY (user_id)
  REFERENCES "public"."users"(user_id) ON DELETE CASCADE;

ALTER TABLE "public"."form_access"
  ADD CONSTRAINT "fk_form_access_granted_by"
  FOREIGN KEY (granted_by)
  REFERENCES "public"."users"(user_id) ON DELETE SET NULL;

-- user_roles: CASCADE (role assignments removed)
ALTER TABLE "public"."user_roles"
  ADD CONSTRAINT "fk_user_roles_user"
  FOREIGN KEY (user_id)
  REFERENCES "public"."users"(user_id) ON DELETE CASCADE;

ALTER TABLE "public"."user_roles"
  ADD CONSTRAINT "fk_user_roles_assigned_by"
  FOREIGN KEY (assigned_by)
  REFERENCES "public"."users"(user_id) ON DELETE SET NULL;

-- file_uploads: CASCADE (files uploaded by user deleted)
ALTER TABLE "public"."file_uploads"
  ADD CONSTRAINT "fk_file_uploads_uploaded_by"
  FOREIGN KEY (uploaded_by)
  REFERENCES "public"."users"(user_id) ON DELETE CASCADE;

-- settings: SET NULL (settings persist when user is deleted)
ALTER TABLE "public"."settings"
  ADD CONSTRAINT "fk_settings_updated_by"
  FOREIGN KEY (updated_by)
  REFERENCES "public"."users"(user_id) ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- FORMS CASCADE CHAIN
-- When a form is deleted, cascade to all dependent objects
-- ----------------------------------------------------------------------------

-- formfields: CASCADE (fields belong to form)
ALTER TABLE "public"."formfields"
  ADD CONSTRAINT "fk_formfields_forms"
  FOREIGN KEY (form_id)
  REFERENCES "public"."forms"(form_id) ON DELETE CASCADE;

-- formsteps: CASCADE (steps belong to form)
ALTER TABLE "public"."formsteps"
  ADD CONSTRAINT "fk_formsteps_forms"
  FOREIGN KEY (form_id)
  REFERENCES "public"."forms"(form_id) ON DELETE CASCADE;

-- form_access: CASCADE (access records deleted)
ALTER TABLE "public"."form_access"
  ADD CONSTRAINT "fk_form_access_form"
  FOREIGN KEY (form_id)
  REFERENCES "public"."forms"(form_id) ON DELETE CASCADE;

-- formsessions: CASCADE (sessions deleted)
ALTER TABLE "public"."formsessions"
  ADD CONSTRAINT "fk_formsessions_forms"
  FOREIGN KEY (form_id)
  REFERENCES "public"."forms"(form_id) ON DELETE CASCADE;

-- responses: CASCADE (all responses deleted)
ALTER TABLE "public"."responses"
  ADD CONSTRAINT "fk_responses_forms"
  FOREIGN KEY (form_id)
  REFERENCES "public"."forms"(form_id) ON DELETE CASCADE;

-- workflow_forms: CASCADE (workflow-form associations deleted)
ALTER TABLE "public"."workflow_forms"
  ADD CONSTRAINT "fk_workflow_forms_form"
  FOREIGN KEY (form_id)
  REFERENCES "public"."forms"(form_id) ON DELETE CASCADE;

-- ----------------------------------------------------------------------------
-- FORMFIELDS CASCADE CHAIN
-- When a formfield is deleted, cascade to options and file uploads
-- ----------------------------------------------------------------------------

-- fieldoptions: CASCADE (options belong to formfield)
ALTER TABLE "public"."fieldoptions"
  ADD CONSTRAINT "fk_fieldoptions_formfields"
  FOREIGN KEY (form_field_id)
  REFERENCES "public"."formfields"(field_id) ON DELETE CASCADE;

-- formfields -> formsteps: SET NULL (field can exist without step)
ALTER TABLE "public"."formfields"
  ADD CONSTRAINT "fk_formfields_formsteps"
  FOREIGN KEY (form_step_id)
  REFERENCES "public"."formsteps"(step_id) ON DELETE SET NULL;

-- responsevalues -> formfields: CASCADE (response values deleted with field)
ALTER TABLE "public"."responsevalues"
  ADD CONSTRAINT "fk_responsevalues_formfields"
  FOREIGN KEY (form_field_id)
  REFERENCES "public"."formfields"(field_id) ON DELETE CASCADE;

-- file_uploads -> formfields: CASCADE (files linked to field deleted)
ALTER TABLE "public"."file_uploads"
  ADD CONSTRAINT "fk_file_uploads_formfield"
  FOREIGN KEY (form_field_id)
  REFERENCES "public"."formfields"(field_id) ON DELETE CASCADE;

-- ----------------------------------------------------------------------------
-- RESPONSES CASCADE CHAIN
-- When a response is deleted, cascade to values and options
-- ----------------------------------------------------------------------------

-- responsevalues: CASCADE (values belong to response)
ALTER TABLE "public"."responsevalues"
  ADD CONSTRAINT "fk_responsevalues_responses"
  FOREIGN KEY (response_id)
  REFERENCES "public"."responses"(response_id) ON DELETE CASCADE;

-- responses -> sessions: SET NULL (response persists when session deleted)
ALTER TABLE "public"."responses"
  ADD CONSTRAINT "fk_responses_sessions"
  FOREIGN KEY (session_id)
  REFERENCES "public"."formsessions"(session_id) ON DELETE SET NULL;

-- file_uploads -> responses: CASCADE (files linked to response deleted)
ALTER TABLE "public"."file_uploads"
  ADD CONSTRAINT "fk_file_uploads_response"
  FOREIGN KEY (response_id)
  REFERENCES "public"."responses"(response_id) ON DELETE CASCADE;

-- ----------------------------------------------------------------------------
-- RESPONSEVALUES CASCADE CHAIN
-- ----------------------------------------------------------------------------

-- responsevalueoptions: CASCADE (options belong to response value)
ALTER TABLE "public"."responsevalueoptions"
  ADD CONSTRAINT "fk_rvo_responsevalues"
  FOREIGN KEY (response_value_id)
  REFERENCES "public"."responsevalues"(response_value_id) ON DELETE CASCADE;

-- responsevalueoptions -> fieldoptions: SET NULL (option reference cleared)
ALTER TABLE "public"."responsevalueoptions"
  ADD CONSTRAINT "fk_rvo_fieldoptions"
  FOREIGN KEY (field_option_id)
  REFERENCES "public"."fieldoptions"(option_id) ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- ROLES & PERMISSIONS CASCADE CHAIN
-- ----------------------------------------------------------------------------

-- role_permissions: CASCADE (permissions removed with role)
ALTER TABLE "public"."role_permissions"
  ADD CONSTRAINT "fk_role_permissions_role"
  FOREIGN KEY (role_id)
  REFERENCES "public"."roles"(role_id) ON DELETE CASCADE;

ALTER TABLE "public"."role_permissions"
  ADD CONSTRAINT "fk_role_permissions_permission"
  FOREIGN KEY (permission_id)
  REFERENCES "public"."permissions"(permission_id) ON DELETE CASCADE;

ALTER TABLE "public"."role_permissions"
  ADD CONSTRAINT "fk_role_permissions_granted_by"
  FOREIGN KEY (granted_by)
  REFERENCES "public"."users"(user_id) ON DELETE SET NULL;

-- user_roles: CASCADE (handled above in USERS section)
ALTER TABLE "public"."user_roles"
  ADD CONSTRAINT "fk_user_roles_role"
  FOREIGN KEY (role_id)
  REFERENCES "public"."roles"(role_id) ON DELETE CASCADE;

-- ----------------------------------------------------------------------------
-- WORKFLOWS CASCADE CHAIN
-- When a workflow is deleted, cascade to runs and forms
-- ----------------------------------------------------------------------------

-- workflows: created_by SET NULL
ALTER TABLE "public"."workflows"
  ADD CONSTRAINT "fk_workflows_created_by"
  FOREIGN KEY (created_by)
  REFERENCES "public"."users"(user_id) ON DELETE SET NULL;

-- workflow_forms: CASCADE from workflow (handled above in FORMS section)
ALTER TABLE "public"."workflow_forms"
  ADD CONSTRAINT "fk_workflow_forms_workflow"
  FOREIGN KEY (workflow_id)
  REFERENCES "public"."workflows"(workflow_id) ON DELETE CASCADE;

-- workflow_runs: CASCADE (runs deleted with workflow)
ALTER TABLE "public"."workflow_runs"
  ADD CONSTRAINT "fk_workflow_runs_workflow"
  FOREIGN KEY (workflow_id)
  REFERENCES "public"."workflows"(workflow_id) ON DELETE CASCADE;

ALTER TABLE "public"."workflow_runs"
  ADD CONSTRAINT "fk_workflow_runs_locked_by"
  FOREIGN KEY (locked_by)
  REFERENCES "public"."users"(user_id) ON DELETE SET NULL;

ALTER TABLE "public"."workflow_runs"
  ADD CONSTRAINT "fk_workflow_runs_created_by"
  FOREIGN KEY (created_by)
  REFERENCES "public"."users"(user_id) ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- WORKFLOW_RUNS CASCADE CHAIN
-- When a workflow run is deleted, cascade to items
-- ----------------------------------------------------------------------------

-- workflow_items: CASCADE (items belong to run)
ALTER TABLE "public"."workflow_items"
  ADD CONSTRAINT "fk_workflow_items_run"
  FOREIGN KEY (workflow_run_id)
  REFERENCES "public"."workflow_runs"(workflow_run_id) ON DELETE CASCADE;

ALTER TABLE "public"."workflow_items"
  ADD CONSTRAINT "fk_workflow_items_workflow_form"
  FOREIGN KEY (workflow_form_id)
  REFERENCES "public"."workflow_forms"(workflow_form_id) ON DELETE CASCADE;

ALTER TABLE "public"."workflow_items"
  ADD CONSTRAINT "fk_workflow_items_assigned_user"
  FOREIGN KEY (assigned_user_id)
  REFERENCES "public"."users"(user_id) ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- WORKFLOW REFERENCES IN FORMSESSIONS AND RESPONSES
-- These should SET NULL to preserve sessions/responses when workflow deleted
-- ----------------------------------------------------------------------------

ALTER TABLE "public"."formsessions"
  ADD CONSTRAINT "fk_formsessions_workflow_run"
  FOREIGN KEY (workflow_run_id)
  REFERENCES "public"."workflow_runs"(workflow_run_id) ON DELETE SET NULL;

ALTER TABLE "public"."formsessions"
  ADD CONSTRAINT "fk_formsessions_workflow_item"
  FOREIGN KEY (workflow_item_id)
  REFERENCES "public"."workflow_items"(workflow_item_id) ON DELETE SET NULL;

ALTER TABLE "public"."responses"
  ADD CONSTRAINT "fk_responses_workflow_run"
  FOREIGN KEY (workflow_run_id)
  REFERENCES "public"."workflow_runs"(workflow_run_id) ON DELETE SET NULL;

ALTER TABLE "public"."responses"
  ADD CONSTRAINT "fk_responses_workflow_item"
  FOREIGN KEY (workflow_item_id)
  REFERENCES "public"."workflow_items"(workflow_item_id) ON DELETE SET NULL;

-- ------------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------------
CREATE INDEX idx_file_uploads_uploaded_by ON public.file_uploads USING btree (uploaded_by);
CREATE INDEX idx_file_uploads_status ON public.file_uploads USING btree (status);
CREATE INDEX idx_file_uploads_created_at ON public.file_uploads USING btree (created_at DESC);
CREATE INDEX idx_file_uploads_sha256 ON public.file_uploads USING btree (sha256) WHERE (sha256 IS NOT NULL);
CREATE INDEX idx_file_uploads_response ON public.file_uploads USING btree (response_id) WHERE (response_id IS NOT NULL);
CREATE INDEX idx_file_uploads_formfield ON public.file_uploads USING btree (form_field_id) WHERE (form_field_id IS NOT NULL);

CREATE INDEX ix_fieldoptions_field ON public.fieldoptions USING btree (form_field_id);
CREATE INDEX ix_form_access_form ON public.form_access USING btree (form_id);
CREATE INDEX ix_form_access_user ON public.form_access USING btree (user_id);
CREATE INDEX ix_formfields_form ON public.formfields USING btree (form_id);
CREATE INDEX ix_formfields_step ON public.formfields USING btree (form_step_id) WHERE (form_step_id IS NOT NULL);
CREATE INDEX ix_forms_owner ON public.forms USING btree (owner_user_id) WHERE (owner_user_id IS NOT NULL);
CREATE INDEX idx_forms_status ON public.forms USING btree (status);
CREATE INDEX idx_forms_form_key ON public.forms USING btree (form_key) WHERE (form_key IS NOT NULL);
CREATE INDEX ix_formsessions_expires ON public.formsessions USING btree (expires_at) WHERE (expires_at IS NOT NULL);
CREATE INDEX ix_formsessions_form ON public.formsessions USING btree (form_id);
CREATE INDEX ix_formsessions_token ON public.formsessions USING btree (session_token);
CREATE INDEX ix_formsessions_user ON public.formsessions USING btree (user_id) WHERE (user_id IS NOT NULL);
CREATE INDEX ix_formsessions_workflow_run ON public.formsessions USING btree (workflow_run_id) WHERE (workflow_run_id IS NOT NULL);
CREATE INDEX ix_formsessions_workflow_item ON public.formsessions USING btree (workflow_item_id) WHERE (workflow_item_id IS NOT NULL);
CREATE UNIQUE INDEX uq_active_session_user_form ON public.formsessions USING btree (user_id, form_id) WHERE (is_active = true);
CREATE UNIQUE INDEX uq_formsessions_one_open_per_user_form ON public.formsessions USING btree (user_id, form_id) WHERE (is_completed = false);
CREATE INDEX ix_formsteps_form_sort ON public.formsteps USING btree (form_id, sort_order);
CREATE UNIQUE INDEX idx_permissions_code ON public.permissions USING btree (permission_code);
CREATE INDEX idx_permissions_resource_action ON public.permissions USING btree (resource, action);
CREATE INDEX ix_responses_form_time ON public.responses USING btree (form_id, submitted_at DESC);
CREATE INDEX ix_responses_session ON public.responses USING btree (session_id);
CREATE INDEX ix_responses_workflow_run ON public.responses USING btree (workflow_run_id) WHERE (workflow_run_id IS NOT NULL);
CREATE INDEX ix_responses_workflow_item ON public.responses USING btree (workflow_item_id) WHERE (workflow_item_id IS NOT NULL);
CREATE UNIQUE INDEX uq_responses_session_id ON public.responses USING btree (session_id);
CREATE INDEX ix_rvo_fieldoption ON public.responsevalueoptions USING btree (field_option_id);
CREATE UNIQUE INDEX uq_rvo_response_value ON public.responsevalueoptions USING btree (response_value_id, option_value);
CREATE INDEX ix_responsevalues_bool ON public.responsevalues USING btree (form_field_id, value_bool) WHERE (value_bool IS NOT NULL);
CREATE INDEX ix_responsevalues_date ON public.responsevalues USING btree (form_field_id, value_date) WHERE (value_date IS NOT NULL);
CREATE INDEX ix_responsevalues_dt ON public.responsevalues USING btree (form_field_id, value_datetime) WHERE (value_datetime IS NOT NULL);
CREATE INDEX ix_responsevalues_field ON public.responsevalues USING btree (form_field_id);
CREATE INDEX ix_responsevalues_number ON public.responsevalues USING btree (form_field_id, value_number) WHERE (value_number IS NOT NULL);
CREATE INDEX ix_responsevalues_response ON public.responsevalues USING btree (response_id);
CREATE INDEX idx_role_permissions_granted_by ON public.role_permissions USING btree (granted_by);
CREATE INDEX idx_role_permissions_permission ON public.role_permissions USING btree (permission_id);
CREATE UNIQUE INDEX idx_role_permissions_unique ON public.role_permissions USING btree (role_id, permission_id);
CREATE INDEX idx_roles_active ON public.roles USING btree (is_active);
CREATE UNIQUE INDEX idx_roles_code ON public.roles USING btree (role_code);
CREATE INDEX idx_roles_name ON public.roles USING btree (role_name);
CREATE INDEX idx_user_roles_assigned_by ON public.user_roles USING btree (assigned_by);
CREATE INDEX idx_user_roles_expires ON public.user_roles USING btree (expires_at) WHERE (expires_at IS NOT NULL);
CREATE INDEX idx_user_roles_role ON public.user_roles USING btree (role_id);
CREATE UNIQUE INDEX idx_user_roles_unique ON public.user_roles USING btree (user_id, role_id);
CREATE INDEX idx_user_roles_user_active ON public.user_roles USING btree (user_id, assigned_at DESC);
CREATE INDEX idx_users_active_created ON public.users USING btree (is_active, created_at DESC);
CREATE UNIQUE INDEX idx_users_entra_object_id ON public.users USING btree (entra_object_id) WHERE (entra_object_id IS NOT NULL);
CREATE INDEX idx_users_is_active ON public.users USING btree (is_active);

CREATE INDEX idx_workflows_status ON public.workflows USING btree (status);
CREATE INDEX idx_workflow_forms_workflow ON public.workflow_forms USING btree (workflow_id);
CREATE INDEX idx_workflow_forms_form ON public.workflow_forms USING btree (form_id);
CREATE INDEX idx_workflow_runs_workflow ON public.workflow_runs USING btree (workflow_id);
CREATE INDEX idx_workflow_runs_status ON public.workflow_runs USING btree (status);
CREATE INDEX idx_workflow_items_run ON public.workflow_items USING btree (workflow_run_id);
CREATE INDEX idx_workflow_items_assigned ON public.workflow_items USING btree (assigned_user_id);
CREATE INDEX idx_workflow_items_status ON public.workflow_items USING btree (status);

CREATE INDEX IF NOT EXISTS ix_options_jobs_field_status ON public.options_jobs USING btree (field_id, status);
CREATE INDEX IF NOT EXISTS ix_options_jobs_created ON public.options_jobs USING btree (created_at);

-- ------------------------------------------------------------------
-- RBAC Bootstrap Seed (idempotent inserts)
-- ------------------------------------------------------------------
INSERT INTO public.roles (role_name, role_code, description, is_system_role, is_active, created_at, updated_at)
SELECT v.role_name, v.role_code, v.description, v.is_system_role, v.is_active, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
  VALUES
    ('Super Admin', 'SUPER_ADMIN', 'Full access to everything', TRUE, TRUE),
    ('Admin',       'ADMIN',       'Admin access',              TRUE, TRUE),
    ('User',        'USER',        'Standard user access',      TRUE, TRUE)
) AS v(role_name, role_code, description, is_system_role, is_active)
WHERE NOT EXISTS (
  SELECT 1 FROM public.roles r WHERE r.role_code = v.role_code
);

INSERT INTO public.permissions
(permission_name, permission_code, description, resource, action, created_at, updated_at)
SELECT v.permission_name, v.permission_code, v.description, v.resource, v.action, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
  VALUES
    -- USERS
    ('Create Users', 'users.create', 'Can create users', 'users', 'create'),
    ('Read Users',   'users.read',   'Can view users',   'users', 'read'),
    ('Update Users', 'users.update', 'Can update users', 'users', 'update'),
    ('Delete Users', 'users.delete', 'Can delete users', 'users', 'delete'),

    -- ROLES
    ('Create Roles', 'roles.create', 'Can create roles', 'roles', 'create'),
    ('Read Roles',   'roles.read',   'Can view roles',   'roles', 'read'),
    ('Update Roles', 'roles.update', 'Can update roles', 'roles', 'update'),
    ('Delete Roles', 'roles.delete', 'Can delete roles', 'roles', 'delete'),

    -- SETTINGS
    ('Read Settings', 'settings.read', 'Can view application settings', 'settings', 'read'),
    ('Update Settings', 'settings.update', 'Can update application settings', 'settings', 'update'),
    ('Execute Raw SQL', 'settings.query', 'Can execute raw SQL queries against the DB', 'settings', 'query'),

    -- FORMS
    ('Create Forms', 'forms.create', 'Can create forms', 'forms', 'create'),
    ('Read Forms',   'forms.read',   'Can view forms',   'forms', 'read'),
    ('Update Forms', 'forms.update', 'Can update forms', 'forms', 'update'),
    ('Delete Forms', 'forms.delete', 'Can delete forms', 'forms', 'delete'),

    -- RESPONSES
    ('Read all Responses', 'responses.readAll', 'Can read all responses', 'responses', 'readAll'),
    ('Read Responses',     'responses.read',    'Can view responses',      'responses', 'read'),
    ('Create Responses',   'responses.create',  'Can create responses',    'responses', 'create'),
    ('Update Responses',   'responses.update',  'Can update responses',    'responses', 'update'),

    -- REPORTS
    ('Create Reports', 'reports.create', 'Can create reports', 'reports', 'create'),
    ('Read Reports',   'reports.read',   'Can view reports',   'reports', 'read'),
    ('Update Reports', 'reports.update', 'Can update reports', 'reports', 'update'),
    ('Delete Reports', 'reports.delete', 'Can delete reports', 'reports', 'delete'),

    -- WORKFLOWS
    ('Read Workflows', 'workflows.read', 'Can view workflow templates', 'workflows', 'read'),
    ('Create Workflows', 'workflows.create', 'Can create Workflows', 'workflows', 'create'),

    ('Create Workflow Run', 'workflows.run.create', 'Can start workflow runs', 'workflow_runs', 'create'),
    ('List Workflow Runs',  'workflows.run.list',   'Can list workflow runs',  'workflow_runs', 'read'),
    ('Lock Workflow Run',   'workflows.run.lock',   'Can lock workflow runs',  'workflow_runs', 'lock'),
    ('Cancel Workflow Run', 'workflows.run.cancel', 'Can cancel workflow runs','workflow_runs', 'cancel'),
    ('View Workflow Run', 'workflows.run.view', 'Can View Workflow Run', 'workflow_runs', 'view'),

    ('Start Workflow Item', 'workflows.item.start',  'Can start workflow items',  'workflow_items', 'start'),
    ('Skip Workflow Item',  'workflows.item.skip',   'Can skip workflow items',   'workflow_items', 'skip'),
    ('Assign Workflow Item','workflows.item.assign', 'Can assign workflow items', 'workflow_items', 'assign'),
    ('Add Workflow Item',   'workflows.item.add',    'Can add repeatable workflow items', 'workflow_items', 'add')

) AS v(permission_name, permission_code, description, resource, action)
WHERE NOT EXISTS (
  SELECT 1 FROM public.permissions p WHERE p.permission_code = v.permission_code
);


-- SUPER_ADMIN gets everything
INSERT INTO public.role_permissions (role_id, permission_id, granted_at, granted_by)
SELECT r.role_id, p.permission_id, CURRENT_TIMESTAMP, NULL
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.role_code = 'SUPER_ADMIN'
ON CONFLICT ON CONSTRAINT uq_role_permission DO NOTHING;

-- ADMIN selected permissions
INSERT INTO public.role_permissions (role_id, permission_id, granted_at, granted_by)
SELECT r.role_id, p.permission_id, NOW(), NULL
FROM public.roles r
JOIN public.permissions p ON p.permission_code IN (
  'users.create','users.read','users.update',
  'roles.create','roles.read','roles.update',
  'forms.read','forms.create','forms.update',
  'responses.read','responses.create','responses.update',
  'reports.read','reports.create','reports.update',
  'workflows.read',
  'workflows.run.view',
  'workflows.run.create',
  'workflows.run.list',
  'workflows.run.lock',
  'workflows.run.cancel',
  'workflows.item.start',
  'workflows.item.skip',
  'workflows.item.assign',
  'workflows.item.add'
)
WHERE r.role_code = 'ADMIN'
ON CONFLICT ON CONSTRAINT uq_role_permission DO NOTHING;

-- USER selected permissions
INSERT INTO public.role_permissions (role_id, permission_id, granted_at, granted_by)
SELECT r.role_id, p.permission_id, NOW(), NULL
FROM public.roles r
JOIN public.permissions p ON p.permission_code IN (
  'forms.read',
  'responses.read',
  'responses.create',
  'responses.update',
  'workflows.item.start'
)
WHERE r.role_code = 'USER'
ON CONFLICT ON CONSTRAINT uq_role_permission DO NOTHING;

-- Optional: Assign SUPER_ADMIN to a user by email (only works if user exists already)
DO $$
DECLARE
  admin_email text := 'bruce.aggarwal@predictiveit.com';
  admin_user_id int;
  super_role_id int;
BEGIN
  SELECT user_id INTO admin_user_id
  FROM public.users
  WHERE lower(email) = lower(admin_email)
  LIMIT 1;

  SELECT role_id INTO super_role_id
  FROM public.roles
  WHERE role_code = 'SUPER_ADMIN'
  LIMIT 1;

  IF admin_user_id IS NULL THEN
    RAISE NOTICE 'No user found with email %, skipping user_roles insert.', admin_email;
    RETURN;
  END IF;

  IF super_role_id IS NULL THEN
    RAISE EXCEPTION 'SUPER_ADMIN role not found. Seed roles first.';
  END IF;

  INSERT INTO public.user_roles (user_id, role_id, assigned_at, assigned_by, expires_at)
  VALUES (admin_user_id, super_role_id, CURRENT_TIMESTAMP, NULL, NULL)
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Assigned SUPER_ADMIN to user_id % (email %).', admin_user_id, admin_email;
END $$;

-- mark migration applied
INSERT INTO public.schema_migrations (id) VALUES ('init_v1')
ON CONFLICT DO NOTHING;

-- Seed default Settings
INSERT INTO public.settings (property, value, meta) VALUES
  ('log_retention', '30', null),
  ('session_retention', '30', null),
  ('responses_retention', '30', null),
  ('default_from_email', 'noreply@example.com', null),
  ('maintenance_mode', 'false', null),
  ('enable_email_notifications', 'true', null),
  ('pending_session_reminder_days', '7', null),
  ('max_login_attempts', '5', null),
  ('dashboard_announcement', '', null)
ON CONFLICT DO NOTHING;

COMMIT;