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
  "rpa_header_key" text NOT NULL
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
  "is_active" boolean DEFAULT true NOT NULL
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
  "session_id" integer
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

-- FOREIGN KEYS
ALTER TABLE "public"."fieldoptions"
  ADD CONSTRAINT "fk_fieldoptions_formfields"
  FOREIGN KEY (form_field_id)
  REFERENCES "public"."formfields"(field_id);

ALTER TABLE "public"."form_access"
  ADD CONSTRAINT "fk_form_access_form"
  FOREIGN KEY (form_id)
  REFERENCES "public"."forms"(form_id) ON DELETE CASCADE;

ALTER TABLE "public"."form_access"
  ADD CONSTRAINT "fk_form_access_user"
  FOREIGN KEY (user_id)
  REFERENCES "public"."users"(user_id) ON DELETE CASCADE;

ALTER TABLE "public"."form_access"
  ADD CONSTRAINT "fk_form_access_granted_by"
  FOREIGN KEY (granted_by)
  REFERENCES "public"."users"(user_id) ON DELETE SET NULL;

ALTER TABLE "public"."formfields"
  ADD CONSTRAINT "fk_formfields_forms"
  FOREIGN KEY (form_id)
  REFERENCES "public"."forms"(form_id);

ALTER TABLE "public"."formfields"
  ADD CONSTRAINT "fk_formfields_formsteps"
  FOREIGN KEY (form_step_id)
  REFERENCES "public"."formsteps"(step_id) ON DELETE SET NULL;

ALTER TABLE "public"."forms"
  ADD CONSTRAINT "fk_forms_owner"
  FOREIGN KEY (owner_user_id)
  REFERENCES "public"."users"(user_id);

ALTER TABLE "public"."formsessions"
  ADD CONSTRAINT "fk_formsessions_forms"
  FOREIGN KEY (form_id)
  REFERENCES "public"."forms"(form_id) ON DELETE CASCADE;

ALTER TABLE "public"."formsessions"
  ADD CONSTRAINT "fk_formsessions_users"
  FOREIGN KEY (user_id)
  REFERENCES "public"."users"(user_id) ON DELETE SET NULL;

ALTER TABLE "public"."formsteps"
  ADD CONSTRAINT "fk_formsteps_forms"
  FOREIGN KEY (form_id)
  REFERENCES "public"."forms"(form_id) ON DELETE CASCADE;

ALTER TABLE "public"."responses"
  ADD CONSTRAINT "fk_responses_forms"
  FOREIGN KEY (form_id)
  REFERENCES "public"."forms"(form_id);

ALTER TABLE "public"."responses"
  ADD CONSTRAINT "fk_responses_sessions"
  FOREIGN KEY (session_id)
  REFERENCES "public"."formsessions"(session_id) ON DELETE SET NULL;

ALTER TABLE "public"."responses"
  ADD CONSTRAINT "fk_responses_users"
  FOREIGN KEY (user_id)
  REFERENCES "public"."users"(user_id);

ALTER TABLE "public"."responsevalues"
  ADD CONSTRAINT "fk_responsevalues_responses"
  FOREIGN KEY (response_id)
  REFERENCES "public"."responses"(response_id);

ALTER TABLE "public"."responsevalues"
  ADD CONSTRAINT "fk_responsevalues_formfields"
  FOREIGN KEY (form_field_id)
  REFERENCES "public"."formfields"(field_id);

ALTER TABLE "public"."responsevalueoptions"
  ADD CONSTRAINT "fk_rvo_responsevalues"
  FOREIGN KEY (response_value_id)
  REFERENCES "public"."responsevalues"(response_value_id) ON DELETE CASCADE;

ALTER TABLE "public"."responsevalueoptions"
  ADD CONSTRAINT "fk_rvo_fieldoptions"
  FOREIGN KEY (field_option_id)
  REFERENCES "public"."fieldoptions"(option_id) ON DELETE SET NULL;

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

ALTER TABLE "public"."user_roles"
  ADD CONSTRAINT "fk_user_roles_user"
  FOREIGN KEY (user_id)
  REFERENCES "public"."users"(user_id) ON DELETE CASCADE;

ALTER TABLE "public"."user_roles"
  ADD CONSTRAINT "fk_user_roles_role"
  FOREIGN KEY (role_id)
  REFERENCES "public"."roles"(role_id) ON DELETE CASCADE;

ALTER TABLE "public"."user_roles"
  ADD CONSTRAINT "fk_user_roles_assigned_by"
  FOREIGN KEY (assigned_by)
  REFERENCES "public"."users"(user_id) ON DELETE SET NULL;

ALTER TABLE forms
ADD COLUMN usage_mode VARCHAR(20) NOT NULL DEFAULT 'standalone';

-- Optional: enforce valid values (Postgres CHECK)
ALTER TABLE forms
ADD CONSTRAINT forms_usage_mode_chk
CHECK (usage_mode IN ('standalone', 'workflow_only', 'both'));

  
CREATE TABLE "public"."file_uploads" (
    file_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    container TEXT NOT NULL,
    blob_name TEXT NOT NULL UNIQUE,
    original_name TEXT NOT NULL,
    mime_type TEXT,
    size_bytes BIGINT NOT NULL,
    sha256 TEXT,
    etag TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'replaced', 'deleted')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    uploaded_by INT NOT NULL,
    session_token text,
    response_id bigint,
    form_field_id integer,
    
    -- Foreign key to users table
    CONSTRAINT fk_uploaded_by 
        FOREIGN KEY (uploaded_by) 
        REFERENCES users(user_id)
        ON DELETE RESTRICT
);

CREATE TABLE workflows (
  workflow_id SERIAL PRIMARY KEY,
  workflow_key VARCHAR(100) UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_by INTEGER REFERENCES users(user_id),
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workflows_status ON workflows(status);


-- 3) workflow_forms (template -> forms with rules)
CREATE TABLE workflow_forms (
  workflow_form_id SERIAL PRIMARY KEY,
  workflow_id INTEGER NOT NULL REFERENCES workflows(workflow_id) ON DELETE CASCADE,
  form_id INTEGER NOT NULL REFERENCES forms(form_id),
  required BOOLEAN NOT NULL DEFAULT TRUE,
  allow_multiple BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_workflow_forms UNIQUE (workflow_id, form_id)
);

CREATE INDEX idx_workflow_forms_workflow ON workflow_forms(workflow_id);
CREATE INDEX idx_workflow_forms_form ON workflow_forms(form_id);


-- 4) workflow_runs (instances)
CREATE TABLE workflow_runs (
  workflow_run_id SERIAL PRIMARY KEY,
  workflow_id INTEGER NOT NULL REFERENCES workflows(workflow_id),
  display_name VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'not_started',
  locked_at TIMESTAMP WITHOUT TIME ZONE,
  locked_by INTEGER REFERENCES users(user_id),
  created_by INTEGER REFERENCES users(user_id),
  cancelled_at TIMESTAMP WITHOUT TIME ZONE,
  cancelled_reason TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT workflow_runs_status_chk
    CHECK (status IN ('not_started','in_progress','completed','cancelled'))
);

CREATE INDEX idx_workflow_runs_workflow ON workflow_runs(workflow_id);
CREATE INDEX idx_workflow_runs_status ON workflow_runs(status);


-- 5) workflow_items (the actionable units)
CREATE TABLE workflow_items (
  workflow_item_id SERIAL PRIMARY KEY,
  workflow_run_id INTEGER NOT NULL REFERENCES workflow_runs(workflow_run_id) ON DELETE CASCADE,
  workflow_form_id INTEGER NOT NULL REFERENCES workflow_forms(workflow_form_id),
  sequence_num INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(20) NOT NULL DEFAULT 'not_started',
  assigned_user_id INTEGER REFERENCES users(user_id),
  skipped_reason TEXT,
  completed_at TIMESTAMP WITHOUT TIME ZONE,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT workflow_items_status_chk
    CHECK (status IN ('not_started','in_progress','submitted','skipped')),
  CONSTRAINT uq_workflow_item_sequence UNIQUE (workflow_run_id, workflow_form_id, sequence_num)
);

CREATE INDEX idx_workflow_items_run ON workflow_items(workflow_run_id);
CREATE INDEX idx_workflow_items_assigned ON workflow_items(assigned_user_id);
CREATE INDEX idx_workflow_items_status ON workflow_items(status);


-- 6) Link existing drafts/sessions to workflow context (nullable)
ALTER TABLE formsessions
ADD COLUMN workflow_run_id INTEGER REFERENCES workflow_runs(workflow_run_id),
ADD COLUMN workflow_item_id INTEGER REFERENCES workflow_items(workflow_item_id);

CREATE INDEX idx_formsessions_workflow_run ON formsessions(workflow_run_id);
CREATE INDEX idx_formsessions_workflow_item ON formsessions(workflow_item_id);


-- 7) Link existing responses to workflow context (nullable)
ALTER TABLE responses
ADD COLUMN workflow_run_id INTEGER REFERENCES workflow_runs(workflow_run_id),
ADD COLUMN workflow_item_id INTEGER REFERENCES workflow_items(workflow_item_id);

CREATE INDEX idx_responses_workflow_run ON responses(workflow_run_id);
CREATE INDEX idx_responses_workflow_item ON responses(workflow_item_id);

-- Indexes for common queries
CREATE INDEX idx_file_uploads_uploaded_by ON file_uploads(uploaded_by);
CREATE INDEX idx_file_uploads_status ON file_uploads(status);
CREATE INDEX idx_file_uploads_created_at ON file_uploads(created_at DESC);
CREATE INDEX idx_file_uploads_sha256 ON file_uploads(sha256) WHERE sha256 IS NOT NULL;

-- ------------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------------
CREATE INDEX ix_fieldoptions_field_sort ON public.fieldoptions USING btree (form_field_id, sort_order, option_id);
CREATE UNIQUE INDEX uq_fieldoptions_field_value ON public.fieldoptions USING btree (form_field_id, value);
CREATE INDEX idx_form_access_form ON public.form_access USING btree (form_id);
CREATE UNIQUE INDEX idx_form_access_unique ON public.form_access USING btree (form_id, user_id);
CREATE INDEX idx_form_access_user ON public.form_access USING btree (user_id);
CREATE INDEX ix_formfields_form_sort ON public.formfields USING btree (form_id, sort_order);
CREATE INDEX ix_formfields_step ON public.formfields USING btree (form_step_id);
CREATE INDEX ix_forms_status ON public.forms USING btree (status);
CREATE INDEX ix_formsessions_completed ON public.formsessions USING btree (is_completed, form_id);
CREATE INDEX ix_formsessions_expires ON public.formsessions USING btree (expires_at) WHERE (expires_at IS NOT NULL);
CREATE INDEX ix_formsessions_form ON public.formsessions USING btree (form_id);
CREATE INDEX ix_formsessions_token ON public.formsessions USING btree (session_token);
CREATE INDEX ix_formsessions_user ON public.formsessions USING btree (user_id) WHERE (user_id IS NOT NULL);
CREATE UNIQUE INDEX uq_active_session_user_form ON public.formsessions USING btree (user_id, form_id) WHERE (is_active = true);
CREATE UNIQUE INDEX uq_formsessions_one_open_per_user_form ON public.formsessions USING btree (user_id, form_id) WHERE (is_completed = false);
CREATE INDEX ix_formsteps_form_sort ON public.formsteps USING btree (form_id, sort_order);
CREATE UNIQUE INDEX idx_permissions_code ON public.permissions USING btree (permission_code);
CREATE INDEX idx_permissions_resource_action ON public.permissions USING btree (resource, action);
CREATE INDEX ix_responses_form_time ON public.responses USING btree (form_id, submitted_at DESC);
CREATE INDEX ix_responses_session ON public.responses USING btree (session_id);
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

    -- ======================
    -- WORKFLOWS (NEW)
    -- ======================

    ('Read Workflows', 'workflows.read', 'Can view workflow templates', 'workflows', 'read'),
    ('Create Workflows', 'workflows.create', 'Can create Workflows', 'workflows', 'create'),

    ('Create Workflow Run', 'workflows.run.create', 'Can start workflow runs', 'workflow_runs', 'create'),
    ('List Workflow Runs',  'workflows.run.list',   'Can list workflow runs',  'workflow_runs', 'read'),
    ('Lock Workflow Run',   'workflows.run.lock',   'Can lock workflow runs',  'workflow_runs', 'lock'),
    ('Cancel Workflow Run', 'workflows.run.cancel', 'Can cancel workflow runs','workflow_runs', 'cancel'),
    ('View Workflow Run', 'workflows.run.view', 'Can View Workflow Run', 'workflow_runs', 'view')

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
  'workflows.item.add',
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

  'workflows.read',
  'workflows.run.create',
  'workflows.run.list',
  'workflows.item.start',
  'workflows.item.skip'
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

COMMIT;
