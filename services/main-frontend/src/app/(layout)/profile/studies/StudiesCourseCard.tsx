"use client"

import { css, cx } from "@emotion/css"
import { ArrowRight } from "@vectopus/atlas-icons-react"
import React, { useId } from "react"
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

import { completionThresholdList } from "./completionRequirements"

export interface StudiesCourseCardProps {
  course: MyStudiesCourse
  /** Newest credit registration per course module id; empty for a student with none. */
  registrationByCourseModuleId: ReadonlyMap<string, MyCreditRegistration>
}

/**
 * The card's title band. The rule is pulled back out to the card's edges: one inset by the card's
 * own padding reads as an underlined paragraph, where one that spans the full width reads as a
 * header.
 */
const cardHeaderCss = cx(
  sectionHeaderCss,
  css`
    margin: calc(var(--space-4) * -1) calc(var(--space-4) * -1) 0;
    padding: var(--space-3-5) var(--space-4);
    border-bottom: 1px solid var(--color-clear-300);
  `,
)

/** Lets a long course name shrink and wrap onto its own lines instead of pushing the button below. */
const courseTitleCss = css`
  margin: 0;
  min-width: 0;
  color: var(--color-gray-700);
  font-size: var(--font-size-3);
  font-weight: 600;
  line-height: 1.3;
`

/** A step below the course title, so a card of several modules reads as one thing with parts. */
const moduleNameCss = css`
  margin: 0;
  color: var(--color-gray-700);
  font-size: var(--font-size-2);
  font-weight: 600;
  line-height: 1.3;
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

/** What the module still asks of the student: the group label, the bars, and the notes on them. */
const requirementsCss = css`
  display: grid;
  gap: var(--space-3);
`

const requirementsHeadingCss = css`
  margin: 0;
  color: var(--color-gray-700);
  font-size: var(--font-size-1);
  font-weight: 600;
`

/** Matches a `Meter` label row, because the exam is one more requirement in the same list. */
const examRowCss = css`
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  font-size: var(--font-size-1);
  color: var(--color-gray-600);
`

const examResultCss = css`
  color: var(--color-gray-700);
  font-weight: 600;
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

/** One course, always open: every module's progress, result and credit-registration status. */
const StudiesCourseCard: React.FC<StudiesCourseCardProps> = ({
  course,
  registrationByCourseModuleId,
}) => {
  const { t, i18n } = useTranslation(CREDIT_REGISTRATION_NS)

  const modules = course.modules.toSorted((a, b) => a.order_number - b.order_number)
  const hasSeveralParts = modules.length > 1
  const hasAnyCompletion = modules.some((module) => module.completion)
  // Said once for the course rather than under each of its parts, where it would be the only thing
  // most of them have to say.
  const teacherGradesWholeCourse =
    modules.every((module) => !module.automatic_completion) &&
    modules.some((module) => !module.completion)

  return (
    <article className={cardCss} data-testid="profile-course-card">
      <header className={cardHeaderCss}>
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
        {teacherGradesWholeCourse ? (
          <p className={noteCss}>{t("note-teacher-grades-this-course")}</p>
        ) : null}
        {/* "Kept for its completions" is only true once there are some. */}
        {course.is_current || !hasAnyCompletion ? null : (
          <p className={noteCss}>{t("note-course-different-language-version")}</p>
        )}
      </header>

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
            examPassed={course.exam_passed ?? null}
            explainTeacherGrading={!teacherGradesWholeCourse}
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
  examPassed: boolean | null
  explainTeacherGrading: boolean
}> = ({ module, nameLabel, registration, examPassed, explainTeacherGrading }) => {
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
        {nameLabel !== null ? <h4 className={moduleNameCss}>{nameLabel}</h4> : null}
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

      {completion ? null : (
        <ModuleRequirements
          module={module}
          examPassed={examPassed}
          explainTeacherGrading={explainTeacherGrading}
        />
      )}
    </li>
  )
}

/**
 * Where the student stands and what is left, for a module they have not completed.
 *
 * The thresholds mean different things by policy: a manually graded module has none, and one that
 * requires an exam measures them for admission to the exam rather than for the completion itself.
 */
const ModuleRequirements: React.FC<{
  module: MyStudiesCourseModule
  /** Course-wide, since an exam belongs to the course rather than to one of its modules. */
  examPassed: boolean | null
  /** False once the card has said it for every part at once. */
  explainTeacherGrading: boolean
}> = ({ module, examPassed, explainTeacherGrading }) => {
  const { t, i18n } = useTranslation(CREDIT_REGISTRATION_NS)
  const headingId = useId()

  const pointsMaximum = module.score_maximum ?? 0
  const exercisesTotal = module.total_exercises ?? 0
  const pointsRequired = module.score_required ?? null
  const attemptedExercisesRequired = module.attempted_exercises_required ?? null
  const hasThresholds = pointsRequired !== null || attemptedExercisesRequired !== null

  const pointsMeter =
    pointsMaximum > 0 ? (
      <Meter
        label={t("label-points")}
        value={module.score_given}
        maxValue={pointsMaximum}
        valueLabel={t("value-of-maximum", {
          value: module.score_given,
          maximum: pointsMaximum,
        })}
        tone={TONE.NEUTRAL}
        {...omitUndefined({ threshold: pointsRequired ?? undefined })}
      />
    ) : null
  const exercisesMeter =
    exercisesTotal > 0 ? (
      <Meter
        label={t("exercises-attempted")}
        value={module.attempted_exercises}
        maxValue={exercisesTotal}
        valueLabel={t("value-of-maximum", {
          value: module.attempted_exercises,
          maximum: exercisesTotal,
        })}
        tone={TONE.NEUTRAL}
        {...omitUndefined({ threshold: attemptedExercisesRequired ?? undefined })}
      />
    ) : null

  // A teacher decides this module, so it carries no threshold to measure against.
  const unmeasured = !module.automatic_completion
  if (unmeasured || (!hasThresholds && !module.requires_exam)) {
    const teacherGradingNote =
      unmeasured && explainTeacherGrading ? (
        <p className={noteCss}>{t("note-teacher-grades-this-part")}</p>
      ) : null
    if (pointsMeter === null && exercisesMeter === null && teacherGradingNote === null) {
      return null
    }
    return (
      <div className={requirementsCss}>
        {pointsMeter}
        {exercisesMeter}
        {teacherGradingNote}
      </div>
    )
  }

  const showsThresholdMark =
    (pointsRequired !== null && pointsMeter !== null) ||
    (attemptedExercisesRequired !== null && exercisesMeter !== null)

  return (
    <div className={requirementsCss} role="group" aria-labelledby={headingId}>
      <p id={headingId} className={requirementsHeadingCss}>
        {module.requires_exam && hasThresholds
          ? t("heading-to-take-the-exam")
          : t("heading-to-complete-this-part")}
      </p>
      {hasThresholds ? (
        <p className={noteCss}>
          {completionThresholdList(t, i18n.language, pointsRequired, attemptedExercisesRequired)}
        </p>
      ) : null}
      {pointsMeter}
      {exercisesMeter}
      {showsThresholdMark ? <p className={noteCss}>{t("note-mark-shows-what-you-need")}</p> : null}
      {module.requires_exam ? (
        <div className={examRowCss}>
          <span>{t("label-exam")}</span>
          <span className={examResultCss}>
            {examPassed ? t("label-passed") : t("label-not-passed")}
          </span>
        </div>
      ) : null}
    </div>
  )
}

export default StudiesCourseCard
