"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { InfoCircle, PauseCircle } from "@vectopus/atlas-icons-react"
import React from "react"
import { useDateFormatter, VisuallyHidden } from "react-aria"
import { useTranslation } from "react-i18next"

import { DAY_AND_MONTH_FORMAT } from "@/components/credit-registration/constants"
import { useCanViewCreditRegistrations } from "@/components/credit-registration/teacherCreditRegistrations"
import {
  getCourseCompletionOverviewOptions,
  getCourseStructureOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import type {
  CompletionPolicy,
  Course,
  CourseExamsOverview,
  CourseModuleCompletionOverview,
} from "@/generated/api/types.generated"
import {
  manageCourseModulesRoute,
  manageCourseStudentsRoute,
} from "@/shared-module/common/utils/routes"
import {
  DescriptionList,
  type DescriptionListItem,
  Disclosure,
  Infobox,
  Link,
  QueryResult,
  TONE,
} from "@/shared-module/components"

import { MODULE_PARAM } from "../students/StudentsContext"
import type { ModuleCompletionState, ModuleProblem, ModuleStatus } from "./completionProblems"
import { courseCompletionStateOf, needsAction } from "./completionProblems"

const STUDENTS_SUBTAB_COMPLETIONS = "completions"
const ICON_SIZE = 16
/** `VisuallyHidden` defaults to a `<div>`, which may not sit inside a `<p>` or `<label>`. */
const HIDDEN_TEXT_ELEMENT = "span"

const panelCss = css`
  margin: var(--space-5) 0 0;
  padding: var(--space-4-5) var(--space-4-5) var(--space-3);
  border: 1px solid var(--color-gray-100);
  border-radius: var(--surface-radius);

  @media (max-width: 600px) {
    padding: var(--space-4) var(--space-4) 0;
  }
`

const headCss = css`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-3) var(--space-4);
  padding-bottom: var(--space-4);
`

const titleCss = css`
  margin: 0;
  font-size: var(--font-size-3);
  font-weight: 600;
  line-height: 1.3;
`

const stateListCss = css`
  display: flex;
  flex-wrap: wrap;
  margin: 0;
  padding: 0;
  color: var(--color-gray-500);
  font-size: var(--font-size-1);
  list-style: none;

  li + li {
    margin-left: var(--space-3-5);
    padding-left: var(--space-3-5);
    border-left: 1px solid var(--color-gray-100);
  }
`

const needsActionCountCss = css`
  color: var(--color-crimson-700);
  font-weight: 600;
`

const headLinksCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-4);
  margin-left: auto;
  font-size: var(--font-size-1);

  @media (max-width: 600px) {
    width: 100%;
    margin-left: 0;
  }
`

const blockCss = css`
  padding: var(--space-4) 0;
  border-top: 1px solid var(--color-gray-100);

  > :first-child {
    margin-top: 0;
  }
`

const moduleNameCss = css`
  margin: 0 0 var(--space-2);
  font-size: var(--font-size-2);
  font-weight: 600;
`

const howCss = css`
  max-width: 72ch;
  margin: 0 0 var(--space-3);
`

const problemCss = css`
  margin-top: var(--space-3-5);
`

const checkCss = css`
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
  margin: var(--space-3-5) 0 0;
  color: var(--color-gray-600);
  font-size: var(--font-size-1);

  svg {
    flex: none;
    margin-top: 3px;
    color: var(--color-gray-500);
  }

  > span {
    max-width: 72ch;
  }
`

const mutedCss = css`
  color: var(--color-gray-400);
`

const noWrapCss = css`
  white-space: nowrap;
`

const whyListCss = css`
  margin: var(--space-3) 0 0;
  padding-left: var(--space-4-5);
  color: var(--color-gray-600);
`

interface Thresholds {
  points: number | null
  exercises: number | null
}

const thresholdsOf = (policy: CompletionPolicy | undefined): Thresholds =>
  policy && (policy.method === "by_requirements" || policy.method === "by_exam")
    ? {
        points: policy.number_of_points_treshold ?? null,
        exercises: policy.number_of_exercises_attempted_treshold ?? null,
      }
    : { points: null, exercises: null }

const isOutsidePlatform = (module: CourseModuleCompletionOverview) =>
  module.exam_requirement === "examinarium" || module.exam_requirement === "elsewhere"

interface Props {
  course: Course
}

/**
 * The Overview tab's summary of how students complete the course and get its credits, with what
 * needs the teacher's attention. Quiet when everything is in order.
 */
const CompletionPanel: React.FC<Props> = ({ course }) => {
  const { t } = useTranslation()
  const overviewQuery = useQuery(
    getCourseCompletionOverviewOptions({ path: { course_id: course.id } }),
  )
  const structureQuery = useQuery(getCourseStructureOptions({ path: { course_id: course.id } }))
  const canViewCreditRegistrations = useCanViewCreditRegistrations(course.id)
  const dateFormatter = useDateFormatter(DAY_AND_MONTH_FORMAT)

  const formatDate = (iso: string) => dateFormatter.format(new Date(iso))
  const formatWindow = (starts: string | null | undefined, ends: string | null | undefined) =>
    starts && ends
      ? dateFormatter.formatRange(new Date(starts), new Date(ends))
      : ends
        ? formatDate(ends)
        : null

  const modulesHref = manageCourseModulesRoute(course.id)
  const completionsHref = manageCourseStudentsRoute(course.id, STUDENTS_SUBTAB_COMPLETIONS)
  const moduleCompletionsHref = (moduleId: string) =>
    `${completionsHref}?${new URLSearchParams({ [MODULE_PARAM]: moduleId })}`

  const requirementsPhrase = (thresholds: Thresholds): string | null => {
    const parts = [
      thresholds.points === null
        ? null
        : t("requirement-phrase-points", { count: thresholds.points }),
      thresholds.exercises === null
        ? null
        : t("requirement-phrase-exercises", { count: thresholds.exercises }),
    ].filter((part): part is string => part !== null)
    if (parts.length === 2) {
      return t("requirement-phrase-both", { first: parts[0], second: parts[1] })
    }
    return parts[0] ?? null
  }

  const howSentence = (
    module: CourseModuleCompletionOverview,
    exams: CourseExamsOverview,
    thresholds: Thresholds,
  ): string => {
    if (module.credit_registration_route === "external") {
      return module.exam_requirement === "examinarium"
        ? t("completion-how-registered-outside-examinarium")
        : t("completion-how-registered-outside")
    }
    const requirements = requirementsPhrase(thresholds)
    switch (module.completion_method) {
      case "not_decided":
        return t("completion-how-not-decided")
      case "by_requirements":
        return requirements
          ? t("completion-how-by-requirements", { requirements })
          : t("completion-how-by-requirements-none")
      case "by_exam": {
        const several = exams.count > 1
        const pass = several ? t("completion-how-by-any-exam") : t("completion-how-by-the-exam")
        if (!requirements) {
          return pass
        }
        const gate = several
          ? t("completion-how-to-take-one", { requirements })
          : t("completion-how-to-take-it", { requirements })
        return `${pass} ${gate}`
      }
      case "teacher_adds":
        return isOutsidePlatform(module)
          ? t("completion-how-teacher-adds-after-each-exam")
          : module.exam_requirement === "platform"
            ? t("completion-how-teacher-adds-after-grading")
            : t("completion-how-teacher-adds")
    }
  }

  const examItem = (
    module: CourseModuleCompletionOverview,
    exams: CourseExamsOverview,
  ): DescriptionListItem | null => {
    switch (module.exam_requirement) {
      case "none":
        return null
      case "examinarium":
        return { label: t("label-exam"), value: t("exam-location-examinarium") }
      case "elsewhere":
        return { label: t("label-exam"), value: t("exam-location-elsewhere") }
      case "platform": {
        if (exams.count === 0) {
          return { label: t("label-exam"), value: t("exams-none-linked-yet") }
        }
        const next = formatWindow(exams.next_starts_at, exams.next_ends_at)
        const lastEnded = exams.last_ended_at ? formatDate(exams.last_ended_at) : null
        const secondary =
          lastEnded && next
            ? t("exams-last-ended-and-next", { lastEnded, next })
            : lastEnded
              ? t("exams-last-ended", { lastEnded })
              : next
                ? t("exams-next", { next })
                : null
        return {
          label: exams.count > 1 ? t("label-exams") : t("label-exam"),
          value: t("exams-on-this-platform", { count: exams.count }),
          ...(secondary ? { secondary } : {}),
        }
      }
    }
  }

  const creditsItem = (module: CourseModuleCompletionOverview): DescriptionListItem => {
    const route = module.credit_registration_route
    const value =
      route === "external" ? (
        module.exam_requirement === "examinarium" ? (
          t("credits-straight-from-examinarium")
        ) : (
          t("credits-outside-this-platform")
        )
      ) : route === "certificate_only" ? (
        t("route-certificate-only")
      ) : module.uh_course_code ? (
        <>
          {t("credits-registered-in-sisu-as")}{" "}
          <span className={noWrapCss}>
            {t("credits-course-code-and-credits", {
              courseCode: module.uh_course_code,
              credits: module.ects_credits ?? 0,
            })}
          </span>
        </>
      ) : (
        t("credits-registered-in-sisu")
      )
    return {
      label: t("label-credits"),
      value,
      ...(route !== "external" && !module.certification_enabled
        ? { secondary: t("credits-no-certificate") }
        : {}),
    }
  }

  const statusItem = (
    module: CourseModuleCompletionOverview,
    status: ModuleStatus,
  ): DescriptionListItem => {
    const label = t("label-status")
    switch (status.kind) {
      case "waiting-for-exam":
        return { label, value: t("status-waiting-for-the-exam") }
      case "no-completions-yet":
        return {
          label,
          value: t("status-no-completions-yet"),
          secondary: t("status-you-add-them-after-each-exam"),
        }
      case "not-tracked":
        return {
          label,
          value: <span className={mutedCss}>{t("status-no-completions-tracked-here")}</span>,
        }
      case "not-yet-registered": {
        const text = t("status-not-yet-registered-in-sisu", { count: status.count })
        return {
          label,
          value: canViewCreditRegistrations ? (
            <Link href={moduleCompletionsHref(module.course_module_id)}>{text}</Link>
          ) : (
            text
          ),
        }
      }
    }
  }

  const problemLine = (problem: ModuleProblem, index: number) => {
    const key = `${problem.kind}-${index}`
    if (needsAction(problem)) {
      return (
        <Infobox key={key} tone={TONE.DANGER} className={problemCss}>
          <VisuallyHidden elementType={HIDDEN_TEXT_ELEMENT}>
            {t("needs-action-prefix")}{" "}
          </VisuallyHidden>
          {problem.kind === "not-decided" && (
            <>
              {t("problem-not-decided")}{" "}
              <Link href={modulesHref}>{t("problem-not-decided-fix")}</Link>
            </>
          )}
          {problem.kind === "registration-link-missing" && (
            <>
              {t("problem-registration-link-missing")}{" "}
              <Link href={modulesHref}>{t("problem-registration-link-missing-fix")}</Link>
            </>
          )}
          {problem.kind === "registered-outside" && (
            <>
              {problem.isExaminarium
                ? t("problem-registered-from-examinarium")
                : t("problem-registered-outside")}{" "}
              <Link href={modulesHref}>{t("problem-registered-outside-fix")}</Link>
              <Disclosure variant="plain" title={t("why-this-matters")}>
                <ul className={whyListCss}>
                  <li>{t("why-registered-outside-experience")}</li>
                  <li>{t("why-registered-outside-visibility")}</li>
                  <li>{t("why-registered-outside-support")}</li>
                  <li>{t("why-registered-outside-funding")}</li>
                </ul>
              </Disclosure>
            </>
          )}
        </Infobox>
      )
    }
    return (
      <p key={key} className={checkCss}>
        <InfoCircle size={ICON_SIZE} aria-hidden />
        <span>
          <VisuallyHidden elementType={HIDDEN_TEXT_ELEMENT}>
            {t("worth-checking-prefix")}{" "}
          </VisuallyHidden>
          {problem.kind === "examinarium-access" && t("check-examinarium-access")}
          {problem.kind === "certificate-only" && t("check-certificate-only")}
          {problem.kind === "no-exam-has-pass-mark" && t("check-no-exam-has-pass-mark")}
        </span>
      </p>
    )
  }

  return (
    <QueryResult query={overviewQuery}>
      {(overview) => {
        if (overview.modules.length === 0) {
          return null
        }
        const state = courseCompletionStateOf(overview, course.is_draft)
        const policies = new Map(
          (structureQuery.data?.modules ?? []).map((m) => [m.id, m.completion_policy] as const),
        )
        const registersAny = overview.modules.some(
          (m) => m.credit_registration_route === "platform",
        )
        const isHealthy = state.needsActionCount === 0 && state.toCheckCount === 0
        const hasCourseIssues = state.rejectedCourseCodes.length > 0 || state.pauses.length > 0

        const moduleBlock = ({ module, status, problems }: ModuleCompletionState) => {
          const items = [
            examItem(module, overview.exams),
            module.completion_method === "not_decided" &&
            module.credit_registration_route !== "external"
              ? null
              : creditsItem(module),
            status ? statusItem(module, status) : null,
          ].filter((item): item is DescriptionListItem => item !== null)
          return (
            <div key={module.course_module_id} className={blockCss}>
              <h3 className={moduleNameCss}>{module.name ?? t("default-module")}</h3>
              <p className={howCss}>
                {howSentence(
                  module,
                  overview.exams,
                  thresholdsOf(policies.get(module.course_module_id)),
                )}
              </p>
              {items.length > 0 && <DescriptionList items={items} />}
              {problems.map((problem, index) => problemLine(problem, index))}
            </div>
          )
        }

        return (
          <section className={panelCss} aria-labelledby="course-completion-panel-title">
            <div className={headCss}>
              <h2 id="course-completion-panel-title" className={titleCss}>
                {t("heading-completion")}
              </h2>
              <ul className={stateListCss}>
                {isHealthy && <li>{t("completion-all-set")}</li>}
                {state.needsActionCount > 0 && (
                  <li className={needsActionCountCss}>
                    {t("completion-things-need-action", { count: state.needsActionCount })}
                  </li>
                )}
                {state.toCheckCount > 0 && (
                  <li>{t("completion-to-check", { count: state.toCheckCount })}</li>
                )}
              </ul>
              <span className={headLinksCss}>
                <Link href={modulesHref}>{t("link-module-settings")}</Link>
                {canViewCreditRegistrations && registersAny && (
                  <Link href={completionsHref}>{t("link-registration-status")}</Link>
                )}
              </span>
            </div>
            {hasCourseIssues && (
              <div className={blockCss}>
                {state.rejectedCourseCodes.map((courseCode) => (
                  <Infobox key={courseCode} tone={TONE.DANGER} className={problemCss}>
                    <VisuallyHidden elementType={HIDDEN_TEXT_ELEMENT}>
                      {t("needs-action-prefix")}{" "}
                    </VisuallyHidden>
                    {t("problem-course-code-not-accepted", { courseCode })}{" "}
                    <Link href={modulesHref}>{t("problem-course-code-not-accepted-fix")}</Link>
                  </Infobox>
                ))}
                {state.pauses.map((pause) => (
                  <p key={`${pause.pausedAt}-${pause.reason ?? ""}`} className={checkCss}>
                    <PauseCircle size={ICON_SIZE} aria-hidden />
                    <span>
                      {pause.reason
                        ? t("registration-paused-with-reason", {
                            date: formatDate(pause.pausedAt),
                            reason: pause.reason,
                          })
                        : t("registration-paused", { date: formatDate(pause.pausedAt) })}
                    </span>
                  </p>
                ))}
              </div>
            )}
            {state.modules.map(moduleBlock)}
          </section>
        )
      }}
    </QueryResult>
  )
}

export default CompletionPanel
