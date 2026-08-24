"use client"

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { useQuery } from "@tanstack/react-query"
import { parseISO } from "date-fns"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { getCoursesForAuditingOptions } from "@/generated/api/@tanstack/react-query.generated"
import type { CourseAuditingData } from "@/generated/api/types.generated"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { baseTheme } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import withSuspenseBoundary from "@/shared-module/common/utils/withSuspenseBoundary"
import { Button, nullIfEmpty, QueryResult, Switch, TextField } from "@/shared-module/components"

import CourseCard from "./CourseCard/CourseCard"

export interface CourseFilter {
  search_course: string
  no_default_uh_course_code: boolean
  not_closed: boolean
  short_description: boolean
  no_prerequisites: boolean
  no_audiences: boolean
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
    },
  })

  const [
    searchCourse,
    noDefaultUhCourseCode,
    notClosed,
    shortDescription,
    noPrerequisites,
    noAudiences,
  ] = watch([
    "search_course",
    "no_default_uh_course_code",
    "not_closed",
    "short_description",
    "no_prerequisites",
    "no_audiences",
  ])

  const filteredCourses = useMemo(
    () =>
      [...(courseData ?? [])]
        .filter((course: CourseAuditingData) => {
          if (
            !course.name.toLocaleLowerCase().includes(searchCourse?.toLocaleLowerCase()) &&
            !course.description?.toLocaleLowerCase().includes(searchCourse?.toLocaleLowerCase())
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
          return true
        })
        .toSorted((a, b) => a.name.localeCompare(b.name)),
    [
      courseData,
      notClosed,
      shortDescription,
      noDefaultUhCourseCode,
      noPrerequisites,
      noAudiences,
      searchCourse,
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
        <Legend>{t("filters")}</Legend>
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
          className={css`
            color: ${baseTheme.colors.gray[500]};
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(min(300px, 100%), 1fr));
            margin: 0.5rem 0;
            text-align: start;
            gap: 0.5rem;
          `}
        >
          <Switch
            name="no_default_uh_course_code"
            control={control}
            label={t("course-auditing-filter-uh-course-code-not-set")}
          />
          <Switch
            name="not_closed"
            control={control}
            label={t("course-auditing-filter-not-closed")}
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
      </FieldSet>
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
              <CourseCard key={course.id} id={course.id} courseAuditingData={course} />
            ))}
          </div>
        )}
      </QueryResult>
    </div>
  )
}

export default withErrorBoundary(withSuspenseBoundary(withSignedIn(CourseAuditing)))
