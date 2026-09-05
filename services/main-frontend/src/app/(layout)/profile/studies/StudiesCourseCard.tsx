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

const cardCss = css`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem 1.125rem;
  border: 1px solid var(--color-clear-300);
  border-radius: 8px;
  background: var(--color-clear-50);
`

const courseNameCss = css`
  margin: 0;
  font-size: 1.0625rem;
  font-weight: 600;
  line-height: 1.3;
  color: var(--color-gray-700);
`

const metaCss = css`
  margin: 0.25rem 0 0;
  font-size: var(--font-size-1);
  color: var(--color-gray-500);
`

const badgeRowCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
`

const moduleListCss = css`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
`

const moduleCss = css`
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-clear-200);
`

const moduleHeaderCss = css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
`

const moduleNameCss = css`
  font-weight: 600;
  color: var(--color-gray-700);
`

const factsCss = css`
  margin: 0;
  font-size: var(--font-size-1);
  color: var(--color-gray-600);
`

const resultCss = css`
  color: var(--color-gray-700);
  font-weight: 600;
`

const statusLinkCss = css`
  text-decoration: none;
`

const footerCss = css`
  display: flex;
  justify-content: flex-start;
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
  // A failed module still has a completion, so filter on `passed` or the badge claims a pass.
  const passedModules = modules.filter((module) => module.completion?.passed).length

  return (
    <article className={cardCss} data-testid="profile-course-card">
      <div>
        <h3 className={courseNameCss}>{course.course_name}</h3>
        <p className={metaCss}>
          {ietfLanguageTagToHumanReadableName(course.language_code, i18n.language)}
          {MIDDLE_DOT}
          {t("label-enrolled")}{" "}
          <RelativeTime at={course.first_enrolled_at} absoluteTime={TIME_IN_TITLE} />
        </p>
        {modules.length > 1 || !course.is_current ? (
          <div className={badgeRowCss}>
            {modules.length > 1 ? (
              <Badge tone={passedModules > 0 ? TONE.SUCCESS : TONE.NEUTRAL}>
                {t("modules-completed-of-total", {
                  completed: passedModules,
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

      <ul className={moduleListCss}>
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

      <div className={footerCss}>
        <Link
          href={navigateToCourseRoute(course.organization_slug, course.course_slug)}
          styledAsButton
          variant="secondary"
          size="small"
        >
          {t("go-to-course")}
        </Link>
      </div>
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

  return (
    <li className={moduleCss}>
      <div className={moduleHeaderCss}>
        {showName ? <span className={moduleNameCss}>{module.name ?? courseName}</span> : null}
        {registration ? (
          <Link
            href={completionRegistrationRoute(module.course_module_id)}
            className={statusLinkCss}
          >
            <RegistrationStatusBadge
              state={registrationStatusState(registration.student_facing_status)}
            >
              {registrationStatusLabel(t, registration.student_facing_status)}
            </RegistrationStatusBadge>
          </Link>
        ) : null}
      </div>

      <p className={factsCss}>
        <span className={resultCss}>{completionResultLabel(t, completion)}</span>
        {completion ? (
          <>
            {MIDDLE_DOT}
            {t("label-completed")}{" "}
            <RelativeTime at={completion.completion_date} absoluteTime={TIME_IN_TITLE} />
          </>
        ) : null}
        {typeof module.ects_credits === "number" ? (
          <>
            {MIDDLE_DOT}
            {t("ects-n", { n: module.ects_credits })}
          </>
        ) : null}
      </p>

      {typeof module.score_maximum === "number" ? (
        <Meter
          label={t("label-points")}
          value={module.score_given}
          maxValue={module.score_maximum}
          valueLabel={t("points-given-of-maximum", {
            given: module.score_given,
            maximum: module.score_maximum,
          })}
          tone={completion?.passed ? TONE.SUCCESS : TONE.NEUTRAL}
          {...omitUndefined({ threshold: module.score_required ?? undefined })}
        />
      ) : null}
    </li>
  )
}

export default StudiesCourseCard
