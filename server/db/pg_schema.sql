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
    field_id    SERIAL PRIMARY KEY,
    form_id     INTEGER NOT NULL,
    key_name    VARCHAR(100) NOT NULL,
    label       VARCHAR(300) NOT NULL,
    help_text   VARCHAR(1000) NULL,
    field_type  VARCHAR(40) NOT NULL,
    required    BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    config_json TEXT NULL,
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMP(3) NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    updated_at  TIMESTAMP(3) NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    CONSTRAINT FK_FormFields_Forms
        FOREIGN KEY (form_id) REFERENCES Forms(form_id),
    CONSTRAINT UQ_FormFields_Form_Key UNIQUE (form_id, key_name)
);

CREATE INDEX IX_FormFields_Form_Sort ON FormFields(form_id, sort_order);

CREATE TABLE FieldOptions (
    option_id     SERIAL PRIMARY KEY,
    form_field_id INTEGER NOT NULL,
    value         VARCHAR(400) NOT NULL,
    label         VARCHAR(400) NOT NULL,
    is_default    BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order    INTEGER NOT NULL DEFAULT 0,
    source        VARCHAR(12) NOT NULL,  -- 'static' | 'rpa'
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