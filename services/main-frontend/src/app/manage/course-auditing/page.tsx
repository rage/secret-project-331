"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { ArrowDown, Filter } from "@vectopus/atlas-icons-react"
import { parseISO } from "date-fns"
import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { getCoursesForAuditingOptions } from "@/generated/api/@tanstack/react-query.generated"
import type { CourseToAudit } from "@/generated/api/types.generated"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { baseTheme } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import withSuspenseBoundary from "@/shared-module/common/utils/withSuspenseBoundary"
import { Button, Checkbox, nullIfEmpty, QueryResult, TextField } from "@/shared-module/components"

import CourseAuditingCard from "./CourseAuditingCard"

export interface CourseFilter {
  search_course: string
  empty_uh_course_code: boolean
  not_closed: boolean
  short_description: boolean
}

export const contentRowStyles = css`
  display: flex;
  align-items: normal;
  justify-content: space-between;
  margin-bottom: 0.75rem;
`

const CourseAuditing = () => {
  const { t } = useTranslation()
  const getCoursesForAuditing = useQuery(getCoursesForAuditingOptions())

  const courseData = getCoursesForAuditing.data

  const { control, watch, reset } = useForm<CourseFilter>({
    defaultValues: {
      search_course: "",
      empty_uh_course_code: false,
      not_closed: false,
      short_description: false,
    },
  })

  const [expanded, setExpanded] = useState<boolean>(false)

  const [searchCourse, emptyUhCourseCode, notClosed, shortDescription] = watch([
    "search_course",
    "empty_uh_course_code",
    "not_closed",
    "short_description",
  ])

  const filteredCourses = useMemo(
    () =>
      [...(courseData ?? [])]
        .filter((course: CourseToAudit) => {
          if (
            !course.name.toLocaleLowerCase().includes(searchCourse?.toLocaleLowerCase()) &&
            !course.description?.toLocaleLowerCase().includes(searchCourse?.toLocaleLowerCase())
          ) {
            return false
          }
          if (emptyUhCourseCode && course.uh_course_code !== null) {
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
          return true
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    [courseData, searchCourse, emptyUhCourseCode, notClosed, shortDescription],
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
      <div
        className={css`
          display: flex;
          flex-direction: column;
          gap: 0;
          padding: 1rem 1.1rem;
          border-radius: 0.5rem;
          border: 1px solid ${baseTheme.colors.gray[200]};
          background: ${baseTheme.colors.gray[50]};
        `}
      >
        <div
          className={css`
            display: flex;
            align-items: normal;
            justify-content: space-between;
            margin-bottom: 0.75rem;
          `}
        >
          <button
            type="button"
            className={css`
              display: flex;
              align-items: center;
              gap: 0.5rem;
              margin: 0;
              padding: 0.25rem 0.35rem;
              margin-left: -0.35rem;
              border: none;
              background: transparent;
              cursor: pointer;
              text-align: left;
              font: inherit;
              color: ${baseTheme.colors.gray[900]};
              border-radius: 0.35rem;

              &:hover {
                background: ${baseTheme.colors.gray[100]};
              }

              &:focus-visible {
                outline: 2px solid ${baseTheme.colors.green[600]};
                outline-offset: 2px;
                border-radius: 0.25rem;
              }
            `}
            onClick={() => setExpanded(!expanded)}
          >
            <span
              className={css`
                display: inline-flex;
                flex-shrink: 0;
                line-height: 0;
                color: ${baseTheme.colors.gray[500]};
                transform: rotate(${expanded ? "180deg" : "0deg"});
                transition: transform 0.15s ease;
              `}
              aria-hidden
            >
              <ArrowDown size={14} />
            </span>
            <span
              className={css`
                flex-shrink: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 2.25rem;
                height: 2.25rem;
                border-radius: 0.375rem;
                background: ${baseTheme.colors.green[50]};
                color: ${baseTheme.colors.green[700]};
              `}
              aria-hidden
            >
              <Filter size={18} />
            </span>
            <span
              className={css`
                font-size: 1.15rem;
                font-weight: 600;
                color: ${baseTheme.colors.gray[900]};
                margin: 0;
              `}
            >
              {expanded ? t("course-auditing-collapse-filter") : t("course-auditing-expand-filter")}
            </span>
          </button>
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
        <div className={contentRowStyles}>
          <TextField
            name="search_course"
            control={control}
            rules={nullIfEmpty}
            label={t("course-auditing-filter-search-course")}
            description={t("course-auditing-filter-search-course-description")}
          />
        </div>
        {expanded && (
          <div
            className={css`
              display: flex;
              flex-direction: column;
              gap: 1rem;
            `}
          >
            <Checkbox
              name="empty_uh_course_code"
              control={control}
              label={t("course-auditing-filter-empty-uh-course-code")}
            />
            <Checkbox
              name="not_closed"
              control={control}
              label={t("course-auditing-filter-not-closed")}
            />
            <Checkbox
              name="short_description"
              control={control}
              label={t("course-auditing-filter-short-description")}
            />
          </div>
        )}
      </div>
      <QueryResult query={getCoursesForAuditing} treatEmptyAsData>
        {() => (
          <div
            className={css`
              display: flex;
              flex-direction: column;
              gap: 1rem;
            `}
          >
            {t("course-auditing-showing-courses", { count: filteredCourses.length })}
            {filteredCourses.map((course) => (
              <CourseAuditingCard
                key={course.id}
                id={course.id}
                courseToAudit={course}
                refetch={getCoursesForAuditing.refetch}
              />
            ))}
          </div>
        )}
      </QueryResult>
    </div>
  )
}

export default withErrorBoundary(withSuspenseBoundary(withSignedIn(CourseAuditing)))
