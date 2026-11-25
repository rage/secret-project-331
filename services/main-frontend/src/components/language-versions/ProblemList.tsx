"use client"

import type { TFunction } from "i18next"
import React from "react"
import { useTranslation } from "react-i18next"

import type {
  LanguageVersionCourse,
  LanguageVersionProblem,
  LanguageVersionProblemSeverity,
  LanguageVersionReport,
} from "@/generated/api/types.generated"
import {
  problemDismissal,
  useDismissProblemMutation,
  useUndismissProblemMutation,
} from "@/hooks/useLanguageVersions"
import useLanguageName from "@/shared-module/common/hooks/useLanguageName"
import { Badge, Button, EmptyState, RelativeTime, TONE } from "@/shared-module/components"

import { ABSOLUTE_TIME_TITLE } from "./constants"
import {
  courseById,
  dimmedRowCss,
  headActionsCss,
  leadCss,
  mutedCss,
  pageLabel,
  rowDescCss,
  rowMainCss,
  rowSideCss,
  rowsCss,
  rowTitleCss,
  sectionCss,
  sectionHeadCss,
  subHeadCss,
  useListFormatter,
  useReadOnlyReason,
} from "./shared"

const SEVERITIES: LanguageVersionProblemSeverity[] = [
  "affects_students",
  "should_fix",
  "check_intended",
]

const SEVERITY_HEADING_KEY = {
  affects_students: "language-versions-severity-affects-students",
  should_fix: "language-versions-severity-should-fix",
  check_intended: "language-versions-severity-check-intended",
} as const

const SEVERITY_TONE = {
  affects_students: "danger",
  should_fix: "warning",
  check_intended: "neutral",
} as const

/** What the problem's main button does. */
export type ProblemAction =
  | { type: "dialog" }
  | { type: "link-fixer"; targetCourseId: string }
  | { type: "guided"; candidateCourseIds: string[] }
  | { type: "dismiss" }

interface ProblemText {
  title: string
  description: string
  actionLabel: string
  action: ProblemAction
}

/** Headline, description and fix of each problem kind. */
function useProblemText(
  courses: LanguageVersionCourse[],
): (problem: LanguageVersionProblem) => ProblemText {
  const { t } = useTranslation()
  const languageName = useLanguageName()
  const list = useListFormatter()
  const languageOf = (courseId: string) => {
    const course = courseById(courses, courseId)
    return course ? languageName(course.language_code) : ""
  }
  const quoted = (names: string[]) =>
    list(names.map((name) => t("language-versions-quoted", { name })))
  const fix = { actionLabel: t("language-versions-fix"), action: { type: "dialog" } as const }
  const dismiss = {
    actionLabel: t("language-versions-mark-as-intended"),
    action: { type: "dismiss" } as const,
  }

  return (problem) => {
    const kind = problem.kind
    switch (kind.kind) {
      case "missing_page_counterpart":
        return {
          title: t("language-versions-problem-missing-page", {
            count: kind.pages.length,
            language: languageOf(kind.course_id),
            counterpartLanguage: languageOf(kind.counterpart_course_id),
          }),
          description: t("language-versions-problem-missing-page-body", {
            count: kind.pages.length,
            pages: list(kind.pages.map((page) => pageLabel(t, page))),
            counterpartLanguage: languageOf(kind.counterpart_course_id),
          }),
          ...fix,
        }
      case "duplicate_pages_in_group": {
        const target = kind.linked_pages[0]
        return {
          title: t("language-versions-problem-duplicate-pages", {
            count: kind.pages.length,
            language: languageOf(kind.course_id),
          }),
          description: t("language-versions-problem-duplicate-pages-body", {
            page: target ? pageLabel(t, target) : "",
            pages: quoted(kind.pages.map((page) => page.title)),
          }),
          ...fix,
        }
      }
      case "foreign_course_link":
        return {
          title: t("language-versions-problem-foreign-link"),
          description: t("language-versions-problem-foreign-link-body", {
            page: pageLabel(t, kind.page),
            foreignPage: kind.foreign_page.title,
            foreignCourse: kind.foreign_course_name,
          }),
          actionLabel: t("language-versions-unlink"),
          action: { type: "dialog" },
        }
      case "exercise_counterpart_on_other_page":
        return {
          title: t("language-versions-problem-exercise-other-page"),
          description: kind.expected_page
            ? t("language-versions-problem-exercise-other-page-body", {
                exercise: kind.exercise.name,
                page: kind.exercise.page_title,
                language: languageOf(kind.counterpart.course_id),
                counterpart: kind.counterpart.name,
                counterpartPage: kind.counterpart.page_title,
                expectedPage: kind.expected_page.title,
              })
            : t("language-versions-problem-exercise-other-page-body-no-expected", {
                exercise: kind.exercise.name,
                page: kind.exercise.page_title,
                language: languageOf(kind.counterpart.course_id),
                counterpart: kind.counterpart.name,
                counterpartPage: kind.counterpart.page_title,
              }),
          ...fix,
        }
      case "unlinked_exercises":
        return {
          title: t("language-versions-problem-unlinked-exercises", {
            count: kind.exercise_count,
            language: languageOf(kind.course_id),
          }),
          description:
            kind.suggestion_count > 0
              ? t("language-versions-problem-unlinked-exercises-body", {
                  count: kind.suggestion_count,
                })
              : t("language-versions-problem-unlinked-exercises-body-none"),
          actionLabel: t("language-versions-review-suggestions"),
          action: { type: "link-fixer", targetCourseId: kind.course_id },
        }
      case "leftover_links":
        return {
          title: t("language-versions-problem-leftover-links", {
            count: kind.pages.length + kind.exercises.length,
          }),
          description: t("language-versions-problem-leftover-links-body"),
          actionLabel: t("language-versions-remove"),
          action: { type: "dialog" },
        }
      case "duplicate_exercises_in_group":
        return {
          title: t("language-versions-problem-duplicate-exercises", {
            count: kind.exercises.length,
            language: languageOf(kind.course_id),
          }),
          description: t("language-versions-problem-duplicate-exercises-body", {
            exercises: quoted(kind.exercises.map((exercise) => exercise.name)),
          }),
          ...fix,
        }
      case "likely_separate_language_versions":
        return {
          title: t("language-versions-problem-separate-courses", {
            count: kind.candidates.length,
          }),
          description: t("language-versions-problem-separate-courses-body", {
            count: kind.candidates.length,
            courses: list(
              kind.candidates.map((candidate) =>
                t("language-versions-course-with-language", {
                  name: candidate.course.name,
                  language: languageName(candidate.course.language_code),
                }),
              ),
              kind.candidates.length,
            ),
          }),
          actionLabel: t("language-versions-add-as-language-versions"),
          action: {
            type: "guided",
            candidateCourseIds: kind.candidates
              .filter((candidate) => !candidate.blocked_reason)
              .map((candidate) => candidate.course.id),
          },
        }
      case "page_order_differs":
        return {
          title: t("language-versions-problem-page-order", {
            language: languageOf(kind.course_id),
            chapter: kind.chapter_number,
          }),
          description: list(
            kind.pages.map((difference) =>
              t("language-versions-problem-page-order-item", {
                title: difference.page.title,
                position: difference.page.position,
                referencePosition: difference.reference_position,
              }),
            ),
          ),
          ...dismiss,
        }
      case "chapter_count_differs":
        return {
          title: t("language-versions-problem-chapter-count"),
          description: kind.missing_chapters
            .map((missing) =>
              t("language-versions-problem-chapter-count-item", {
                language: languageOf(missing.course_id),
                chapters: list(missing.chapter_numbers.map(String), missing.chapter_numbers.length),
                count: missing.chapter_numbers.length,
              }),
            )
            .join(" "),
          ...dismiss,
        }
      case "page_in_other_chapter_number":
        return {
          title: t("language-versions-problem-other-chapter", {
            count: kind.pages.length,
            language: languageOf(kind.course_id),
            counterpartLanguage: languageOf(kind.counterpart_course_id),
          }),
          description: list(
            kind.pages.map((pair) =>
              t("language-versions-problem-other-chapter-item", {
                title: pair.page.title,
                chapter: pair.page.chapter_number ?? "",
                counterpart: pair.counterpart.title,
                counterpartChapter: pair.counterpart.chapter_number ?? "",
              }),
            ),
          ),
          ...dismiss,
        }
      case "missing_exercise_counterparts":
        return {
          title: t("language-versions-problem-missing-exercises", {
            count: kind.exercises.length,
            language: languageOf(kind.course_id),
            counterpartLanguage: languageOf(kind.counterpart_course_id),
          }),
          description: t("language-versions-problem-missing-exercises-body", {
            exercises: quoted(kind.exercises.map((exercise) => exercise.name)),
          }),
          ...dismiss,
        }
    }
  }
}

function openCountText(
  t: TFunction,
  severity: LanguageVersionProblemSeverity,
  count: number,
): string {
  if (count === 0) {
    return t("language-versions-all-done")
  }
  return severity === "check_intended"
    ? t("language-versions-count-to-check", { count })
    : t("language-versions-count-to-fix", { count })
}

interface Props {
  courseId: string
  report: LanguageVersionReport
  isRefreshing: boolean
  onCheckAgain: () => void
  onAction: (problem: LanguageVersionProblem, action: ProblemAction) => void
  onCompareStructure: () => void
}

/** The problems of the language versions in three groups by severity. */
const ProblemList: React.FC<Props> = ({
  courseId,
  report,
  isRefreshing,
  onCheckAgain,
  onAction,
  onCompareStructure,
}) => {
  const { t } = useTranslation()
  const problemText = useProblemText(report.courses)
  const dismissMutation = useDismissProblemMutation()
  const undismissMutation = useUndismissProblemMutation()
  const readOnlyReason = useReadOnlyReason()
  const problemCount = report.problems.filter((problem) => !problem.dismissal).length

  const runAction = (problem: LanguageVersionProblem, action: ProblemAction) => {
    if (action.type === "dismiss") {
      dismissMutation.mutate(problemDismissal(courseId, problem))
      return
    }
    onAction(problem, action)
  }

  return (
    <section className={sectionCss}>
      <div className={sectionHeadCss}>
        <h2>{t("language-versions-problems-heading")}</h2>
        <div className={headActionsCss}>
          <span className={mutedCss}>
            {t("language-versions-checked")}{" "}
            <RelativeTime at={report.checked_at} absoluteTime={ABSOLUTE_TIME_TITLE} />
          </span>
          <Button variant="secondary" size="small" isLoading={isRefreshing} onPress={onCheckAgain}>
            {t("language-versions-check-again")}
          </Button>
        </div>
      </div>
      <p className={leadCss}>
        {t("language-versions-problems-lead", { count: report.courses.length })}
      </p>
      {problemCount === 0 && report.problems.length === 0 ? (
        <EmptyState
          title={t("language-versions-no-problems")}
          hint={t("language-versions-no-problems-hint")}
        />
      ) : (
        SEVERITIES.map((severity) => {
          const problems = report.problems.filter((problem) => problem.severity === severity)
          if (problems.length === 0) {
            return null
          }
          const openCount = problems.filter((problem) => !problem.dismissal).length
          return (
            <React.Fragment key={severity}>
              <div className={subHeadCss}>
                <h3>{t(SEVERITY_HEADING_KEY[severity])}</h3>
                <Badge tone={openCount === 0 ? TONE.SUCCESS : SEVERITY_TONE[severity]}>
                  {openCountText(t, severity, openCount)}
                </Badge>
              </div>
              <ul className={rowsCss}>
                {problems.map((problem) => {
                  const text = problemText(problem)
                  return (
                    <li key={problem.key} className={problem.dismissal ? dimmedRowCss : undefined}>
                      <div className={rowMainCss}>
                        <span className={rowTitleCss}>{text.title}</span>
                        <span className={rowDescCss}>{text.description}</span>
                      </div>
                      <div className={rowSideCss}>
                        {problem.dismissal ? (
                          <>
                            <Badge tone={TONE.SUCCESS} size="compact">
                              {t("language-versions-marked-as-intended")}
                            </Badge>
                            <Button
                              variant="tertiary"
                              size="small"
                              disabledReason={readOnlyReason}
                              isLoading={
                                undismissMutation.isPending &&
                                undismissMutation.variables?.query.problem_key === problem.key
                              }
                              onPress={() =>
                                undismissMutation.mutate({
                                  path: { course_id: courseId },
                                  query: { problem_key: problem.key },
                                })
                              }
                            >
                              {t("language-versions-report-again")}
                            </Button>
                          </>
                        ) : (
                          <>
                            {problem.kind.kind === "page_order_differs" && (
                              <Button variant="link" onPress={onCompareStructure}>
                                {t("language-versions-compare-structure")}
                              </Button>
                            )}
                            <Button
                              variant="secondary"
                              size="small"
                              disabledReason={readOnlyReason}
                              isLoading={
                                dismissMutation.isPending &&
                                dismissMutation.variables?.body.problem_key === problem.key
                              }
                              onPress={() => runAction(problem, text.action)}
                            >
                              {text.actionLabel}
                            </Button>
                          </>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </React.Fragment>
          )
        })
      )}
    </section>
  )
}

export default ProblemList
