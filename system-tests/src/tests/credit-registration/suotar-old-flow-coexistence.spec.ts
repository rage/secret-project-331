import { test } from "@playwright/test"

/**
 * Owns student numbers `9000010xx` and the `credit-registration-old-flow` course. Must be green
 * before the first real course is cut over.
 */
test.fixme("A course left on the old flow keeps registering through the legacy pull API", () => {
  // Waiting on PR 3's rollout steps, which are what turn the old flow off; until then the two paths
  // coexist untested. The Suotar side of the same guard — a flagged module leaving the pull stream and
  // its success being mirrored — is asserted in suotar-happy-path.spec.ts.
})

test.fixme("A completion eligible under both paths is registered exactly once", () => {
  // Waiting on PR 3's rollout steps.
})
