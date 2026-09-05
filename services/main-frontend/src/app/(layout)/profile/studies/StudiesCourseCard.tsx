"use client"

import { css } from "@emotion/css"
import { ArrowRight } from "@vectopus/atlas-icons-react"
import type { TFunction } from "i18next"
import React from "react"
import { useTranslation } from "react-i18next"

import {
  LINK_INHERIT,
  MIDDLE_DOT,
  TIME_COMPACT,
  TONE,
} from "@/components/credit-registration/constants"
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
import { Link, Meter, RegistrationStatusBadge, RelativeTime } from "@/shared-module/components"

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

/** Name and result stack rather than sit in one `space-between` row, so a short result never jumps
 * sides depending on whether the name wrapped. */
const moduleHeaderCss = css`
  display: grid;
  gap: var(--space-1);
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
  const namedModuleCount = modules.filter((module) => module.name !== null).length

  return (
    <article className={cardCss} data-testid="profile-course-card">
      <div className={sectionHeaderCss}>
        <h3 className={subheadingCss}>{course.course_name}</h3>
        <p className={noteCss}>
          {ietfLanguageTagToHumanReadableName(course.language_code, i18n.language)}
          {modules.length > 1
            ? `${MIDDLE_DOT}${t("modules-completed-of-total", {
                completed: modules.filter((module) => module.completion?.passed).length,
                total: modules.length,
              })}`
            : null}
        </p>
        {course.is_current ? null : (
          <p className={noteCss}>{t("note-course-different-language-version")}</p>
        )}
      </div>

      <ul className={dividedListCss}>
        {modules.map((module) => {
          // A single module's name would only repeat the course heading above it. Among several,
          // an unnamed one (the course's default module) omits its own name and lets its position
          // and the named siblings carry it — unless nothing here has a name to carry it with.
          const nameLabel =
            modules.length > 1
              ? (module.name ?? (namedModuleCount === 0 ? t("label-default-course-module") : null))
              : null
          return (
            <ModuleRow
              key={module.course_module_id}
              module={module}
              nameLabel={nameLabel}
              registration={registrationByCourseModuleId.get(module.course_module_id) ?? null}
            />
          )
        })}
      </ul>

      <Link href={navigateToCourseRoute(course.organization_slug, course.course_slug)}>
        {t("go-to-course")}
      </Link>
    </article>
  )
}

const ModuleRow: React.FC<{
  module: MyStudiesCourseModule
  nameLabel: string | null
  registration: MyCreditRegistration | null
}> = ({ module, nameLabel, registration }) => {
  const { t } = useTranslation()
  const completion = module.completion

  const ectsLabel =
    typeof module.ects_credits === "number" ? t("ects-n", { n: module.ects_credits }) : null
  const factsLine = completion ? (
    <>
      {ectsLabel ? `${ectsLabel}${MIDDLE_DOT}` : null}
      {t("label-completed")}{" "}
      <RelativeTime at={completion.completion_date} absoluteTime={TIME_COMPACT} />
    </>
  ) : (
    ectsLabel
  )

  return (
    <li className={sectionHeaderCss}>
      <div className={moduleHeaderCss}>
        {nameLabel !== null ? <span className={moduleNameCss}>{nameLabel}</span> : null}
        <div className={rowCss}>
          <span className={completion ? resultCss : noteCss}>
            {completionResultLabel(t, completion)}
          </span>
          {registration ? (
            <Link
              href={completionRegistrationRoute(module.course_module_id)}
              className={statusTriggerCss}
              appearance={LINK_INHERIT}
              aria-label={t("credit-registration-status-link-label", {
                status: registrationStatusLabel(t, registration.student_facing_status),
              })}
            >
              <RegistrationStatusBadge
                state={registrationStatusState(registration.student_facing_status)}
              >
                {registrationStatusLabel(t, registration.student_facing_status)}
              </RegistrationStatusBadge>
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      </div>

      {factsLine ? <p className={noteCss}>{factsLine}</p> : null}

      {!completion && module.supports_credit_registration ? (
        <p className={noteCss}>{t("credit-registration-explanation-waiting-for-completion")}</p>
      ) : null}

      {!completion && typeof module.score_maximum === "number" ? (
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
