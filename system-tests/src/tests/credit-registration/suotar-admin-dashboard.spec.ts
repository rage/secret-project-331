import { test } from "@playwright/test"

/**
 * Owns student numbers `9000009xx`, including the seeded superseded attempt pair.
 * Aggregate-count assertions must take their numbers from the mock's inspection endpoint or
 * run serially: a global count is run-order dependent across parallel workers.
 */
test.fixme("Overview, registrations explorer and account linking render with seeded data", () => {
  // Waiting on the dashboard shell.
})

test.fixme("The detail timeline shows the attempt chain, and no stored body leaks a student number, name or email", () => {
  // Waiting on the detail view. Stored request and response bodies are scrubbed at write time, so
  // assert the absence of the distinctive seeded strings.
})

test.fixme("The audit view lists the seeded global-admin and course-teacher actions", () => {
  // Waiting on the audit view.
})

test.fixme("The workers view lists all twelve phases with heartbeats, and pause and run-now work", () => {
  // Waiting on the workers view.
})
