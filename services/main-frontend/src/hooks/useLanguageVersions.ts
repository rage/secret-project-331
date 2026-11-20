"use client"

import type { Query, UseMutationOptions } from "@tanstack/react-query"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"

import {
  deleteLanguageVersionProblemDismissalMutation,
  getLanguageVersionJoinCandidatesOptions,
  getLanguageVersionJoinPreviewOptions,
  getLanguageVersionReportOptions,
  getLanguageVersionSplitPreviewOptions,
  getLanguageVersionStructureOptions,
  getLanguageVersionSuggestionsOptions,
  postLanguageVersionExerciseLinksMutation,
  postLanguageVersionJoinMutation,
  postLanguageVersionPageLinksMutation,
  postLanguageVersionProblemDismissalMutation,
  postLanguageVersionRemoveLeftoverLinksMutation,
  postLanguageVersionSplitMutation,
} from "@/generated/api/@tanstack/react-query.generated"
import type { Options } from "@/generated/api/sdk.generated"
import type {
  LanguageVersionProblem,
  PostLanguageVersionProblemDismissalData,
} from "@/generated/api/types.generated"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

const POST = "POST" as const
const DELETE = "DELETE" as const

/** Which cached queries a language version mutation makes stale. */
type InvalidationScope = "all" | "report" | "none"

/** `_id` of a generated query key, e.g. "getLanguageVersionReport". */
function queryId(query: Query): unknown {
  const [key] = query.queryKey
  return typeof key === "object" && key !== null && "_id" in key ? key._id : undefined
}

const SCOPE_PREDICATE: Record<Exclude<InvalidationScope, "none">, (query: Query) => boolean> = {
  // Links, joins and splits change every course of the group, so no course id narrows this down.
  all: (query) => {
    const id = queryId(query)
    return (
      typeof id === "string" &&
      (id.startsWith("getLanguageVersion") || id === "getCourseLanguageVersions")
    )
  },
  report: (query) => queryId(query) === "getLanguageVersionReport",
}

/** Refetches everything that a link, join or split can change, in every course. */
export function useInvalidateLanguageVersions() {
  const queryClient = useQueryClient()
  return useCallback(
    () => queryClient.invalidateQueries({ predicate: SCOPE_PREDICATE.all }),
    [queryClient],
  )
}

/**
 * A toasting mutation that marks `scope` stale on success without waiting for the refetch, so
 * callers can close their dialog right away. `none` is for batches that invalidate once at the end.
 */
export function useLanguageVersionMutation<TData, TError, TVariables>(
  options: UseMutationOptions<TData, TError, TVariables>,
  method: typeof POST | typeof DELETE,
  scope: InvalidationScope,
) {
  const queryClient = useQueryClient()
  return useToastMutationOptions(
    options,
    { notify: true, method },
    {
      onSuccess: () => {
        if (scope !== "none") {
          void queryClient.invalidateQueries({ predicate: SCOPE_PREDICATE[scope] })
        }
      },
    },
  )
}

/** Problems found in the course's language versions, with the courses and edit rights. */
export function useLanguageVersionReport(courseId: string) {
  return useQuery(getLanguageVersionReportOptions({ path: { course_id: courseId } }))
}

/** The language versions' chapters, pages and exercises side by side. */
export function useLanguageVersionStructure(courseId: string, enabled = true) {
  return useQuery({
    ...getLanguageVersionStructureOptions({ path: { course_id: courseId } }),
    enabled,
  })
}

/**
 * Suggested counterparts for the course's pages and exercises. `candidateCourseIds` adds courses
 * that are not language versions yet, for matching before they are joined.
 */
export function useLanguageVersionSuggestions(
  courseId: string,
  chapterNumber: number | null,
  candidateCourseIds: string[],
  enabled = true,
) {
  return useQuery({
    ...getLanguageVersionSuggestionsOptions({
      path: { course_id: courseId },
      query: {
        ...(chapterNumber === null ? {} : { chapter_number: chapterNumber }),
        ...(candidateCourseIds.length === 0 ? {} : { candidate_course_ids: candidateCourseIds }),
      },
    }),
    enabled,
  })
}

/** Courses that could join the language versions: likely translations, or search hits. */
export function useLanguageVersionJoinCandidates(courseId: string, search: string, enabled = true) {
  const trimmed = search.trim()
  return useQuery({
    ...getLanguageVersionJoinCandidatesOptions({
      path: { course_id: courseId },
      query: trimmed === "" ? {} : { search: trimmed },
    }),
    enabled,
  })
}

/** What joining `joinedCourseId` would change; `null` disables the query. */
export function useLanguageVersionJoinPreview(courseId: string, joinedCourseId: string | null) {
  return useQuery(
    optionalGeneratedQueryOptions({
      value: joinedCourseId,
      build: (id) =>
        getLanguageVersionJoinPreviewOptions({
          path: { course_id: courseId, joined_course_id: id },
        }),
    }),
  )
}

/** What removing `splitCourseId` from the language versions would change; `null` disables it. */
export function useLanguageVersionSplitPreview(courseId: string, splitCourseId: string | null) {
  return useQuery(
    optionalGeneratedQueryOptions({
      value: splitCourseId,
      build: (id) =>
        getLanguageVersionSplitPreviewOptions({
          path: { course_id: courseId, split_course_id: id },
        }),
    }),
  )
}

export function usePageLinksMutation() {
  return useLanguageVersionMutation(postLanguageVersionPageLinksMutation(), POST, "all")
}

export function useExerciseLinksMutation() {
  return useLanguageVersionMutation(postLanguageVersionExerciseLinksMutation(), POST, "all")
}

export function useRemoveLeftoverLinksMutation() {
  return useLanguageVersionMutation(postLanguageVersionRemoveLeftoverLinksMutation(), POST, "all")
}

/** "Mark as intended". */
export function useDismissProblemMutation() {
  return useLanguageVersionMutation(postLanguageVersionProblemDismissalMutation(), POST, "report")
}

/** Variables for `useDismissProblemMutation` that mark `problem` as intended. */
export function problemDismissal(
  courseId: string,
  problem: LanguageVersionProblem,
): Options<PostLanguageVersionProblemDismissalData> {
  return {
    path: { course_id: courseId },
    body: { problem_key: problem.key, fingerprint: problem.fingerprint },
  }
}

/** Reports a problem marked as intended again. */
export function useUndismissProblemMutation() {
  return useLanguageVersionMutation(
    deleteLanguageVersionProblemDismissalMutation(),
    DELETE,
    "report",
  )
}

/** Joins a course into the language versions, moving its students' data. */
export function useJoinLanguageVersionMutation() {
  return useLanguageVersionMutation(postLanguageVersionJoinMutation(), POST, "all")
}

export function useSplitLanguageVersionMutation() {
  return useLanguageVersionMutation(postLanguageVersionSplitMutation(), POST, "all")
}
