"use client"

import { css, cx } from "@emotion/css"
import { ArrowRight } from "@vectopus/atlas-icons-react"
import React from "react"
import { useTranslation } from "react-i18next"

import {
  CREDIT_REGISTRATION_NS,
  LINK_INHERIT,
  MIDDLE_DOT,
  TIME_DATE,
  TONE,
} from "@/components/credit-registration/constants"
import type { CreditRegistrationTFunction } from "@/components/credit-registration/constants"
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

/** The result is the datum beside the name's label, so it carries less weight. */
const resultCss = css`
  color: var(--color-gray-700);
  font-weight: 500;
`

/** Name and result stack rather than sit in one `space-between` row, so a short result never jumps
 * sides depending on whether the name wrapped. */
const moduleHeaderCss = css`
  display: grid;
  gap: var(--space-1);
`

/** Lets a long course name shrink and wrap onto its own lines instead of pushing the button below. */
const courseTitleCss = cx(
  subheadingCss,
  css`
    min-width: 0;
  `,
)

/** Keeps its own size on the title row rather than shrinking to make room. */
const goToCourseLinkCss = css`
  flex: none;
`

/** Groups the details label with its arrow icon so the two never wrap apart. */
const detailsLabelCss = css`
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
`

const STATUS_ARROW_SIZE = 16

const completionResultLabel = (
  t: CreditRegistrationTFunction,
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
  const { t, i18n } = useTranslation(CREDIT_REGISTRATION_NS)

  const modules = course.modules.toSorted((a, b) => a.order_number - b.order_number)
  const hasSeveralParts = modules.length > 1
  const hasAnyCompletion = modules.some((module) => module.completion)

  return (
    <article className={cardCss} data-testid="profile-course-card">
      <div className={sectionHeaderCss}>
        <div className={spacedRowCss}>
          <h3 className={courseTitleCss}>{course.course_name}</h3>
          <Link
            href={navigateToCourseRoute(course.organization_slug, course.course_slug)}
            className={goToCourseLinkCss}
            styledAsButton
            variant="secondary"
            size="small"
          >
            {t("go-to-course")}
          </Link>
        </div>
        <p className={noteCss}>
          {ietfLanguageTagToHumanReadableName(course.language_code, i18n.language)}
          {hasSeveralParts
            ? `${MIDDLE_DOT}${t("modules-completed-of-total", {
                completed: modules.filter((module) => module.completion?.passed).length,
                total: modules.length,
              })}`
            : null}
        </p>
        {/* "Kept for its completions" is only true once there are some. */}
        {course.is_current || !hasAnyCompletion ? null : (
          <p className={noteCss}>{t("note-course-different-language-version")}</p>
        )}
      </div>

      <ul className={dividedListCss}>
        {modules.map((module) => (
          <ModuleRow
            key={module.course_module_id}
            module={module}
            // A single module's name would only repeat the course heading. Among several, every
            // row is named, the unnamed default one included: position is a divider line on a
            // phone and carries nothing.
            nameLabel={hasSeveralParts ? (module.name ?? t("label-default-course-module")) : null}
            registration={registrationByCourseModuleId.get(module.course_module_id) ?? null}
          />
        ))}
      </ul>
    </article>
  )
}

const ModuleRow: React.FC<{
  module: MyStudiesCourseModule
  nameLabel: string | null
  registration: MyCreditRegistration | null
}> = ({ module, nameLabel, registration }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const completion = module.completion

  const ectsLabel =
    typeof module.ects_credits === "number" ? t("ects-n", { n: module.ects_credits }) : null
  const registersOnCompletion = !completion && module.supports_credit_registration
  const factsLine = completion ? (
    <>
      {ectsLabel ? `${ectsLabel}${MIDDLE_DOT}` : null}
      {t("label-completed")}{" "}
      <RelativeTime at={completion.completion_date} absoluteTime={TIME_DATE} />
    </>
  ) : registersOnCompletion ? (
    <>
      {ectsLabel ? `${ectsLabel}${MIDDLE_DOT}` : null}
      {t("credit-registration-registers-on-completion")}
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
              {/* A pill does not read as a link, and on touch there is no hover to prove it. */}
              <span className={detailsLabelCss}>
                {t("credit-registration-registration-details")}
                <ArrowRight size={STATUS_ARROW_SIZE} aria-hidden="true" />
              </span>
            </Link>
          ) : null}
        </div>
      </div>

      {factsLine ? <p className={noteCss}>{factsLine}</p> : null}

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
