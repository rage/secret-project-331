"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import {
  getMyCreditRegistrationsOptions,
  getMyStudiesOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import type { MyCreditRegistration, MyStudiesCourse } from "@/generated/api/types.generated"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Link, QueryResult } from "@/shared-module/components"

import { FIND_MORE_COURSES_URL } from "../constants"
import CertificatesSection from "./CertificatesSection"
import HiddenCoursesSection from "./HiddenCoursesSection"
import StudiesCourseCard from "./StudiesCourseCard"
import StudiesSummary from "./StudiesSummary"

const headingCss = css`
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-gray-700);
  margin: 1.75rem 0 0.75rem;
`

const emptyStateCss = css`
  color: var(--color-gray-600);
  margin: 0 0 0.5rem;
`

const courseGridCss = css`
  display: grid;
  gap: 0.75rem;
  ${respondToOrLarger.md} {
    grid-template-columns: repeat(auto-fill, minmax(23rem, 1fr));
  }
`

const hiddenSectionCss = css`
  margin-top: 1.5rem;
`

const isCompleted = (course: MyStudiesCourse): boolean =>
  course.modules.length > 0 && course.modules.every((module) => module.completion?.passed === true)

/**
 * The registration whose status a module's line should show: the newest attempt, since an earlier
 * one is history the module status page carries.
 */
const newestRegistrationPerCourseModule = (
  registrations: MyCreditRegistration[],
): ReadonlyMap<string, MyCreditRegistration> => {
  const newest = new Map<string, MyCreditRegistration>()
  for (const registration of registrations) {
    const previous = newest.get(registration.course_module_id)
    if (!previous || previous.attempt_number < registration.attempt_number) {
      newest.set(registration.course_module_id, registration)
    }
  }
  return newest
}

const StudiesPage: React.FC = () => {
  const { t } = useTranslation()
  // Higher order than the profile layout so this page's title wins.
  usePageTitle(t("heading-your-studies"), { order: 10 })

  const myStudiesQuery = useQuery({ ...getMyStudiesOptions() })
  const registrationsQuery = useQuery({
    ...getMyCreditRegistrationsOptions(),
    enabled: myStudiesQuery.data?.any_module_supports_credit_registration === true,
  })
  // Read directly rather than through QueryResult: the study record must render even when the
  // registration statuses cannot, and the credit-registration tab reports the problems either way.
  const registrationByCourseModuleId = newestRegistrationPerCourseModule(
    registrationsQuery.data ?? [],
  )

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
        const completedCourses = visibleCourses.filter((course) => isCompleted(course))
        const coursesInProgress = visibleCourses.filter((course) => !isCompleted(course))

        const courseSection = (heading: string, courses: MyStudiesCourse[]) =>
          courses.length === 0 ? null : (
            <section>
              <h2 className={headingCss}>{heading}</h2>
              <div className={courseGridCss}>
                {courses.map((course) => (
                  <StudiesCourseCard
                    key={course.course_id}
                    course={course}
                    registrationByCourseModuleId={registrationByCourseModuleId}
                  />
                ))}
              </div>
            </section>
          )

        return (
          <div>
            <StudiesSummary totals={myStudies.totals} />

            {visibleCourses.length === 0 ? (
              <p className={emptyStateCss}>{t("all-of-your-courses-are-hidden")}</p>
            ) : null}
            {courseSection(t("heading-courses-in-progress"), coursesInProgress)}
            {courseSection(t("heading-courses-completed"), completedCourses)}

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
