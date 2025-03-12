import { useQuery } from "@tanstack/react-query"

import {
  getAvgTimeToFirstSubmissionByMonth,
  getCohortDailyActivity,
  getCohortWeeklyActivity,
  getDailyCourseCompletions,
  getDailyFirstExerciseSubmissions,
  getDailyUniqueUsersStarting,
  getDailyUsersReturningExercises,
  getMonthlyCourseCompletions,
  getMonthlyFirstExerciseSubmissions,
  getMonthlyUniqueUsersStarting,
  getMonthlyUsersReturningExercises,
  getTotalUsersCompletedCourse,
  getTotalUsersStartedCourse,
  getWeeklyUniqueUsersStarting,
} from "../services/backend/courses/stats"

import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

export const useTotalUsersStartedCourseQuery = (courseId: string | null) => {
  return useQuery({
    queryKey: ["course-stats", "total-users-started", courseId],
    queryFn: () => getTotalUsersStartedCourse(assertNotNullOrUndefined(courseId)),
    enabled: !!courseId,
  })
}

export const useTotalUsersCompletedCourseQuery = (courseId: string | null) => {
  return useQuery({
    queryKey: ["course-stats", "total-users-completed", courseId],
    queryFn: () => getTotalUsersCompletedCourse(assertNotNullOrUndefined(courseId)),
    enabled: !!courseId,
  })
}

export const useWeeklyUniqueUsersStartingQuery = (courseId: string | null) => {
  return useQuery({
    queryKey: ["course-stats", "weekly-users-starting", courseId],
    queryFn: () => getWeeklyUniqueUsersStarting(assertNotNullOrUndefined(courseId)),
    enabled: !!courseId,
  })
}

export const useDailyUniqueUsersStartingQuery = (courseId: string | null, days: number) => {
  return useQuery({
    queryKey: ["course-stats", "daily-users-starting", courseId, days],
    queryFn: () => getDailyUniqueUsersStarting(assertNotNullOrUndefined(courseId), days),
    enabled: !!courseId,
  })
}

export const useMonthlyUniqueUsersStartingQuery = (courseId: string | null) => {
  return useQuery({
    queryKey: ["course-stats", "monthly-users-starting", courseId],
    queryFn: () => getMonthlyUniqueUsersStarting(assertNotNullOrUndefined(courseId)),
    enabled: !!courseId,
  })
}

export const useMonthlyFirstExerciseSubmissionsQuery = (courseId: string | null) => {
  return useQuery({
    queryKey: ["course-stats", "monthly-first-submissions", courseId],
    queryFn: () => getMonthlyFirstExerciseSubmissions(assertNotNullOrUndefined(courseId)),
    enabled: !!courseId,
  })
}

export const useDailyFirstExerciseSubmissionsQuery = (courseId: string | null, days: number) => {
  return useQuery({
    queryKey: ["course-stats", "daily-first-submissions", courseId, days],
    queryFn: () => getDailyFirstExerciseSubmissions(assertNotNullOrUndefined(courseId), days),
    enabled: !!courseId,
  })
}

export const useMonthlyUsersReturningExercisesQuery = (courseId: string | null) => {
  return useQuery({
    queryKey: ["course-stats", "monthly-returning-exercises", courseId],
    queryFn: () => getMonthlyUsersReturningExercises(assertNotNullOrUndefined(courseId)),
    enabled: !!courseId,
  })
}

export const useDailyUsersReturningExercisesQuery = (courseId: string | null, days: number) => {
  return useQuery({
    queryKey: ["course-stats", "daily-returning-exercises", courseId, days],
    queryFn: () => getDailyUsersReturningExercises(assertNotNullOrUndefined(courseId), days),
    enabled: !!courseId,
  })
}

export const useMonthlyCourseCompletionsQuery = (courseId: string | null) => {
  return useQuery({
    queryKey: ["course-stats", "monthly-completions", courseId],
    queryFn: () => getMonthlyCourseCompletions(assertNotNullOrUndefined(courseId)),
    enabled: !!courseId,
  })
}

export const useDailyCourseCompletionsQuery = (courseId: string | null, days: number) => {
  return useQuery({
    queryKey: ["course-stats", "daily-completions", courseId, days],
    queryFn: () => getDailyCourseCompletions(assertNotNullOrUndefined(courseId), days),
    enabled: !!courseId,
  })
}

export const useAvgTimeToFirstSubmissionByMonthQuery = (courseId: string | null) => {
  return useQuery({
    queryKey: ["course-stats", "avg-time-to-first-submission", courseId],
    queryFn: () => getAvgTimeToFirstSubmissionByMonth(assertNotNullOrUndefined(courseId)),
    enabled: !!courseId,
  })
}

export const useCohortWeeklyActivityQuery = (courseId: string | null, months: number) => {
  return useQuery({
    queryKey: ["course-stats", "cohort-weekly-activity", courseId, months],
    queryFn: () => getCohortWeeklyActivity(assertNotNullOrUndefined(courseId), months),
    enabled: !!courseId,
  })
}

export const useCohortDailyActivityQuery = (courseId: string | null, days: number) => {
  return useQuery({
    queryKey: ["course-stats", "cohort-daily-activity", courseId, days],
    queryFn: () => getCohortDailyActivity(assertNotNullOrUndefined(courseId), days),
    enabled: !!courseId,
  })
}
