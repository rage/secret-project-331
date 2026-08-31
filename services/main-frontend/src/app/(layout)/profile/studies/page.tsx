"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import { getMyStudiesOptions } from "@/generated/api/@tanstack/react-query.generated"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import { baseTheme, fontWeights } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Infobox, Link, QueryResult } from "@/shared-module/components"

import { FIND_MORE_COURSES_URL } from "../constants"
import CertificatesSection from "./CertificatesSection"
import HiddenCoursesSection from "./HiddenCoursesSection"
import StudiesCourseCard from "./StudiesCourseCard"
import StudiesSummary from "./StudiesSummary"

const headingCss = css`
  font-size: 1.125rem;
  font-weight: ${fontWeights.semibold};
  color: ${baseTheme.colors.gray[700]};
  margin: 0 0 0.75rem;
`

const emptyStateCss = css`
  color: ${baseTheme.colors.gray[600]};
  margin: 0 0 0.5rem;
`

const hiddenSectionCss = css`
  margin-top: 1.5rem;
`

const StudiesPage: React.FC = () => {
  const { t } = useTranslation()
  // Higher order than the profile layout so this page's title wins.
  usePageTitle(t("heading-your-studies"), { order: 10 })

  const myStudiesQuery = useQuery({ ...getMyStudiesOptions() })

  return (
    <QueryResult query={myStudiesQuery}>
      {(myStudies) => {
        if (myStudies.courses.length === 0) {
          return (
            <div>
              <p className={emptyStateCss}>{t("you-have-not-started-any-courses-yet")}</p>
              <Link href={FIND_MORE_COURSES_URL}>{t("link-text-find-more-courses")}</Link>
            </div>
          )
        }

        const visibleCourses = myStudies.courses.filter((course) => !course.hidden)
        const hiddenCourses = myStudies.courses.filter((course) => course.hidden)

        return (
          <div>
            <h2 className={headingCss}>{t("heading-summary")}</h2>
            <StudiesSummary totals={myStudies.totals} />

            {/* Only worth saying when there are courses listed for the totals to cover. */}
            {visibleCourses.length > 0 && myStudies.totals.completions === 0 ? (
              <Infobox>{t("no-completions-yet-keep-going")}</Infobox>
            ) : null}

            <h2 className={headingCss}>{t("heading-your-courses")}</h2>
            {visibleCourses.length === 0 ? (
              <p className={emptyStateCss}>{t("all-of-your-courses-are-hidden")}</p>
            ) : (
              visibleCourses.map((course) => (
                <StudiesCourseCard key={course.course_id} course={course} />
              ))
            )}

            <CertificatesSection />

            {hiddenCourses.length > 0 ? (
              <div className={hiddenSectionCss}>
                <HiddenCoursesSection courses={hiddenCourses} />
              </div>
            ) : null}
          </div>
        )
      }}
    </QueryResult>
  )
}

export default withErrorBoundary(StudiesPage)
