/**
 * Test ids the Playwright helpers in `system-tests/src/utils/waitForSpinnersToDisappear.ts` select
 * on. The strings are part of that contract: changing a value breaks those tests silently at the
 * next run.
 */

/** Matches `common`'s `LOADING_SPINNER_TEST_ID` so one wait covers spinners from either package. */
export const SPINNER_TEST_ID = "loading-spinner-component"
export const LOADING_REGION_TEST_ID = "loading-region-component"
export const QUERY_INITIAL_LOADING_TEST_ID = "query-initial-loading"
export const QUERY_LOADING_SPINNER_TEST_ID = "query-loading-spinner"
export const QUERY_REFRESHING_TEST_ID = "query-refreshing"
