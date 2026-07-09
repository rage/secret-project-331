"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { ArrowDown } from "@vectopus/atlas-icons-react"
import { parseISO } from "date-fns"
import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import CourseAuditingCard from "./CourseAuditingCard"
import SectionCollapsibleHeader from "./SectionCollapsibleHeader"
import {
  analysisSectionBodyId,
  analysisSectionHeadingId,
  type AnalysisSectionIndex,
  CourseFilterIcon,
  ICON_SIZE_SECTION,
  ICON_SIZE_SECTION_BADGE,
  SECTION_HEADER_ICONS,
  sectionBodyStyles,
  sectionCardStyles,
  sectionChevronStyles,
  sectionHeaderIconWrapStyles,
  sectionHeaderRowStyles,
  sectionTitleStyles,
  sectionToggleStyles,
  subsectionTitleStyles,
} from "./analysisFormDomain"

import { getCoursesForAuditingOptions } from "@/generated/api/@tanstack/react-query.generated"
import { CourseToAudit } from "@/generated/api/types.generated"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import withSuspenseBoundary from "@/shared-module/common/utils/withSuspenseBoundary"
import { Button, Checkbox, nullIfEmpty, QueryResult, TextField } from "@/shared-module/components"

export type CourseFilter = {
  search_course: string
  empty_uh_course_code: boolean
  ended: boolean
}

// TODO: can save and prepare for backend ??
const CourseAuditing = () => {
  const { t } = useTranslation()
  const getCoursesForAuditing = useQuery(getCoursesForAuditingOptions())

  const courseData = getCoursesForAuditing.data

  const filterDefaults = {
    search_course: "",
    empty_uh_course_code: false,
    ended: false,
  }
  const { control, watch, reset } = useForm<CourseFilter>({
    defaultValues: filterDefaults,
  })

  const [expanded, setExpanded] = useState<boolean>(false)

  const filterProps = watch()

  const filteredCourses = useMemo(
    () =>
      [...(courseData ?? [])]
        .filter((course: CourseToAudit) => {
          if (
            !course.name
              .toLocaleLowerCase()
              .includes(filterProps.search_course?.toLocaleLowerCase()) &&
            !course.description
              ?.toLocaleLowerCase()
              .includes(filterProps.search_course?.toLocaleLowerCase())
          ) {
            return false
          }
          if (filterProps.empty_uh_course_code && course.uh_course_code !== null) {
            return false
          }
          if (filterProps.ended && !course.closed_at) {
            return false
          }
          return true
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    [courseData, filterProps],
  )

  //console.log(parseISO(filteredCourses[47]?.closed_at) < Date.now())
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
        <div className={sectionHeaderRowStyles}>
          <button
            type="button"
            className={sectionToggleStyles}
            onClick={() => setExpanded(!expanded)}
          >
            <span className={sectionChevronStyles(expanded)} aria-hidden>
              <ArrowDown size={ICON_SIZE_SECTION} />
            </span>
            <span className={sectionHeaderIconWrapStyles} aria-hidden>
              <CourseFilterIcon size={ICON_SIZE_SECTION_BADGE} />
            </span>
            <span className={sectionTitleStyles}>
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
        <TextField
          name="search_course"
          control={control}
          rules={nullIfEmpty}
          label={t("course-auditing-filter-search-course")}
          description={t("course-auditing-filter-search-course-description")}
        />
        {expanded && (
          <div className={sectionBodyStyles}>
            <Checkbox
              name="empty_uh_course_code"
              control={control}
              label={t("course-auditing-filter-empty-uh-course-code")}
            />
            <Checkbox name="ended" control={control} label={t("course-auditing-filter-closed")} />
          </div>
        )}
      </div>
      {t("course-auditing-showing-courses", { count: filteredCourses.length })}
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
