1. FormSessions

Tracks each user's form-filling session
Supports both authenticated users (user_id) and anonymous users (session_token)
Tracks current step and completion status
Optional expiration for time-limited forms

2. FormSteps

Defines the step structure for each form
Each step has a number, title, and description
Links form fields to specific steps via form_step_id in FormFields

3. SessionStepData

Stores draft values for form fields
Similar structure to ResponseValues but for in-progress sessions
Auto-saves as user fills out each step

4. SessionStepOptions

Handles multi-select options in draft state
Mirrors ResponseValueOptions structure

5. SessionStepProgress

Tracks which steps are completed and validated
Stores validation errors per step
Allows implementing "you must complete step 1 before step 2" logic

6. Integration

Links final Response to the session that created it
View for easy session summary queries
Cleanup function for expired sessions

Workflow:

User starts form → Create FormSession
User fills step 1 → Save to SessionStepData, mark step complete in SessionStepProgress
User navigates away → Session persisted
User returns → Resume from current_step
User completes all steps → Convert session data to Response + ResponseValues
