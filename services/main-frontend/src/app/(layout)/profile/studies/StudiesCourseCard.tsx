"use client"

import { css } from "@emotion/css"
import type { TFunction } from "i18next"
import React from "react"
import { useTranslation } from "react-i18next"

import { MIDDLE_DOT, TIME_IN_TITLE, TONE } from "@/components/credit-registration/constants"
import {
  registrationStatusLabel,
  registrationStatusState,
} from "@/components/credit-registration/creditRegistrationCopy"
import {
  cardCss,
  dividedListCss,
  noteCss,
  rowCss,
  sectionHeaderCss,
  spacedRowCss,
  statusTriggerCss,
  subheadingCss,
} from "@/components/credit-registration/styles"
import type {
  MyCreditRegistration,
  MyStudiesCompletion,
  MyStudiesCourse,
  MyStudiesCourseModule,
} from "@/generated/api/types.generated"
import ietfLanguageTagToHumanReadableName from "@/shared-module/common/utils/ietfLanguageTagToHumanReadableName"
import { omitUndefined } from "@/shared-module/common/utils/nullability"
import {
  completionRegistrationRoute,
  navigateToCourseRoute,
} from "@/shared-module/common/utils/routes"
import {
  Badge,
  Link,
  Meter,
  RegistrationStatusBadge,
  RelativeTime,
} from "@/shared-module/components"

export interface StudiesCourseCardProps {
  course: MyStudiesCourse
  /** Newest credit registration per course module id; empty for a student with none. */
  registrationByCourseModuleId: ReadonlyMap<string, MyCreditRegistration>
}

const moduleNameCss = css`
  font-weight: 600;
  color: var(--color-gray-700);
`

const resultCss = css`
  color: var(--color-gray-700);
  font-weight: 600;
`

const completionResultLabel = (
  t: TFunction,
  completion: MyStudiesCompletion | null | undefined,
): string => {
  if (!completion) {
    return t("module-not-completed-yet")
  }
  if (completion.grade !== null && completion.grade !== undefined) {
    return t("grade-n", { grade: completion.grade })
  }
  return completion.passed ? t("label-passed") : t("label-not-passed")
}

/** One course, always open: every module's points, result and credit-registration status. */
const StudiesCourseCard: React.FC<StudiesCourseCardProps> = ({
  course,
  registrationByCourseModuleId,
}) => {
  const { t, i18n } = useTranslation()

  const modules = course.modules.toSorted((a, b) => a.order_number - b.order_number)

  return (
    <article className={cardCss} data-testid="profile-course-card">
      <div className={sectionHeaderCss}>
        <h3 className={subheadingCss}>{course.course_name}</h3>
        <p className={noteCss}>
          {ietfLanguageTagToHumanReadableName(course.language_code, i18n.language)}
          {MIDDLE_DOT}
          {t("label-enrolled")}{" "}
          <RelativeTime at={course.first_enrolled_at} absoluteTime={TIME_IN_TITLE} />
        </p>
        {modules.length > 1 || !course.is_current ? (
          <div className={rowCss}>
            {modules.length > 1 ? (
              <Badge tone={TONE.NEUTRAL}>
                {t("modules-completed-of-total", {
                  completed: modules.filter((module) => module.completion?.passed).length,
                  total: modules.length,
                })}
              </Badge>
            ) : null}
            {course.is_current ? null : (
              <Badge tone={TONE.NEUTRAL}>{t("badge-not-current-version")}</Badge>
            )}
          </div>
        ) : null}
      </div>

      <ul className={dividedListCss}>
        {modules.map((module) => (
          <ModuleRow
            key={module.course_module_id}
            module={module}
            courseName={course.course_name}
            showName={modules.length > 1}
            registration={registrationByCourseModuleId.get(module.course_module_id) ?? null}
          />
        ))}
      </ul>

      <Link href={navigateToCourseRoute(course.organization_slug, course.course_slug)}>
        {t("go-to-course")}
      </Link>
    </article>
  )
}

const ModuleRow: React.FC<{
  module: MyStudiesCourseModule
  courseName: string
  /** A single default module carries the course name already, so its own line would repeat it. */
  showName: boolean
  registration: MyCreditRegistration | null
}> = ({ module, courseName, showName, registration }) => {
  const { t } = useTranslation()
  const completion = module.completion

  const ectsLabel =
    typeof module.ects_credits === "number" ? t("ects-n", { n: module.ects_credits }) : null
  const factsLine = completion ? (
    <>
      {ectsLabel ? `${ectsLabel}${MIDDLE_DOT}` : null}
      {t("label-completed")}{" "}
      <RelativeTime at={completion.completion_date} absoluteTime={TIME_IN_TITLE} />
    </>
  ) : (
    ectsLabel
  )

  return (
    <li className={sectionHeaderCss}>
      <div className={spacedRowCss}>
        {showName ? <span className={moduleNameCss}>{module.name ?? courseName}</span> : null}
        <div className={rowCss}>
          <span className={resultCss}>{completionResultLabel(t, completion)}</span>
          {registration ? (
            <Link
              href={completionRegistrationRoute(module.course_module_id)}
              className={statusTriggerCss}
            >
              <RegistrationStatusBadge
                state={registrationStatusState(registration.student_facing_status)}
              >
                {registrationStatusLabel(t, registration.student_facing_status)}
              </RegistrationStatusBadge>
            </Link>
          ) : null}
        </div>
      </div>

      {factsLine ? <p className={noteCss}>{factsLine}</p> : null}

      {typeof module.score_maximum === "number" ? (
        <Meter
          label={t("label-points")}
          value={module.score_given}
          maxValue={module.score_maximum}
          valueLabel={t("points-given-of-maximum", {
            given: module.score_given,
            maximum: module.score_maximum,
          })}
          tone={TONE.NEUTRAL}
          {...omitUndefined({ threshold: module.score_required ?? undefined })}
        />
      ) : null}
    </li>
  )
}

export default StudiesCourseCard
