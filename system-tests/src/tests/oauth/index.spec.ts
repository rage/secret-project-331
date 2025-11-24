// Main entry point for all OAuth tests
// This file imports all OAuth test files (renamed to .ts) so they run sequentially in a single worker.
// This is necessary because the OAuth tests share state (user grants, client) and resetting authorization
// in one test interferes with others running in parallel.

import { test } from "@playwright/test"

import { setupRedirectServer, teardownRedirectServer } from "../../utils/oauth/redirectServer"

// Import all test modules
// These files export test definitions using test() from @playwright/test
// When imported, they register their tests under this file (index.spec.ts)
import "./discovery"
import "./flows"
import "./revocation"
import "./authorize/boundary"
import "./authorize/code-issuance"
import "./authorize/parameter-validation"
import "./authorize/pkce"
import "./authorize/user-auth"
import "./token/authorization-code"
import "./token/client-auth"
import "./token/issuance"
import "./token/parameter-validation"
import "./token/refresh"
import "./userinfo/bearer"
import "./userinfo/dpop"
import "./userinfo/scopes"

// Setup redirect server for all OAuth tests
test.beforeAll(async () => {
  await setupRedirectServer()
})

test.afterAll(async () => {
  await teardownRedirectServer()
})
