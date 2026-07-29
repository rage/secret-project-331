export const BASE = "http://project-331.local"
export const AUTHORIZE = `${BASE}/api/v0/main-frontend/oauth/authorize`
export const TOKEN = `${BASE}/api/v0/main-frontend/oauth/token`
export const USERINFO = `${BASE}/api/v0/main-frontend/oauth/userinfo`
export const WELL_KNOWN = `${BASE}/api/v0/main-frontend/oauth/.well-known/openid-configuration`
export const JWKS_URI = `${BASE}/api/v0/main-frontend/oauth/jwks.json`
export const REVOKE = `${BASE}/api/v0/main-frontend/oauth/revoke`
export const INTROSPECT = `${BASE}/api/v0/main-frontend/oauth/introspect`
export const DEVICE_AUTHORIZATION = `${BASE}/api/v0/main-frontend/oauth/device_authorization`

export const EXERCISE_SERVICES_CLIENT = `${BASE}/api/v0/exercise-services/client`

export const DEVICE_CODE_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:device_code"
export const EXERCISE_SERVICES_SCOPE = "exercise-services"
export const TMC_VSCODE_CLIENT_ID = "tmc-vscode"
/** Device client without the exercise-services scope, for testing the scope gate. Not seeded in production. */
export const TMC_VSCODE_NOSCOPE_CLIENT_ID = "tmc-vscode-noscope-test"

export const TEST_CLIENT_ID = "test-client-id"
export const TEST_CLIENT_SECRET = "very-secret"
export const APP_DISPLAY_NAME = "Test Client"
// Redirect URI is per-worker (getRedirectUri() from redirectServer after ensureRedirectServer()). Ports 8765..8784.

export const USER_EMAIL = "student1@example.com"
export const USER_PASSWORD = "student1"
export const USER_EMAIL_2 = "student2@example.com"
export const USER_PASSWORD_2 = "student2"

export const STUDENT_STORAGE_STATE = "src/states/student1@example.com.json"
export const STUDENT2_STORAGE_STATE = "src/states/student2@example.com.json"

export interface OAuthTestUser {
  email: string
  password: string
  storageStatePath: string
}

// One user per spec so specs can run in parallel without sharing consent state. No admin: it
// conflicts with other tests.
const OAUTH_SPEC_USERS = {
  "code-issuance": {
    email: "user@example.com",
    password: "user",
    storageStatePath: "src/states/user@example.com.json",
  },
  "parameter-validation": {
    email: "assistant@example.com",
    password: "assistant",
    storageStatePath: "src/states/assistant@example.com.json",
  },
  "user-auth": {
    email: "creator@example.com",
    password: "creator",
    storageStatePath: "src/states/creator@example.com.json",
  },
  boundary: {
    email: "teacher@example.com",
    password: "teacher",
    storageStatePath: "src/states/teacher@example.com.json",
  },
  "authorization-code": {
    email: "language.teacher@example.com",
    password: "language.teacher",
    storageStatePath: "src/states/language.teacher@example.com.json",
  },
  issuance: {
    email: "material.viewer@example.com",
    password: "material.viewer",
    storageStatePath: "src/states/material.viewer@example.com.json",
  },
  "token-parameter-validation": {
    email: "teaching-and-learning-services@example.com",
    password: "teaching-and-learning-services",
    storageStatePath: "src/states/teaching-and-learning-services@example.com.json",
  },
  refresh: {
    email: "langs@example.com",
    password: "langs",
    storageStatePath: "src/states/langs@example.com.json",
  },
  "client-auth": {
    email: "student8@example.com",
    password: "student8",
    storageStatePath: "src/states/student8@example.com.json",
  },
  bearer: {
    email: "student3@example.com",
    password: "student3",
    storageStatePath: "src/states/student3@example.com.json",
  },
  dpop: {
    email: "student4@example.com",
    password: "student4",
    storageStatePath: "src/states/student4@example.com.json",
  },
  scopes: {
    email: "student5@example.com",
    password: "student5",
    storageStatePath: "src/states/student5@example.com.json",
  },
  revocation: {
    email: "student6@example.com",
    password: "student6",
    storageStatePath: "src/states/student6@example.com.json",
  },
  introspect: {
    email: "student7@example.com",
    password: "student7",
    storageStatePath: "src/states/student7@example.com.json",
  },
} satisfies Record<string, OAuthTestUser>

/** Returns the credentials and storage state path reserved for the given OAuth spec. */
export function getOAuthTestUser(specKey: keyof typeof OAUTH_SPEC_USERS): OAuthTestUser {
  const user = OAUTH_SPEC_USERS[specKey]
  if (!user) {
    throw new Error(`Unknown OAuth spec key: ${specKey}`)
  }
  return user
}
