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
  noteCss,
  rowCss,
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
import {
  completionRegistrationRoute,
  navigateToCourseRoute,
} from "@/shared-module/common/utils/routes"
import { Link, Meter, RegistrationStatusBadge, RelativeTime } from "@/shared-module/components"

import {
  studiesCardBodyCss,
  studiesCardCss,
  studiesCardHeaderCss,
  studiesCardListCss,
} from "./cardSurface"
import {
  everyModulePassed,
  remainingRequirements,
  remainingRequirementsList,
} from "./completionRequirements"

export interface StudiesCourseCardProps {
  course: MyStudiesCourse
  /** Newest credit registration per course module id; empty for a student with none. */
  registrationByCourseModuleId: ReadonlyMap<string, MyCreditRegistration>
}

/** A course with every module behind it says so in the band, not only in a line of small print. */
const completedHeaderCss = css`
  border-bottom-color: var(--color-green-200);
  background: var(--color-green-100);
`

/** The band's small print, held legible against the completed tint. */
const completedFactsCss = css`
  color: var(--color-green-700);
`

/** One module: name and status, then its small print, then its figures. */
const moduleRowCss = css`
  display: grid;
  gap: var(--space-3);
`

/** Lets a long course name shrink and wrap onto its own lines instead of pushing the button below. */
const courseTitleCss = css`
  margin: 0;
  min-width: 0;
  color: var(--color-gray-700);
  font-size: var(--font-size-3);
  font-weight: 600;
  line-height: 1.3;
`

/** A step below the course title, so a card of several modules reads as one course with extras. */
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

/** A module that is passed, or has nothing left to reach. */
const achievedCss = css`
  color: var(--color-green-700);
  font-weight: 600;
`

/** Name and result stack rather than sit in one `space-between` row, so a short result never jumps
 * sides depending on whether the name wrapped. */
const moduleHeaderCss = css`
  display: grid;
  gap: var(--space-2);
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

/** How wide one measured dimension gets. A bar the full width of a card reads as a rule. */
const FIGURE_WIDTH = "17rem"

/** The dimensions, then the exam under them. */
const progressCss = css`
  display: grid;
  gap: var(--space-3-5);
`

/** Two dimensions to a row where the card has the width, so a label and its value stay together. */
const dimensionsCss = css`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), ${FIGURE_WIDTH}));
  justify-content: start;
  gap: var(--space-3-5) var(--space-5);
`

/** Matches a `Meter` label row, because the exam is one more requirement in the same list. */
const examRowCss = css`
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  max-width: ${FIGURE_WIDTH};
  font-size: var(--font-size-1);
  color: var(--color-gray-600);
`

const examResultCss = css`
  color: var(--color-gray-700);
  font-weight: 600;
`

/** Holds a bare figure to the same weight and digit width as the `Meter` value above it. */
const figureValueCss = css`
  color: var(--color-gray-700);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
`

/** A bar's fill says how far the student has come; the tick beside it says how far is enough. */
const PROGRESS_TONE = TONE.SUCCESS

/** Names what the bars are measured for: the exam, the course itself, or one of its modules. */
const completionHeading = (
  t: CreditRegistrationTFunction,
  requiresExam: boolean,
  isCourseItself: boolean,
): string => {
  if (requiresExam) {
    return t("heading-to-take-the-exam")
  }
  return isCourseItself
    ? t("heading-to-complete-this-course")
    : t("heading-to-complete-this-module")
}

const STATUS_ARROW_SIZE = 16
const POINTS_FRACTION_DIGITS = 2

/** Points are stored to two decimals, so a whole score must not render as "5.00". */
const formatPoints = (points: number, locale: string): string =>
  points.toLocaleString(locale, { maximumFractionDigits: POINTS_FRACTION_DIGITS })

const completionResultLabel = (
  t: CreditRegistrationTFunction,
  completion: MyStudiesCompletion,
): string => {
  if (completion.grade !== null && completion.grade !== undefined) {
    return t("grade-n", { grade: completion.grade })
  }
  return completion.passed ? t("label-passed") : t("label-not-passed")
}

/** Whether `ModuleProgress` has anything to show for this module. */
const hasProgressToShow = (module: MyStudiesCourseModule): boolean =>
  (module.score_maximum ?? 0) > 0 || (module.total_exercises ?? 0) > 0 || module.requires_exam

/** True when every module grants the same credits, one that grants none included. */
const modulesShareEcts = (modules: MyStudiesCourseModule[]): boolean => {
  const first = modules[0]?.ects_credits ?? null
  return modules.every((module) => (module.ects_credits ?? null) === first)
}

/**
 * Compares only the primary subtag, so `en-US` material reads as English to an `en` reader.
 *
 * A reader whose language is not yet known counts as a different one: naming the language the
 * course is in costs a reader who did not need it far less than withholding it from one who did.
 */
const sameLanguage = (courseLanguage: string, readerLanguage: string | undefined): boolean =>
  readerLanguage !== undefined && courseLanguage.split("-")[0] === readerLanguage.split("-")[0]

/** One course, always open: every module's progress, result and credit-registration status. */
const StudiesCourseCard: React.FC<StudiesCourseCardProps> = ({
  course,
  registrationByCourseModuleId,
}) => {
  const { t, i18n } = useTranslation(CREDIT_REGISTRATION_NS)

  const modules = course.modules.toSorted((a, b) => a.order_number - b.order_number)
  const hasSeveralModules = modules.length > 1
  const hasAnyCompletion = modules.some((module) => module.completion)
  const courseIsComplete = everyModulePassed(modules)
  // Said once for the course rather than under each of its modules, where it would be the only
  // thing most of them have to say.
  const teacherGradesWholeCourse =
    modules.every((module) => !module.automatic_completion) &&
    modules.some((module) => !module.completion)
  // Credits belong to the module that grants them, but a course whose modules all grant the same
  // says it once up here rather than printing one identical line per module.
  const ectsSaidForWholeCourse = modulesShareEcts(modules)
  const courseEcts = modules.reduce((total, module) => total + (module.ects_credits ?? 0), 0)

  const headerFacts = [
    // Material in the language the student is already reading in does not need saying.
    sameLanguage(course.language_code, i18n.language)
      ? null
      : ietfLanguageTagToHumanReadableName(course.language_code, i18n.language),
    ectsSaidForWholeCourse && courseEcts > 0 ? t("ects-n", { n: courseEcts }) : null,
    hasSeveralModules
      ? t("completed-of-total", {
          completed: modules.filter((module) => module.completion?.passed).length,
          total: modules.length,
        })
      : null,
    teacherGradesWholeCourse ? t("note-graded-by-your-teacher") : null,
  ].filter((fact): fact is string => fact !== null)

  return (
    <article className={studiesCardCss} data-testid="profile-course-card">
      <header className={cx(studiesCardHeaderCss, courseIsComplete && completedHeaderCss)}>
        <div className={spacedRowCss}>
          <h3 className={courseTitleCss}>{course.course_name}</h3>
          <Link
            href={navigateToCourseRoute(course.organization_slug, course.course_slug)}
            className={goToCourseLinkCss}
            styledAsButton
            variant="tertiary"
            size="small"
          >
            {t("go-to-course")}
          </Link>
        </div>
        {headerFacts.length > 0 ? (
          <p className={cx(noteCss, courseIsComplete && completedFactsCss)}>
            {headerFacts.join(MIDDLE_DOT)}
          </p>
        ) : null}
        {/* "Kept for its completions" is only true once there are some. */}
        {course.is_current || !hasAnyCompletion ? null : (
          <p className={noteCss}>{t("note-course-different-language-version")}</p>
        )}
      </header>

      {modules.length > 0 ? (
        <div className={studiesCardBodyCss}>
          <ul className={studiesCardListCss}>
            {modules.map((module) => (
              <ModuleRow
                key={module.course_module_id}
                module={module}
                // The default module is the course itself, so it is named after it. A lone
                // module's name would only repeat the course heading, but among several every
                // row needs one: position is a divider line on a phone and carries nothing.
                nameLabel={hasSeveralModules ? (module.name ?? course.course_name) : null}
                isCourseItself={module.name === null}
                registration={registrationByCourseModuleId.get(module.course_module_id) ?? null}
                examPassed={course.exam_passed ?? null}
                explainTeacherGrading={!teacherGradesWholeCourse}
                showEcts={!ectsSaidForWholeCourse}
              />
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  )
}

const ModuleRow: React.FC<{
  module: MyStudiesCourseModule
  nameLabel: string | null
  /** The default module is not a module to a student — it is the course they signed up for. */
  isCourseItself: boolean
  registration: MyCreditRegistration | null
  examPassed: boolean | null
  explainTeacherGrading: boolean
  /** False once the card has said the credits for every module at once. */
  showEcts: boolean
}> = ({
  module,
  nameLabel,
  isCourseItself,
  registration,
  examPassed,
  explainTeacherGrading,
  showEcts,
}) => {
  const { t, i18n } = useTranslation(CREDIT_REGISTRATION_NS)
  const completion = module.completion

  const ectsLabel =
    showEcts && typeof module.ects_credits === "number"
      ? t("ects-n", { n: module.ects_credits })
      : null
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
      {isCourseItself
        ? t("credit-registration-registers-on-course-completion")
        : t("credit-registration-registers-on-module-completion")}
    </>
  ) : (
    ectsLabel
  )

  return (
    <li className={moduleRowCss}>
      <div className={moduleHeaderCss}>
        {nameLabel !== null ? <h4 className={moduleNameCss}>{nameLabel}</h4> : null}
        <div className={rowCss}>
          <ModuleStatus
            module={module}
            isCourseItself={isCourseItself}
            explainTeacherGrading={explainTeacherGrading}
            rowWouldBeBare={!factsLine && !hasProgressToShow(module)}
          />
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
        <ModuleProgress
          module={module}
          isCourseItself={isCourseItself}
          examPassed={examPassed}
          language={i18n.language}
        />
      )}
    </li>
  )
}

/**
 * The module's headline: its result once it has one, otherwise what is still missing.
 *
 * A module a teacher decides has no shortfall to state, so once the card already credits the
 * teacher as its grader, a bare "not completed yet" here would only repeat the heading and
 * figures. Only a row with nothing else on it keeps that line, so a row is never just a name.
 */
const ModuleStatus: React.FC<{
  module: MyStudiesCourseModule
  isCourseItself: boolean
  explainTeacherGrading: boolean
  /** A module with no credits, no points and no exercises still needs one line of its own. */
  rowWouldBeBare: boolean
}> = ({ module, isCourseItself, explainTeacherGrading, rowWouldBeBare }) => {
  const { t, i18n } = useTranslation(CREDIT_REGISTRATION_NS)
  const completion = module.completion

  if (completion) {
    return (
      <span className={completion.passed ? achievedCss : resultCss}>
        {completionResultLabel(t, completion)}
      </span>
    )
  }

  if (!module.automatic_completion) {
    if (explainTeacherGrading) {
      return <span className={noteCss}>{t("note-graded-by-your-teacher")}</span>
    }
    return rowWouldBeBare ? <span className={noteCss}>{t("module-not-completed-yet")}</span> : null
  }

  const remaining = remainingRequirements(
    module.score_required ?? null,
    module.score_given,
    module.attempted_exercises_required ?? null,
    module.attempted_exercises,
  )

  if (remaining === null) {
    return (
      <span className={achievedCss}>
        {module.requires_exam ? t("label-ready-to-take-the-exam") : t("label-requirements-met")}
      </span>
    )
  }

  const requirements = remainingRequirementsList(t, i18n.language, remaining)
  return (
    <span className={noteCss}>
      {module.requires_exam
        ? t("x-to-take-the-exam", { requirements })
        : isCourseItself
          ? t("x-to-complete-this-course", { requirements })
          : t("x-to-complete-this-module", { requirements })}
    </span>
  )
}

/**
 * Where the student stands, for a module they have not completed.
 *
 * A module a teacher decides is stated as bare figures: a bar with nothing to reach invites the
 * reader to judge a fraction that decides nothing, and two of them per module made the least
 * conclusive thing on the card the loudest.
 */
const ModuleProgress: React.FC<{
  module: MyStudiesCourseModule
  isCourseItself: boolean
  /** Course-wide, since an exam belongs to the course rather than to one of its modules. */
  examPassed: boolean | null
  language: string
}> = ({ module, isCourseItself, examPassed, language }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)

  const pointsMaximum = module.score_maximum ?? 0
  const exercisesTotal = module.total_exercises ?? 0
  // Both are already null on a module a teacher decides, which is what leaves it without bars.
  const pointsRequired = module.score_required ?? null
  const attemptedExercisesRequired = module.attempted_exercises_required ?? null
  // Either both dimensions of a module get a bar or neither does: one bar beside a bare figure
  // reads as a bar that failed to draw.
  const showBars = pointsRequired !== null || attemptedExercisesRequired !== null

  const dimensions: React.ReactNode[] = []

  if (pointsMaximum > 0) {
    dimensions.push(
      <ModuleDimension
        key="points"
        label={t("label-points")}
        value={module.score_given}
        maxValue={pointsMaximum}
        valueLabel={t("value-of-maximum", {
          value: formatPoints(module.score_given, language),
          maximum: formatPoints(pointsMaximum, language),
        })}
        threshold={pointsRequired}
        showBar={showBars}
      />,
    )
  }

  if (exercisesTotal > 0) {
    dimensions.push(
      <ModuleDimension
        key="exercises"
        label={t("exercises-attempted")}
        value={module.attempted_exercises}
        maxValue={exercisesTotal}
        valueLabel={t("value-of-maximum", {
          value: module.attempted_exercises,
          maximum: exercisesTotal,
        })}
        threshold={attemptedExercisesRequired}
        showBar={showBars}
      />,
    )
  }

  const examRow = module.requires_exam ? (
    <div className={examRowCss}>
      <span>{t("label-exam")}</span>
      <span className={examPassed ? achievedCss : examResultCss}>
        {examPassed ? t("label-passed") : t("label-not-passed")}
      </span>
    </div>
  ) : null

  if (dimensions.length === 0 && examRow === null) {
    return null
  }

  const body = (
    <>
      {dimensions.length > 0 ? <div className={dimensionsCss}>{dimensions}</div> : null}
      {examRow}
    </>
  )

  // The bars are a named group only once a threshold makes them answer a question. The name is
  // only ever read aloud: on screen the status line above already says what is left to reach.
  if (!showBars) {
    return <div className={progressCss}>{body}</div>
  }

  return (
    <div
      className={progressCss}
      role="group"
      aria-label={completionHeading(t, module.requires_exam, isCourseItself)}
    >
      {body}
    </div>
  )
}

/**
 * One dimension of a module: a bar where it is measured, otherwise the figure on its own. The
 * threshold tick is drawn only for the dimension that has one.
 */
const ModuleDimension: React.FC<{
  label: string
  value: number
  maxValue: number
  valueLabel: string
  threshold: number | null
  showBar: boolean
}> = ({ label, value, maxValue, valueLabel, threshold, showBar }) =>
  showBar ? (
    <Meter
      label={label}
      value={value}
      maxValue={maxValue}
      valueLabel={valueLabel}
      tone={PROGRESS_TONE}
      threshold={threshold}
    />
  ) : (
    <ModuleFigure label={label} value={valueLabel} />
  )

/** A measured value with no threshold to judge it against: a `Meter`'s label row without the bar. */
const ModuleFigure: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className={examRowCss}>
    <span>{label}</span>
    <span className={figureValueCss}>{value}</span>
  </div>
)

export default StudiesCourseCard
