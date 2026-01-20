
CREATE TABLE IF NOT EXISTS public.options_jobs (
  job_id uuid PRIMARY KEY,
  form_key varchar(120) NOT NULL,
  field_id integer NOT NULL,

  requester_user_id integer NULL,     
  requester_email varchar(400) NULL,
  requester_type varchar(20) NULL,     

  callback_token varchar(128) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'pending',  

  created_at timestamp without time zone DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL,
  completed_at timestamp without time zone NULL,

  last_error text NULL
);


CREATE INDEX IF NOT EXISTS ix_options_jobs_field_status
  ON public.options_jobs(field_id, status);

CREATE INDEX IF NOT EXISTS ix_options_jobs_created
  ON public.options_jobs(created_at);