/**
 * Shared fixtures for the stats-chart unit tests (CourseVisitorsByCountry, CourseSubmissionsByDay,
 * …). Each of those tests mocks `useQuery` and asserts on the echarts option object the chart
 * builds, so they all need the same "successful query" result shape. Keeping it here means the
 * react-query result contract is described once instead of being copied per chart test.
 */
import type { UseQueryResult } from "@tanstack/react-query"

/** A resolved, non-error, non-fetching react-query result carrying `data`. */
export const successQuery = <T>(data: T) =>
  ({
    data,
    error: null,
    isError: false,
    isFetching: false,
    isPending: false,
  }) satisfies Pick<
    UseQueryResult<T, Error>,
    "data" | "error" | "isError" | "isFetching" | "isPending"
  >
