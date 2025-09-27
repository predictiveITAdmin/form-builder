/*
This is the initial Schema for the SQL Server.
Before running the application, a SQL Instance should be connected and this schema should be run in SQL Server. 
*/

CREATE TABLE Users (
    user_id                 INT IDENTITY(1,1) PRIMARY KEY,
    entra_object_id         NVARCHAR(50) NOT NULL UNIQUE,
    email                   NVARCHAR(256) NOT NULL UNIQUE,
    display_name            NVARCHAR(200) NULL,
    created_at              DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE Forms (
    form_id        INT IDENTITY(1,1) PRIMARY KEY,
    title          NVARCHAR(300) NOT NULL,
    description    NVARCHAR(MAX) NULL,
    status         NVARCHAR(32) NOT NULL DEFAULT N'Draft',  
    owner_user_id  INT NULL,                                  
    is_anonymous   BIT NOT NULL DEFAULT 0,
    created_at     DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at     DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    rpa_webhook_url NVARCHAR(1000) NULL,
    rpa_secret      NVARCHAR(128)  NULL,  
    rpa_timeout_ms  INT NOT NULL DEFAULT 8000,
    rpa_retry_count INT NOT NULL DEFAULT 3;
);

ALTER TABLE Forms
ADD CONSTRAINT FK_Forms_Owner
FOREIGN KEY (owner_user_id) REFERENCES Users(user_id);

ALTER TABLE Forms ADD form_key NVARCHAR(120) NULL;
ALTER TABLE Forms ADD CONSTRAINT UQ_Forms_form_key UNIQUE (form_key);

CREATE INDEX IX_Forms_status ON Forms(status);
GO

CREATE TABLE FormFields (
    field_id     INT IDENTITY(1,1) PRIMARY KEY,
    form_id      INT NOT NULL,
    key_name     NVARCHAR(100) NOT NULL,          
    label        NVARCHAR(300) NOT NULL,
    help_text    NVARCHAR(1000) NULL,
    field_type   NVARCHAR(40) NOT NULL,           
    required     BIT NOT NULL DEFAULT 0,
    sort_order   INT NOT NULL DEFAULT 0,
    config_json  NVARCHAR(MAX) NULL,              
    active       BIT NOT NULL DEFAULT 1,
    created_at   DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at   DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
);

ALTER TABLE FormFields
ADD CONSTRAINT FK_FormFields_Forms
FOREIGN KEY (form_id) REFERENCES Forms(form_id);

ALTER TABLE FormFields
ADD CONSTRAINT UQ_FormFields_Form_Key UNIQUE (form_id, key_name);

CREATE INDEX IX_FormFields_Form_Sort ON FormFields(form_id, sort_order);
GO


CREATE TABLE FieldOptions (
  option_id      INT IDENTITY(1,1) PRIMARY KEY,
  form_field_id  INT NOT NULL,
  value          NVARCHAR(400) NOT NULL,
  label          NVARCHAR(400) NOT NULL,
  is_default     BIT NOT NULL DEFAULT 0,
  sort_order     INT NOT NULL DEFAULT 0,
  source         NVARCHAR(12) NOT NULL,   -- 'static' | 'rpa'
  updated_at     DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
);

ALTER TABLE FieldOptions
ADD CONSTRAINT FK_FieldOptions_FormFields
FOREIGN KEY (form_field_id) REFERENCES FormFields(field_id);

CREATE UNIQUE INDEX UQ_FieldOptions_Field_Value
  ON FieldOptions(form_field_id, value);

CREATE INDEX IX_FieldOptions_Field_Sort
  ON FieldOptions(form_field_id, sort_order, option_id);


CREATE TABLE Responses (
    response_id   INT IDENTITY(1,1) PRIMARY KEY,
    form_id       INT NOT NULL,
    user_id       INT NULL,                          
    submitted_at  DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    client_ip     NVARCHAR(64) NULL,
    user_agent    NVARCHAR(512) NULL,
    meta_json     NVARCHAR(MAX) NULL
);

ALTER TABLE Responses
ADD CONSTRAINT FK_Responses_Forms
FOREIGN KEY (form_id) REFERENCES Forms(form_id);

ALTER TABLE Responses
ADD CONSTRAINT FK_Responses_Users
FOREIGN KEY (user_id) REFERENCES Users(user_id);

CREATE INDEX IX_Responses_Form_Time ON Responses(form_id, submitted_at DESC);
GO

CREATE TABLE ResponseValues (
    response_value_id INT IDENTITY(1,1) PRIMARY KEY,
    response_id       INT NOT NULL,
    form_field_id     INT NOT NULL,

    value_text        NVARCHAR(MAX) NULL,
    value_number      DECIMAL(38,10) NULL,
    value_date        DATE NULL,
    value_datetime    DATETIME2(3) NULL,
    value_bool        BIT NULL,

    created_at        DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT UQ_ResponseValues_Response_Field UNIQUE (response_id, form_field_id)
);

ALTER TABLE ResponseValues
ADD CONSTRAINT FK_ResponseValues_Responses
FOREIGN KEY (response_id) REFERENCES Responses(response_id);

ALTER TABLE ResponseValues
ADD CONSTRAINT FK_ResponseValues_FormFields
FOREIGN KEY (form_field_id) REFERENCES FormFields(field_id);


CREATE TABLE dbo.ResponseValueOptions (
  response_value_option_id INT IDENTITY(1,1) PRIMARY KEY,
  response_value_id        INT NOT NULL,           
  field_option_id          INT NULL,               
  option_value             NVARCHAR(400) NOT NULL, 
  option_label             NVARCHAR(400) NULL,     
  created_at               DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),

  CONSTRAINT FK_RVO_ResponseValues
    FOREIGN KEY (response_value_id)
    REFERENCES dbo.ResponseValues(response_value_id)
    ON DELETE CASCADE,

  CONSTRAINT FK_RVO_FieldOptions
    FOREIGN KEY (field_option_id)
    REFERENCES dbo.FieldOptions(option_id)
    ON DELETE SET NULL
);

CREATE UNIQUE INDEX UQ_RVO_Response_Value
  ON dbo.ResponseValueOptions(response_value_id, option_value);

CREATE INDEX IX_RVO_FieldOption
  ON dbo.ResponseValueOptions(field_option_id);

CREATE INDEX IX_RVO_FieldOption ON ResponseValueOptions(field_option_id);


CREATE INDEX IX_ResponseValues_Response ON ResponseValues(response_id);
CREATE INDEX IX_ResponseValues_Field ON ResponseValues(form_field_id);

CREATE INDEX IX_ResponseValues_Number ON ResponseValues(form_field_id, value_number) WHERE value_number IS NOT NULL;
CREATE INDEX IX_ResponseValues_Date   ON ResponseValues(form_field_id, value_date)   WHERE value_date   IS NOT NULL;
CREATE INDEX IX_ResponseValues_Dt     ON ResponseValues(form_field_id, value_datetime) WHERE value_datetime IS NOT NULL;
CREATE INDEX IX_ResponseValues_Bool   ON ResponseValues(form_field_id, value_bool)   WHERE value_bool   IS NOT NULL;
GO