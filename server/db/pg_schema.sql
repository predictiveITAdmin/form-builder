CREATE TABLE Users (
    user_id                 SERIAL PRIMARY KEY,
    entra_object_id         VARCHAR(50) NULL,
    email                   VARCHAR(256) NOT NULL UNIQUE,
    display_name            VARCHAR(200) NULL,
    user_type               VARCHAR(20) NOT NULL DEFAULT 'Internal',
    password_hash           BYTEA NULL,
    password_salt           BYTEA NULL,
    invite_token            VARCHAR(256) NULL,
    invite_token_expires_at TIMESTAMP(3) NULL,
    created_at              TIMESTAMP(3) NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    CONSTRAINT CK_Users_UserType
        CHECK (user_type IN ('Internal', 'External'))
);

CREATE TABLE Forms (
    form_id         SERIAL PRIMARY KEY,
    title           VARCHAR(300) NOT NULL,
    description     TEXT NULL,
    status          VARCHAR(32) NOT NULL DEFAULT 'Draft',
    owner_user_id   INTEGER NULL,
    is_anonymous    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP(3) NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    updated_at      TIMESTAMP(3) NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    rpa_webhook_url VARCHAR(1000) NULL,
    rpa_secret      VARCHAR(128) NULL,
    rpa_timeout_ms  INTEGER NOT NULL DEFAULT 8000,
    rpa_retry_count INTEGER NOT NULL DEFAULT 3,
    form_key        VARCHAR(120) NULL,
    CONSTRAINT FK_Forms_Owner
        FOREIGN KEY (owner_user_id) REFERENCES Users(user_id),
    CONSTRAINT UQ_Forms_form_key UNIQUE (form_key)
);

CREATE INDEX IX_Forms_status ON Forms(status);

CREATE TABLE FormFields (
    field_id        SERIAL PRIMARY KEY,
    form_id         INTEGER NOT NULL,
    key_name        VARCHAR(100) NOT NULL,
    label           VARCHAR(300) NOT NULL,
    help_text       VARCHAR(1000) NULL,
    field_type      VARCHAR(40) NOT NULL,
    required        BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    config_json     TEXT NULL,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP(3) NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    updated_at      TIMESTAMP(3) NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    form_step_id    INTEGER NULL,
    CONSTRAINT FK_FormFields_Forms
        FOREIGN KEY (form_id) REFERENCES Forms(form_id),
    CONSTRAINT UQ_FormFields_Form_Key UNIQUE (form_id, key_name)
);

ALTER TABLE FormFields
ADD CONSTRAINT FK_FormFields_FormSteps
FOREIGN KEY (step_id) REFERENCES FormSteps(step_id)
ON DELETE CASCADE;

CREATE INDEX ix_formfields_step_id ON FormFields(step_id);

CREATE INDEX IX_FormFields_Form_Sort ON FormFields(form_id, sort_order);

CREATE TABLE FieldOptions (
    option_id     SERIAL PRIMARY KEY,
    form_field_id INTEGER NOT NULL,
    value         VARCHAR(400) NOT NULL,
    label         VARCHAR(400) NOT NULL,
    is_default    BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order    INTEGER NOT NULL DEFAULT 0,
    source        VARCHAR(12) NOT NULL, 
    updated_at    TIMESTAMP(3) NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    CONSTRAINT FK_FieldOptions_FormFields
        FOREIGN KEY (form_field_id) REFERENCES FormFields(field_id)
);



CREATE UNIQUE INDEX UQ_FieldOptions_Field_Value
    ON FieldOptions(form_field_id, value);

CREATE INDEX IX_FieldOptions_Field_Sort
    ON FieldOptions(form_field_id, sort_order, option_id);

CREATE TABLE Responses (
    response_id  SERIAL PRIMARY KEY,
    form_id      INTEGER NOT NULL,
    user_id      INTEGER NULL,
    submitted_at TIMESTAMP(3) NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    client_ip    VARCHAR(64) NULL,
    user_agent   VARCHAR(512) NULL,
    meta_json    TEXT NULL,
    CONSTRAINT FK_Responses_Forms
        FOREIGN KEY (form_id) REFERENCES Forms(form_id),
    CONSTRAINT FK_Responses_Users
        FOREIGN KEY (user_id) REFERENCES Users(user_id)
);

CREATE INDEX IX_Responses_Form_Time ON Responses(form_id, submitted_at DESC);

CREATE TABLE ResponseValues (
    response_value_id SERIAL PRIMARY KEY,
    response_id       INTEGER NOT NULL,
    form_field_id     INTEGER NOT NULL,
    value_text        TEXT NULL,
    value_number      DECIMAL(38,10) NULL,
    value_date        DATE NULL,
    value_datetime    TIMESTAMP(3) NULL,
    value_bool        BOOLEAN NULL,
    created_at        TIMESTAMP(3) NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    CONSTRAINT UQ_ResponseValues_Response_Field UNIQUE (response_id, form_field_id),
    CONSTRAINT FK_ResponseValues_Responses
        FOREIGN KEY (response_id) REFERENCES Responses(response_id),
    CONSTRAINT FK_ResponseValues_FormFields
        FOREIGN KEY (form_field_id) REFERENCES FormFields(field_id)
);

CREATE TABLE ResponseValueOptions (
    response_value_option_id SERIAL PRIMARY KEY,
    response_value_id        INTEGER NOT NULL,
    field_option_id          INTEGER NULL,
    option_value             VARCHAR(400) NOT NULL,
    option_label             VARCHAR(400) NULL,
    created_at               TIMESTAMP(3) NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    CONSTRAINT FK_RVO_ResponseValues
        FOREIGN KEY (response_value_id)
        REFERENCES ResponseValues(response_value_id)
        ON DELETE CASCADE,
    CONSTRAINT FK_RVO_FieldOptions
        FOREIGN KEY (field_option_id)
        REFERENCES FieldOptions(option_id)
        ON DELETE SET NULL
);

CREATE UNIQUE INDEX UQ_RVO_Response_Value
    ON ResponseValueOptions(response_value_id, option_value);

CREATE INDEX IX_RVO_FieldOption
    ON ResponseValueOptions(field_option_id);

CREATE INDEX IX_ResponseValues_Response ON ResponseValues(response_id);
CREATE INDEX IX_ResponseValues_Field ON ResponseValues(form_field_id);

CREATE INDEX IX_ResponseValues_Number ON ResponseValues(form_field_id, value_number) 
    WHERE value_number IS NOT NULL;
CREATE INDEX IX_ResponseValues_Date ON ResponseValues(form_field_id, value_date) 
    WHERE value_date IS NOT NULL;
CREATE INDEX IX_ResponseValues_Dt ON ResponseValues(form_field_id, value_datetime) 
    WHERE value_datetime IS NOT NULL;
CREATE INDEX IX_ResponseValues_Bool ON ResponseValues(form_field_id, value_bool) 
    WHERE value_bool IS NOT NULL;

CREATE TABLE FormSessions (
    session_id          SERIAL PRIMARY KEY,
    form_id             INTEGER NOT NULL,
    user_id             INTEGER NULL,                -- NULL for anonymous forms
    session_token       VARCHAR(256) NOT NULL UNIQUE, -- For anonymous user tracking
    current_step        INTEGER NOT NULL DEFAULT 1,
    total_steps         INTEGER NOT NULL DEFAULT 1,
    is_completed        BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at          TIMESTAMP(3) NULL,           -- Session expiration
    client_ip           VARCHAR(64) NULL,
    user_agent          VARCHAR(512) NULL,
    created_at          TIMESTAMP(3) NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    updated_at          TIMESTAMP(3) NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    completed_at        TIMESTAMP(3) NULL,
    CONSTRAINT FK_FormSessions_Forms
        FOREIGN KEY (form_id) REFERENCES Forms(form_id)
        ON DELETE CASCADE,
    CONSTRAINT FK_FormSessions_Users
        FOREIGN KEY (user_id) REFERENCES Users(user_id)
        ON DELETE SET NULL
);

-- Indexes for efficient lookups
CREATE INDEX IX_FormSessions_Form ON FormSessions(form_id);
CREATE INDEX IX_FormSessions_User ON FormSessions(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IX_FormSessions_Token ON FormSessions(session_token);
CREATE INDEX IX_FormSessions_Expires ON FormSessions(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IX_FormSessions_Completed ON FormSessions(is_completed, form_id);

-- Table to define steps/pages for each form
CREATE TABLE FormSteps (
    step_id             SERIAL PRIMARY KEY,
    form_id             INTEGER NOT NULL,
    step_number         INTEGER NOT NULL,            -- Order of the step (1, 2, 3, etc.)
    step_title          VARCHAR(300) NOT NULL,
    step_description    TEXT NULL,
    sort_order          INTEGER NOT NULL DEFAULT 0,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMP(3) NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    updated_at          TIMESTAMP(3) NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    CONSTRAINT FK_FormSteps_Forms
        FOREIGN KEY (form_id) REFERENCES Forms(form_id)
        ON DELETE CASCADE,
    CONSTRAINT UQ_FormSteps_Form_Number UNIQUE (form_id, step_number)
);

CREATE INDEX IX_FormSteps_Form_Sort ON FormSteps(form_id, sort_order);

-- Link form fields to specific steps
ALTER TABLE FormFields ADD COLUMN form_step_id INTEGER NULL;

ALTER TABLE FormFields
ADD CONSTRAINT FK_FormFields_FormSteps
    FOREIGN KEY (form_step_id) REFERENCES FormSteps(step_id)
    ON DELETE SET NULL;

CREATE INDEX IX_FormFields_Step ON FormFields(form_step_id);

-- Table to store draft values for each session step
CREATE TABLE SessionStepData (
    session_step_data_id SERIAL PRIMARY KEY,
    session_id           INTEGER NOT NULL,
    step_number          INTEGER NOT NULL,
    form_field_id        INTEGER NOT NULL,
    value_text           TEXT NULL,
    value_number         DECIMAL(38,10) NULL,
    value_date           DATE NULL,
    value_datetime       TIMESTAMP(3) NULL,
    value_bool           BOOLEAN NULL,
    created_at           TIMESTAMP(3) NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    updated_at           TIMESTAMP(3) NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    CONSTRAINT FK_SessionStepData_Session
        FOREIGN KEY (session_id) REFERENCES FormSessions(session_id)
        ON DELETE CASCADE,
    CONSTRAINT FK_SessionStepData_Field
        FOREIGN KEY (form_field_id) REFERENCES FormFields(field_id)
        ON DELETE CASCADE,
    CONSTRAINT UQ_SessionStepData_Session_Field UNIQUE (session_id, form_field_id)
);

CREATE INDEX IX_SessionStepData_Session ON SessionStepData(session_id, step_number);
CREATE INDEX IX_SessionStepData_Field ON SessionStepData(form_field_id);


CREATE TABLE SessionStepOptions (
    session_step_option_id SERIAL PRIMARY KEY,
    session_step_data_id   INTEGER NOT NULL,
    field_option_id        INTEGER NULL,
    option_value           VARCHAR(400) NOT NULL,
    option_label           VARCHAR(400) NULL,
    created_at             TIMESTAMP(3) NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    CONSTRAINT FK_SessionStepOptions_Data
        FOREIGN KEY (session_step_data_id)
        REFERENCES SessionStepData(session_step_data_id)
        ON DELETE CASCADE,
    CONSTRAINT FK_SessionStepOptions_FieldOptions
        FOREIGN KEY (field_option_id)
        REFERENCES FieldOptions(option_id)
        ON DELETE SET NULL
);

CREATE UNIQUE INDEX UQ_SessionStepOptions_Data_Value
    ON SessionStepOptions(session_step_data_id, option_value);

CREATE INDEX IX_SessionStepOptions_FieldOption
    ON SessionStepOptions(field_option_id);

-- Table to track which steps have been completed/validated
CREATE TABLE SessionStepProgress (
    session_step_progress_id SERIAL PRIMARY KEY,
    session_id               INTEGER NOT NULL,
    step_number              INTEGER NOT NULL,
    is_completed             BOOLEAN NOT NULL DEFAULT FALSE,
    is_validated             BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at             TIMESTAMP(3) NULL,
    validation_errors        TEXT NULL,                -- JSON string of validation errors
    created_at               TIMESTAMP(3) NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    updated_at               TIMESTAMP(3) NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    CONSTRAINT FK_SessionStepProgress_Session
        FOREIGN KEY (session_id) REFERENCES FormSessions(session_id)
        ON DELETE CASCADE,
    CONSTRAINT UQ_SessionStepProgress_Session_Step UNIQUE (session_id, step_number)
);

CREATE INDEX IX_SessionStepProgress_Session ON SessionStepProgress(session_id);

-- Optional: Add session_id to Responses table to link final submission with session
ALTER TABLE Responses ADD COLUMN session_id INTEGER NULL;

ALTER TABLE Responses
ADD CONSTRAINT FK_Responses_Sessions
    FOREIGN KEY (session_id) REFERENCES FormSessions(session_id)
    ON DELETE SET NULL;

CREATE INDEX IX_Responses_Session ON Responses(session_id);

-- View to get session summary with progress
CREATE OR REPLACE VIEW vw_FormSessionSummary AS
SELECT 
    fs.session_id,
    fs.form_id,
    fs.user_id,
    fs.session_token,
    fs.current_step,
    fs.total_steps,
    fs.is_completed,
    fs.created_at,
    fs.updated_at,
    fs.expires_at,
    f.title AS form_title,
    u.email AS user_email,
    u.display_name AS user_name,
    COUNT(DISTINCT ssp.step_number) FILTER (WHERE ssp.is_completed = TRUE) AS completed_steps_count,
    ROUND(
        (COUNT(DISTINCT ssp.step_number) FILTER (WHERE ssp.is_completed = TRUE)::NUMERIC / 
         NULLIF(fs.total_steps, 0)) * 100, 
        2
    ) AS completion_percentage
FROM FormSessions fs
JOIN Forms f ON f.form_id = fs.form_id
LEFT JOIN Users u ON u.user_id = fs.user_id
LEFT JOIN SessionStepProgress ssp ON ssp.session_id = fs.session_id
GROUP BY fs.session_id, f.form_id, u.user_id;

-- Function to clean up expired sessions (optional, for maintenance)
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM FormSessions
    WHERE expires_at IS NOT NULL 
      AND expires_at < NOW() AT TIME ZONE 'UTC'
      AND is_completed = FALSE;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;