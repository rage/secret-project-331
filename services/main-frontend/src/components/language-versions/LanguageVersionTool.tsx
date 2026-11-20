"use client"

import { css } from "@emotion/css"
import React, { useState } from "react"
import type { Key } from "react-aria"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import type { LanguageVersionProblem } from "@/generated/api/types.generated"
import { useLanguageVersionReport } from "@/hooks/useLanguageVersions"
import {
  Button,
  Infobox,
  QueryResult,
  ToggleButtonGroup,
  ToggleButtonGroupButton,
  TONE,
} from "@/shared-module/components"

import type { ADMIN_MODE, TEACHER_MODE } from "./constants"
import CoursesSection from "./CoursesSection"
import ProblemFixDialog from "./fixers/ProblemFixDialog"
import GuidedLinking from "./GuidedLinking"
import LinkFixer from "./LinkFixer"
import ProblemList from "./ProblemList"
import { CanEditAllCoursesContext, courseById, useListFormatter } from "./shared"
import StructureComparison from "./StructureComparison"

/** Where the tool is shown: a course's Language versions tab, or the admin tool. */
export type LanguageVersionToolMode = typeof TEACHER_MODE | typeof ADMIN_MODE

const VIEW_CHECK = "check"
const VIEW_STRUCTURE = "structure"

/** From this many pages without a counterpart, linking one page per dialog is too slow. */
const MANY_UNLINKED_PAGES = 5

type Flow =
  | { type: "link-fixer"; targetCourseId: string }
  | { type: "guided"; candidateCourseIds: string[]; startAtPages: boolean }

const toolCss = css`
  display: grid;
  gap: var(--space-6);
  min-width: 0;
`

const joinedNoticeCss = css`
  display: grid;
  gap: var(--space-3);
  justify-items: start;
`

interface Props {
  courseId: string
  mode: LanguageVersionToolMode
  /** Extra buttons in the courses section, e.g. creating a new language version. */
  extraCourseActions?: React.ReactNode
}

interface ViewFields {
  view: Set<Key>
}

/**
 * Checks and fixes how a course's language versions are connected: which courses belong
 * together, and which pages and exercises are counterparts of each other.
 */
export const LanguageVersionTool: React.FC<Props> = ({ courseId, mode, extraCourseActions }) => {
  const { t } = useTranslation()
  const list = useListFormatter()
  const reportQuery = useLanguageVersionReport(courseId)
  const [flow, setFlow] = useState<Flow | null>(null)
  const [activeProblem, setActiveProblem] = useState<LanguageVersionProblem | null>(null)
  const [joinedCourseId, setJoinedCourseId] = useState<string | null>(null)
  const { control, watch, setValue } = useForm<ViewFields>({
    defaultValues: { view: new Set([VIEW_CHECK]) },
  })
  const view = [...watch("view")][0] ?? VIEW_CHECK

  return (
    <QueryResult query={reportQuery}>
      {(report) => {
        if (flow?.type === "guided") {
          return (
            <GuidedLinking
              courseId={courseId}
              courses={report.courses}
              initialCandidateIds={flow.candidateCourseIds}
              startAtPages={flow.startAtPages}
              onExit={(showStructure) => {
                setFlow(null)
                setJoinedCourseId(null)
                setValue("view", new Set([showStructure ? VIEW_STRUCTURE : VIEW_CHECK]))
                void reportQuery.refetch()
              }}
            />
          )
        }
        const lockedCourses = report.courses.filter((course) => !course.can_edit)
        const changesetCourses = report.courses.filter((course) =>
          report.courses_with_open_agent_changesets.includes(course.id),
        )
        const joinedCourse = joinedCourseId ? courseById(report.courses, joinedCourseId) : undefined
        const hasManyUnlinkedPages = report.problems.some(
          (problem) =>
            !problem.dismissal &&
            problem.kind.kind === "missing_page_counterpart" &&
            problem.kind.pages.length >= MANY_UNLINKED_PAGES,
        )
        const readOnlyReason = report.can_edit_all_courses
          ? undefined
          : t("language-versions-read-only-reason")
        return (
          <CanEditAllCoursesContext.Provider value={report.can_edit_all_courses}>
            <div className={toolCss}>
              {!report.can_edit_all_courses && (
                <Infobox tone={TONE.WARNING} heading={t("language-versions-read-only-heading")}>
                  {t("language-versions-read-only-body", {
                    courses: list(
                      lockedCourses.map((course) => course.name),
                      lockedCourses.length,
                    ),
                  })}
                </Infobox>
              )}
              {changesetCourses.length > 0 && (
                <Infobox
                  tone={TONE.WARNING}
                  heading={t("language-versions-open-changesets-heading")}
                >
                  {t("language-versions-open-changesets-body", {
                    courses: list(
                      changesetCourses.map((course) => course.name),
                      changesetCourses.length,
                    ),
                  })}
                </Infobox>
              )}
              <CoursesSection
                courseId={courseId}
                mode={mode}
                courses={report.courses}
                extraActions={
                  <>
                    {extraCourseActions}
                    {/* Reopens every page and exercise link for checking, not only the missing ones. */}
                    {report.courses.length > 1 && (
                      <Button
                        variant="secondary"
                        size="medium"
                        disabledReason={readOnlyReason}
                        onPress={() =>
                          setFlow({ type: "guided", candidateCourseIds: [], startAtPages: true })
                        }
                      >
                        {t("language-versions-link-step-by-step")}
                      </Button>
                    )}
                  </>
                }
                onJoined={setJoinedCourseId}
              />
              {report.courses.length === 1 && (
                <Infobox heading={t("language-versions-no-other-versions-heading")}>
                  <div className={joinedNoticeCss}>
                    {t("language-versions-no-other-versions-body")}
                    <Button
                      variant="secondary"
                      size="medium"
                      disabledReason={readOnlyReason}
                      onPress={() =>
                        setFlow({ type: "guided", candidateCourseIds: [], startAtPages: false })
                      }
                    >
                      {t("language-versions-find-step-by-step")}
                    </Button>
                  </div>
                </Infobox>
              )}
              {joinedCourse && (
                <Infobox tone={TONE.SUCCESS} announce>
                  <div className={joinedNoticeCss}>
                    {t("language-versions-joined-notice", { name: joinedCourse.name })}
                    <Button
                      variant="primary"
                      size="medium"
                      onPress={() =>
                        setFlow({ type: "guided", candidateCourseIds: [], startAtPages: true })
                      }
                    >
                      {t("language-versions-check-suggested-links")}
                    </Button>
                  </div>
                </Infobox>
              )}
              {flow?.type === "link-fixer" ? (
                <LinkFixer
                  courseId={courseId}
                  courses={report.courses}
                  targetCourseId={flow.targetCourseId}
                  onBack={() => setFlow(null)}
                />
              ) : (
                <>
                  {report.courses.length > 1 && (
                    <ToggleButtonGroup
                      name="view"
                      control={control}
                      label={null}
                      aria-label={t("language-versions-view-switch")}
                    >
                      <ToggleButtonGroupButton id={VIEW_CHECK}>
                        {t("language-versions-view-check")}
                      </ToggleButtonGroupButton>
                      <ToggleButtonGroupButton id={VIEW_STRUCTURE}>
                        {t("language-versions-compare-structure")}
                      </ToggleButtonGroupButton>
                    </ToggleButtonGroup>
                  )}
                  {hasManyUnlinkedPages && !joinedCourse && view === VIEW_CHECK && (
                    <Infobox heading={t("language-versions-many-unlinked-heading")}>
                      <div className={joinedNoticeCss}>
                        {t("language-versions-many-unlinked-body")}
                        <Button
                          variant="primary"
                          size="medium"
                          disabledReason={readOnlyReason}
                          onPress={() =>
                            setFlow({ type: "guided", candidateCourseIds: [], startAtPages: true })
                          }
                        >
                          {t("language-versions-link-step-by-step")}
                        </Button>
                      </div>
                    </Infobox>
                  )}
                  {view === VIEW_STRUCTURE && report.courses.length > 1 ? (
                    <StructureComparison courseId={courseId} />
                  ) : (
                    <ProblemList
                      courseId={courseId}
                      report={report}
                      isRefreshing={reportQuery.isFetching}
                      onCheckAgain={() => void reportQuery.refetch()}
                      onCompareStructure={() => setValue("view", new Set([VIEW_STRUCTURE]))}
                      onAction={(problem, action) => {
                        if (action.type === "link-fixer") {
                          setFlow({ type: "link-fixer", targetCourseId: action.targetCourseId })
                        } else if (action.type === "guided") {
                          setFlow({
                            type: "guided",
                            candidateCourseIds: action.candidateCourseIds,
                            startAtPages: false,
                          })
                        } else {
                          setActiveProblem(problem)
                        }
                      }}
                    />
                  )}
                </>
              )}
              {activeProblem && (
                <ProblemFixDialog
                  courseId={courseId}
                  courses={report.courses}
                  problem={activeProblem}
                  onClose={() => setActiveProblem(null)}
                />
              )}
            </div>
          </CanEditAllCoursesContext.Provider>
        )
      }}
    </QueryResult>
  )
}
