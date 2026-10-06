"use client"

import { css, cx } from "@emotion/css"
import styled from "@emotion/styled"
import { useQuery } from "@tanstack/react-query"
import { CheckCircle, MinusCircle, XmarkCircle } from "@vectopus/atlas-icons-react"
import { parseISO } from "date-fns"
import { useDeferredValue, useMemo } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { getCoursesForAuditingOptions } from "@/generated/api/@tanstack/react-query.generated"
import type { CourseAuditingData } from "@/generated/api/types.generated"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { baseTheme } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import withSuspenseBoundary from "@/shared-module/common/utils/withSuspenseBoundary"
import {
  Button,
  nullIfEmpty,
  QueryResult,
  Switch,
  TextField,
  TriStateToggle,
  NOT_SET,
  INCLUDE,
  EXCLUDE,
  type TriStateToggleStates,
  Tooltip,
} from "@/shared-module/components"

import CourseCard from "./CourseCard/CourseCard"
import CourseDataFilterForm from "./CourseDataFilterForm"

export interface CourseFilter {
  search_course: string
  no_default_uh_course_code: boolean
  not_closed: boolean
  short_description: boolean
  no_prerequisites: boolean
  no_audiences: boolean
  is_draft: Set<TriStateToggleStates>
  is_unlisted: Set<TriStateToggleStates>
  is_test_mode: Set<TriStateToggleStates>
  is_joinable_by_code_only: Set<TriStateToggleStates>
}

export interface CourseDataFilter {
  show_description: boolean
  show_prerequisites: boolean
  show_audiences: boolean
  show_suggest_metadata: boolean
  show_closed_at: boolean
  show_closed_course_successor_id: boolean
  show_additional_message: boolean
  show_completion_registration_link: boolean
  show_enable_registering_completion_to_uh_open_university: boolean
  show_uh_course_code: boolean
  show_ects_credits: boolean
}

export const FieldSet = styled.fieldset`
  display: flex;
  flex-flow: column;
  margin-bottom: 1rem;
  border: 1px solid ${baseTheme.colors.gray[200]};
  border-radius: 4px;
  padding: 1rem;
  gap: 1rem;
`

export const Legend = styled.legend`
  font-weight: 600;
  padding: 0 0.25rem;
`

export const contentRowStyles = css`
  display: flex;
  flex-flow: row wrap;
  align-items: normal;
  justify-content: space-between;
  gap: 1rem;
`

export const formButtonColumnStyles = css`
  display: flex;
  flex-flow: column;
  gap: 0.5rem;
`

const CourseAuditing = () => {
  const { t } = useTranslation()
  const getCoursesForAuditing = useQuery(getCoursesForAuditingOptions())

  const courseData = getCoursesForAuditing.data

  const { control, watch, reset } = useForm<CourseFilter>({
    defaultValues: {
      search_course: "",
      no_default_uh_course_code: false,
      not_closed: true,
      short_description: false,
      no_prerequisites: false,
      no_audiences: false,
      is_draft: new Set([NOT_SET]),
      is_unlisted: new Set([NOT_SET]),
      is_test_mode: new Set([NOT_SET]),
      is_joinable_by_code_only: new Set([NOT_SET]),
    },
  })

  const methods = useForm<CourseDataFilter>({
    defaultValues: {
      show_description: true,
      show_prerequisites: true,
      show_audiences: true,
      show_suggest_metadata: true,
      show_closed_at: true,
      show_closed_course_successor_id: true,
      show_additional_message: true,
      show_completion_registration_link: true,
      show_enable_registering_completion_to_uh_open_university: true,
      show_uh_course_code: true,
      show_ects_credits: true,
    },
  })

  const { control: courseDataFilterControl } = methods

  const [
    searchCourse,
    noDefaultUhCourseCode,
    notClosed,
    shortDescription,
    noPrerequisites,
    noAudiences,
    isDraft,
    isUnlisted,
    isTestMode,
    isJoinableByCodeOnly,
  ] = watch([
    "search_course",
    "no_default_uh_course_code",
    "not_closed",
    "short_description",
    "no_prerequisites",
    "no_audiences",
    "is_draft",
    "is_unlisted",
    "is_test_mode",
    "is_joinable_by_code_only",
  ])

  const deferredSearchCourse = useDeferredValue(searchCourse)

  const sortedCourses = useMemo(
    () => [...(courseData ?? [])].toSorted((a, b) => a.name.localeCompare(b.name)),
    [courseData],
  )

  const filteredCourses = useMemo(
    () =>
      sortedCourses.filter((course: CourseAuditingData) => {
        if (
          !course.name.toLocaleLowerCase().includes(deferredSearchCourse?.toLocaleLowerCase()) &&
          !course.description
            ?.toLocaleLowerCase()
            .includes(deferredSearchCourse?.toLocaleLowerCase())
        ) {
          return false
        }
        if (
          noDefaultUhCourseCode &&
          course.modules.find((m) => m.order_number === 0)?.uh_course_code !== null
        ) {
          return false
        }
        if (
          notClosed && course.closed_at !== null && course.closed_at !== undefined
            ? parseISO(course.closed_at).getTime() < Date.now()
            : false
        ) {
          return false
        }
        if (
          shortDescription &&
          !(course.description !== null && course.description !== undefined
            ? course.description?.length < 200
            : false)
        ) {
          return false
        }
        if (noPrerequisites && course.prerequisites.length > 0) {
          return false
        }
        if (noAudiences && course.audiences.length > 0) {
          return false
        }
        if (
          (isDraft.has(INCLUDE) && !course.is_draft) ||
          (isDraft.has(EXCLUDE) && course.is_draft)
        ) {
          return false
        }
        if (
          (isUnlisted.has(INCLUDE) && !course.is_unlisted) ||
          (isUnlisted.has(EXCLUDE) && course.is_unlisted)
        ) {
          return false
        }
        if (
          (isTestMode.has(INCLUDE) && !course.is_test_mode) ||
          (isTestMode.has(EXCLUDE) && course.is_test_mode)
        ) {
          return false
        }
        if (
          (isJoinableByCodeOnly.has(INCLUDE) && !course.is_joinable_by_code_only) ||
          (isJoinableByCodeOnly.has(EXCLUDE) && course.is_joinable_by_code_only)
        ) {
          return false
        }
        return true
      }),
    [
      sortedCourses,
      notClosed,
      shortDescription,
      noDefaultUhCourseCode,
      noPrerequisites,
      noAudiences,
      isDraft,
      isUnlisted,
      isTestMode,
      isJoinableByCodeOnly,
      deferredSearchCourse,
    ],
  )

  return (
    <div
      className={css`
        display: flex;
        flex-direction: column;
        gap: 1rem;
      `}
    >
      <h1>{t("title-course-auditing")}</h1>
      <FieldSet>
        <Legend>{t("course-auditing-filter-courses-title")}</Legend>
        <div className={contentRowStyles}>
          <div
            className={css`
              flex: 1 1 400px;
            `}
          >
            <TextField
              name="search_course"
              control={control}
              rules={nullIfEmpty}
              label={t("course-auditing-filter-search-course")}
              description={t("course-auditing-filter-search-course-description")}
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            size="medium"
            onClick={() => reset()}
            aria-label={t("course-auditing-reset-filter-aria")}
          >
            {t("button-reset")}
          </Button>
        </div>
        <div
          className={cx(
            contentRowStyles,
            css`
              gap: 2rem;
            `,
          )}
        >
          <div
            className={css`
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(min(300px, 100%), 1fr));
              margin: 0.5rem 0;
              gap: 0.5rem;
              flex-grow: 1;
              padding-top: 1.5rem;
            `}
          >
            <Switch
              name="not_closed"
              control={control}
              label={t("course-auditing-filter-not-closed")}
            />
            <Switch
              name="no_default_uh_course_code"
              control={control}
              label={t("course-auditing-filter-uh-course-code-not-set")}
            />
            <Switch
              name="short_description"
              control={control}
              label={t("course-auditing-filter-short-description")}
            />
            <Switch
              name="no_prerequisites"
              control={control}
              label={t("course-auditing-filter-prerequisites-not-set")}
            />
            <Switch
              name="no_audiences"
              control={control}
              label={t("course-auditing-filter-audiences-not-set")}
            />
          </div>
          <div
            className={css`
              display: flex;
              flex-basis: 350px;
              flex-direction: column;
            `}
          >
            <div className={formButtonColumnStyles}>
              <div
                className={css`
                  display: flex;
                  flex-direction: row;
                  align-items: center;
                `}
              >
                <p
                  className={css`
                    font-weight: 500;
                  `}
                >
                  {t("course-auditing-filter-course-status-title")}
                </p>
                <Tooltip aria-label={t("tri-state-toggle-tooltip-label")}>
                  <CheckCircle />
                  {t("tri-state-toggle-tooltip-body-check")}
                  {<br />}
                  <MinusCircle />
                  {t("tri-state-toggle-tooltip-body-dash")}
                  {<br />}
                  <XmarkCircle />
                  {t("tri-state-toggle-tooltip-body-x")}
                </Tooltip>
              </div>
              <TriStateToggle name="is_draft" control={control} label={t("draft")} />
              <TriStateToggle name="is_unlisted" control={control} label={t("unlisted")} />
              <TriStateToggle name="is_test_mode" control={control} label={t("test-course")} />
              <TriStateToggle
                name="is_joinable_by_code_only"
                control={control}
                label={t("joinable-by-code-only")}
              />
            </div>
          </div>
        </div>
      </FieldSet>

      <CourseDataFilterForm methods={methods} />

      <QueryResult query={getCoursesForAuditing} treatEmptyAsData>
        {() => (
          <div
            className={css`
              display: flex;
              flex-direction: column;
              gap: 2rem;
            `}
          >
            <p>{t("course-auditing-showing-courses", { count: filteredCourses.length })}</p>
            {filteredCourses.map((course) => (
              <CourseCard
                key={course.id}
                id={course.id}
                courseAuditingData={course}
                courseDataFilterControl={courseDataFilterControl}
              />
            ))}
          </div>
        )}
      </QueryResult>
    </div>
  )
}

export default withErrorBoundary(withSuspenseBoundary(withSignedIn(CourseAuditing)))
