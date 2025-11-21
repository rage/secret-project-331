// OAuth endpoint constants
export const BASE = "http://project-331.local"
export const AUTHORIZE = `${BASE}/api/v0/main-frontend/oauth/authorize`
export const TOKEN = `${BASE}/api/v0/main-frontend/oauth/token`
export const USERINFO = `${BASE}/api/v0/main-frontend/oauth/userinfo`
export const WELL_KNOWN = `${BASE}/api/v0/main-frontend/oauth/.well-known/openid-configuration`
export const JWKS_URI = `${BASE}/api/v0/main-frontend/oauth/jwks.json`
export const REVOKE = `${BASE}/api/v0/main-frontend/oauth/revoke`

// Test client constants
export const TEST_CLIENT_ID = "test-client-id"
export const TEST_CLIENT_SECRET = "very-secret" // <- hardcoded as requested
export const APP_DISPLAY_NAME = "Test Client" // shown on consent <h2> and settings <strong>
export const REDIRECT_URI = "http://127.0.0.1:8765/callback" // MUST match the registered redirect for TEST_CLIENT_ID

// Test users
export const USER_EMAIL = "student1@example.com"
export const USER_PASSWORD = "student1"
export const USER_EMAIL_2 = "student2@example.com"
export const USER_PASSWORD_2 = "student2"

// Already-logged-in storage state for the same student
export const STUDENT_STORAGE_STATE = "src/states/student1@example.com.json"
