"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import SectionCollapsibleHeader from "../course-plans/[id]/workspace/components/analysis-form/SectionCollapsibleHeader"
import {
  analysisSectionBodyId,
  sectionBodyStyles,
  sectionCardStyles,
  subsectionTitleStyles,
} from "../course-plans/[id]/workspace/components/analysis-form/analysisFormDomain"

import CourseAuditingCard from "./CourseAuditingCard"

import { getCoursesForAuditingOptions } from "@/generated/api/@tanstack/react-query.generated"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import withSuspenseBoundary from "@/shared-module/common/utils/withSuspenseBoundary"
import { Checkbox, nullIfEmpty, QueryResult, TextField } from "@/shared-module/components"

export type CourseFilter = {
  searchCourse: string
  emptyUhCourseCode: boolean
}

// TODO: can save and prepare for backend ??
const CourseAuditing = () => {
  const { t } = useTranslation()
  const getCoursesForAuditing = useQuery(getCoursesForAuditingOptions())

  const [filters, setFilters] = useState<CourseFilter>({
    searchCourse: "",
    emptyUhCourseCode: false,
  })

  const sortedCoursesForAuditing = useMemo(
    () => [...(getCoursesForAuditing.data ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [getCoursesForAuditing.data],
  )

  const [expanded, setExpanded] = useState<boolean>(false)

  const methods = useForm<CourseFilter>({
    defaultValues: {
      searchCourse: "",
      emptyUhCourseCode: false,
    },
  })

  const { control, register, handleSubmit, setValue, reset, subscribe } = methods

  useEffect(() => {
    const callback = subscribe({
      formState: {
        values: true,
      },
      callback: ({ values }) => {
        setFilters(values)
      },
    })
    return () => callback()
  }, [subscribe, setFilters])

  const filteredCourses = sortedCoursesForAuditing.filter(
    (course) =>
      course.name.toLocaleLowerCase().includes(filters.searchCourse?.toLocaleLowerCase()) ||
      course.description?.toLocaleLowerCase().includes(filters.searchCourse?.toLocaleLowerCase()),
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
      <div className={sectionCardStyles}>
        <SectionCollapsibleHeader
          sectionNum={1}
          expanded={expanded}
          onToggle={() => setExpanded(!expanded)}
          title={t("course-auditing-filter-title")}
        />
        {expanded && (
          <div id={analysisSectionBodyId(1)} className={sectionBodyStyles}>
            <h3 className={subsectionTitleStyles}>{t("course-auditing-advanced-filter")}</h3>
            <TextField
              name="searchCourse"
              control={control}
              rules={nullIfEmpty}
              label={t("course-auditing-filter-search-course")}
            />
            <Checkbox
              name="emptyUhCourseCode"
              control={control}
              label={t("course-auditing-filter-empty-uh-course-codes")}
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
