"use client"

import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import { StudentNumberSummaryLine } from "@/components/credit-registration/StudentNumberCard"
import {
  emptyStateCss,
  headingCss,
  narrowPageCss,
  pageTitleCss,
  sectionCss,
  sectionsCss,
} from "@/components/credit-registration/styles"
import {
  getMyCreditRegistrationsOptions,
  getMyStudiesOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import type { MyCreditRegistration, MyStudiesCourse } from "@/generated/api/types.generated"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Link, QueryResult } from "@/shared-module/components"

import { FIND_MORE_COURSES_URL } from "../constants"
import CertificatesSection from "./CertificatesSection"
import HiddenCoursesSection from "./HiddenCoursesSection"
import RegistrationsNeedingAttention from "./RegistrationsNeedingAttention"
import StudiesCourseCard from "./StudiesCourseCard"
import StudiesSummary from "./StudiesSummary"

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
  usePageTitle(t("heading-your-studies"))

  const myStudiesQuery = useQuery({ ...getMyStudiesOptions() })
  const showCreditRegistration =
    myStudiesQuery.data?.any_module_supports_credit_registration === true
  const registrationsQuery = useQuery({
    ...getMyCreditRegistrationsOptions(),
    enabled: showCreditRegistration,
  })
  // Read directly rather than through QueryResult: the study record must render even when the
  // registration statuses cannot, and RegistrationsNeedingAttention reports that problem on its own.
  const registrationByCourseModuleId = newestRegistrationPerCourseModule(
    registrationsQuery.data ?? [],
  )

  return (
    <div className={narrowPageCss}>
      <h1 className={pageTitleCss}>{t("heading-your-studies")}</h1>

      {showCreditRegistration ? (
        <>
          <RegistrationsNeedingAttention />
          <StudentNumberSummaryLine />
        </>
      ) : null}

      <QueryResult query={myStudiesQuery} contentClassName={sectionsCss}>
        {(myStudies) => {
          if (myStudies.courses.length === 0) {
            return (
              <>
                <p className={emptyStateCss}>{t("you-have-not-started-any-courses-yet")}</p>
                <Link href={FIND_MORE_COURSES_URL}>{t("link-text-find-more-courses")}</Link>
              </>
            )
          }

          const visibleCourses = myStudies.courses.filter((course) => !course.hidden)
          const hiddenCourses = myStudies.courses.filter((course) => course.hidden)
          const completedCourses = visibleCourses.filter((course) => isCompleted(course))
          const coursesInProgress = visibleCourses.filter((course) => !isCompleted(course))

          const courseSection = (heading: string, courses: MyStudiesCourse[]) =>
            courses.length === 0 ? null : (
              <section className={sectionCss}>
                <h2 className={headingCss}>{heading}</h2>
                <div className={sectionCss}>
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
            <>
              <StudiesSummary totals={myStudies.totals} />

              {visibleCourses.length === 0 ? (
                <p className={emptyStateCss}>{t("all-of-your-courses-are-hidden")}</p>
              ) : null}
              {courseSection(t("heading-courses-in-progress"), coursesInProgress)}
              {courseSection(t("heading-courses-completed"), completedCourses)}

              <CertificatesSection />

              {hiddenCourses.length > 0 ? <HiddenCoursesSection courses={hiddenCourses} /> : null}
            </>
          )
        }}
      </QueryResult>
    </div>
  )
}

export default withErrorBoundary(withSignedIn(StudiesPage))
