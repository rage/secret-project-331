"use client"

import { css } from "@emotion/css"
import { useQueries, useQueryClient } from "@tanstack/react-query"
import React, { useCallback, useEffect, useMemo, useState } from "react"
import type { Key } from "react-aria"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"

import {
  getLanguageVersionJoinPreviewOptions,
  postLanguageVersionExerciseLinksMutation,
  postLanguageVersionJoinMutation,
  postLanguageVersionPageLinksMutation,
} from "@/generated/api/@tanstack/react-query.generated"
import type { JoinCandidate, LanguageVersionCourse } from "@/generated/api/types.generated"
import {
  useInvalidateLanguageVersions,
  useLanguageVersionJoinCandidates,
  useLanguageVersionMutation,
  useLanguageVersionSuggestions,
} from "@/hooks/useLanguageVersions"
import useDebouncedValue from "@/shared-module/common/hooks/useDebouncedValue"
import useLanguageName from "@/shared-module/common/hooks/useLanguageName"
import { primaryLanguage } from "@/shared-module/common/utils/language"
import {
  Button,
  Checkbox,
  Dialog,
  Infobox,
  LanguageChip,
  QueryResult,
  StatTile,
  StatTileList,
  Stepper,
  TextField,
  ToggleButtonGroup,
  ToggleButtonGroupButton,
  TONE,
} from "@/shared-module/components"

import {
  ITEM_KIND_EXERCISES,
  ITEM_KIND_PAGES,
  OUTSIDE_CHAPTERS,
  SEARCH_DEBOUNCE_MS,
} from "./constants"
import CounterpartMatchTable from "./CounterpartMatchTable"
import { candidateReasonsText, LeavesLanguageVersionsNotice } from "./JoinCourseDialog"
import {
  chapterKey,
  chapterOfRows,
  exerciseMatchRows,
  hasPendingSuggestion,
  initialMatchFields,
  isRowAccepted,
  type MatchFields,
  type MatchRow,
  NO_COUNTERPART,
  pageMatchRows,
  summarizeMatches,
  useDefaultChapter,
} from "./matchRows"
import {
  bulletsCss,
  cancelAction,
  courseById,
  dialogBodyCss,
  hasStudents,
  headActionsCss,
  hintCss,
  leadCss,
  mutedCss,
  orderCourses,
  rowDescCss,
  rowMainCss,
  rowsCss,
  sectionCss,
  studentCountText,
  toolbarCss,
  useBlockedReasonText,
} from "./shared"

const CHAPTER_FIELD = "chapter"
const STEP_COURSES = 0
const STEP_PAGES = 1
const STEP_EXERCISES = 2
const STEP_REVIEW = 3
const LEFT_UNLINKED_LIMIT = 5

const PHASE_EDITING = "editing"
const PHASE_APPLYING = "applying"
const PHASE_APPLIED = "applied"
type Phase = typeof PHASE_EDITING | typeof PHASE_APPLYING | typeof PHASE_APPLIED

const POST = "POST"
// The batch invalidates once after its last request instead of after each one.
const NO_INVALIDATION = "none"

const footerCss = css`
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
`

const cardCss = css`
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--color-gray-100);
  border-radius: var(--control-radius);

  h3,
  p,
  ul {
    margin: 0;
  }
`

const candidateLabelCss = css`
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
`

interface Props {
  courseId: string
  /** The current language versions. */
  courses: LanguageVersionCourse[]
  /** Candidates chosen at the start, e.g. from a "likely translations" problem. */
  initialCandidateIds: string[]
  /** Starts from the pages, e.g. right after a course was joined. */
  startAtPages: boolean
  /** Leaves the flow; `showStructure` asks for the structure comparison. */
  onExit: (showStructure: boolean) => void
}

interface CourseFields {
  search: string
  chosen: Record<string, boolean>
  chapter: Set<Key>
  isAcknowledged: boolean
}

/**
 * First-time linking in four steps: choose the courses that are language versions of this one,
 * check page and exercise counterparts, then join the courses and save the links in one go.
 */
const GuidedLinking: React.FC<Props> = ({
  courseId,
  courses,
  initialCandidateIds,
  startAtPages,
  onExit,
}) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const languageName = useLanguageName()
  const blockedReasonText = useBlockedReasonText()
  const invalidateLanguageVersions = useInvalidateLanguageVersions()
  const [step, setStep] = useState(startAtPages ? STEP_PAGES : STEP_COURSES)
  const [knownCandidates, setKnownCandidates] = useState<Map<string, JoinCandidate>>(new Map())
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>(PHASE_EDITING)
  const courseForm = useForm<CourseFields>({
    defaultValues: {
      search: "",
      chosen: Object.fromEntries(initialCandidateIds.map((id) => [id, true])),
      chapter: new Set(),
      isAcknowledged: false,
    },
  })
  // `watch` returns the form's own object, which is mutated in place, so memos keyed on it go stale.
  const chosenMap = useWatch({
    control: courseForm.control,
    name: "chosen",
    compute: (chosen) => ({ ...chosen }),
  })
  const isAcknowledged = courseForm.watch("isAcknowledged")
  const debouncedSearch = useDebouncedValue(courseForm.watch("search"), SEARCH_DEBOUNCE_MS)

  const candidatesQuery = useLanguageVersionJoinCandidates(
    courseId,
    debouncedSearch,
    step === STEP_COURSES,
  )
  // Chosen courses stay chosen when a new search no longer lists them.
  useEffect(() => {
    if (candidatesQuery.data) {
      setKnownCandidates((previous) => {
        const next = new Map(previous)
        for (const candidate of candidatesQuery.data) {
          next.set(candidate.course.id, candidate)
        }
        return next
      })
    }
  }, [candidatesQuery.data])

  const chosenCandidates = useMemo(
    () =>
      [...knownCandidates.values()].filter((candidate) => chosenMap[candidate.course.id] === true),
    [knownCandidates, chosenMap],
  )
  const chosenIds = useMemo(
    () => chosenCandidates.map((candidate) => candidate.course.id).toSorted(),
    [chosenCandidates],
  )
  const joinPreviewOptions = (candidate: JoinCandidate) =>
    getLanguageVersionJoinPreviewOptions({
      path: { course_id: courseId, joined_course_id: candidate.course.id },
    })
  const joinPreviewQueries = useQueries({
    queries: chosenCandidates.map((candidate) => ({
      ...joinPreviewOptions(candidate),
      enabled: step === STEP_REVIEW,
    })),
  })
  const movingStudentCount = chosenCandidates.reduce(
    (sum, candidate) => sum + (candidate.course.student_count ?? 0),
    0,
  )
  const allCourses = useMemo(
    () =>
      orderCourses(
        [...courses, ...chosenCandidates.map((candidate) => candidate.course)],
        courseId,
      ),
    [courses, chosenCandidates, courseId],
  )
  const thisCourse = courseById(courses, courseId)
  const otherCourses = allCourses.filter((course) => course.id !== courseId)
  // Keyed by the ids so that rebuilding the course list doesn't rebuild the rows and reset picks.
  const otherCourseIdsKey = otherCourses.map((course) => course.id).join(",")
  const otherCourseIds = useMemo(
    () => new Set(otherCourseIdsKey.split(",").filter((id) => id !== "")),
    [otherCourseIdsKey],
  )
  const suggestionsQuery = useLanguageVersionSuggestions(
    courseId,
    null,
    chosenIds,
    step !== STEP_COURSES,
  )
  const pageRows = useMemo(
    () => pageMatchRows(t, languageName, suggestionsQuery.data?.pages ?? [], otherCourseIds),
    [suggestionsQuery.data, t, languageName, otherCourseIds],
  )
  const exerciseRows = useMemo(
    () =>
      exerciseMatchRows(t, languageName, suggestionsQuery.data?.exercises ?? [], otherCourseIds),
    [suggestionsQuery.data, t, languageName, otherCourseIds],
  )
  const matchForm = useForm<MatchFields>({ defaultValues: { picks: {}, accepted: {} } })
  const { reset: resetMatches } = matchForm
  useEffect(() => {
    resetMatches(initialMatchFields([...pageRows, ...exerciseRows], true))
  }, [pageRows, exerciseRows, resetMatches])
  const summary = useWatch({
    control: matchForm.control,
    compute: (fields: MatchFields) => ({
      pages: summarizeMatches(pageRows, fields),
      exercises: summarizeMatches(exerciseRows, fields),
    }),
  })
  const pageChanges = summary.pages.changes
  const exerciseChanges = summary.exercises.changes

  const pageChapterOf = useMemo(
    () => chapterOfRows(suggestionsQuery.data?.pages ?? []),
    [suggestionsQuery.data],
  )
  const exerciseChapterOf = useMemo(
    () => chapterOfRows(suggestionsQuery.data?.exercises ?? []),
    [suggestionsQuery.data],
  )
  const chapterKeys = useMemo(
    () =>
      [...new Set(pageChapterOf.values())].toSorted((a, b) =>
        a === OUTSIDE_CHAPTERS ? -1 : b === OUTSIDE_CHAPTERS ? 1 : Number(a) - Number(b),
      ),
    [pageChapterOf],
  )
  const { setValue: setCourseValue } = courseForm
  const pickChapter = useCallback(
    (key: string) => setCourseValue(CHAPTER_FIELD, new Set([key])),
    [setCourseValue],
  )
  const chapter =
    useDefaultChapter(courseForm.watch("chapter"), chapterKeys, pickChapter) ?? OUTSIDE_CHAPTERS

  const chapterLabel = (key: string) =>
    key === OUTSIDE_CHAPTERS
      ? t("language-versions-no-chapter")
      : t("language-versions-chapter-number", { number: key })

  const joinMutation = useLanguageVersionMutation(
    postLanguageVersionJoinMutation(),
    POST,
    NO_INVALIDATION,
  )
  const pageLinksMutation = useLanguageVersionMutation(
    postLanguageVersionPageLinksMutation(),
    POST,
    NO_INVALIDATION,
  )
  const exerciseLinksMutation = useLanguageVersionMutation(
    postLanguageVersionExerciseLinksMutation(),
    POST,
    NO_INVALIDATION,
  )

  const acceptAll = (rows: MatchRow[]) => {
    const fields = matchForm.getValues()
    const withSuggestion = rows.filter((row) => hasPendingSuggestion(row))
    const accept = withSuggestion.some(
      (row) => !isRowAccepted(row, fields.picks[row.id], fields.accepted[row.id]),
    )
    for (const row of withSuggestion) {
      matchForm.setValue(`accepted.${row.id}`, accept)
    }
  }

  const apply = async () => {
    setPhase(PHASE_APPLYING)
    try {
      for (const candidate of chosenCandidates) {
        // The preview the teacher reviewed, so the join checks the student count they saw.
        const preview = await queryClient.ensureQueryData(joinPreviewOptions(candidate))
        await joinMutation.mutateAsync({
          path: { course_id: courseId },
          body: {
            course_id: candidate.course.id,
            expected_student_count: preview.expected_student_count,
          },
        })
      }
      if (pageChanges.length > 0) {
        await pageLinksMutation.mutateAsync({
          path: { course_id: courseId },
          body: { changes: pageChanges },
        })
      }
      if (exerciseChanges.length > 0) {
        await exerciseLinksMutation.mutateAsync({
          path: { course_id: courseId },
          body: { changes: exerciseChanges },
        })
      }
      setPhase(PHASE_APPLIED)
    } catch {
      // The mutation's toast shows the error; whatever succeeded stays applied.
      setPhase(PHASE_EDITING)
    } finally {
      setIsConfirmOpen(false)
      void invalidateLanguageVersions()
    }
  }

  const leftWithoutCounterpart = (): string[] => {
    const { picks } = matchForm.getValues()
    const items: string[] = []
    for (const row of pageRows) {
      for (const counterpart of row.counterparts) {
        if ((picks[row.id]?.[counterpart.courseId] ?? NO_COUNTERPART) === NO_COUNTERPART) {
          const course = courseById(allCourses, counterpart.courseId)
          items.push(
            t("language-versions-left-page-missing", {
              page: row.label,
              language: course ? languageName(course.language_code) : "",
            }),
          )
        }
      }
    }
    for (const page of suggestionsQuery.data?.unmatched_pages ?? []) {
      items.push(
        t("language-versions-left-page-only-in", {
          page: page.title,
          language: languageName(page.language_code),
        }),
      )
    }
    for (const course of otherCourses) {
      const count = exerciseRows.filter(
        (row) => (picks[row.id]?.[course.id] ?? NO_COUNTERPART) === NO_COUNTERPART,
      ).length
      if (count > 0) {
        items.push(
          t("language-versions-left-exercises-missing", {
            count,
            language: languageName(course.language_code),
          }),
        )
      }
    }
    return items
  }

  const renderCandidate = (candidate: JoinCandidate) => {
    const id = candidate.course.id
    const blocked = blockedReasonText(candidate.blocked_reason, candidate.course)
    const sameLanguageChosen =
      chosenMap[id] !== true &&
      (chosenCandidates.some(
        (other) =>
          primaryLanguage(other.course.language_code) ===
          primaryLanguage(candidate.course.language_code),
      ) ||
        courses.some(
          (course) =>
            primaryLanguage(course.language_code) ===
            primaryLanguage(candidate.course.language_code),
        ))
    const disabledText =
      blocked ??
      (sameLanguageChosen
        ? t("language-versions-language-already-chosen", {
            language: languageName(candidate.course.language_code),
          })
        : null)
    return (
      <li key={id}>
        <div className={rowMainCss}>
          <Checkbox
            name={`chosen.${id}`}
            control={courseForm.control}
            isDisabled={disabledText !== null}
            label={
              <span className={candidateLabelCss}>
                <LanguageChip code={candidate.course.language_code} />
                {candidate.course.name}
              </span>
            }
            description={
              <>
                {candidate.course.slug}
                <span className={hintCss}>{candidateReasonsText(t, candidate)}</span>
                {disabledText && <span className={hintCss}>{disabledText}</span>}
              </>
            }
          />
        </div>
        <span className={hasStudents(candidate.course) ? rowDescCss : mutedCss}>
          {studentCountText(t, candidate.course)}
        </span>
      </li>
    )
  }

  const renderMatchStep = (kind: typeof ITEM_KIND_PAGES | typeof ITEM_KIND_EXERCISES) => {
    const rows = kind === ITEM_KIND_PAGES ? pageRows : exerciseRows
    const { pendingCount } = kind === ITEM_KIND_PAGES ? summary.pages : summary.exercises
    const chapterOf = kind === ITEM_KIND_PAGES ? pageChapterOf : exerciseChapterOf
    const chapterRows = rows.filter((row) => chapterOf.get(row.id) === chapter)
    const unmatched =
      kind === ITEM_KIND_PAGES
        ? (suggestionsQuery.data?.unmatched_pages ?? []).filter(
            (page) => chapterKey(page.chapter_number) === chapter,
          )
        : []
    return (
      <>
        <div className={toolbarCss}>
          <ToggleButtonGroup
            name="chapter"
            control={courseForm.control}
            label={null}
            aria-label={t("language-versions-chapter-picker")}
          >
            {chapterKeys.map((key) => (
              <ToggleButtonGroupButton key={key} id={key}>
                {chapterLabel(key)}
              </ToggleButtonGroupButton>
            ))}
          </ToggleButtonGroup>
          <Button variant="secondary" size="medium" onPress={() => acceptAll(rows)}>
            {pendingCount > 0
              ? t("language-versions-accept-all")
              : t("language-versions-undo-accept-all")}
          </Button>
        </div>
        <QueryResult query={suggestionsQuery} treatEmptyAsData>
          {() =>
            thisCourse ? (
              <CounterpartMatchTable
                caption={chapterLabel(chapter)}
                referenceCourse={thisCourse}
                courses={otherCourses}
                rows={chapterRows}
                control={matchForm.control}
                onAccept={(rowId) => matchForm.setValue(`accepted.${rowId}`, true)}
                emptyState={
                  <span className={mutedCss}>
                    {kind === ITEM_KIND_PAGES
                      ? t("language-versions-chapter-no-pages")
                      : t("language-versions-chapter-no-exercises")}
                  </span>
                }
              />
            ) : null
          }
        </QueryResult>
        {unmatched.map((page) => (
          <p key={page.id} className={hintCss}>
            {t("language-versions-only-in-language", {
              page: page.title,
              language: languageName(page.language_code),
            })}
          </p>
        ))}
      </>
    )
  }

  const isJoining = chosenCandidates.length > 0
  const isApplied = phase === PHASE_APPLIED
  const versionCount = allCourses.length

  return (
    <section className={sectionCss}>
      <Stepper
        aria-label={t("language-versions-steps")}
        currentStep={isApplied ? STEP_REVIEW + 1 : step}
        steps={[
          { label: t("language-versions-guided-step-courses") },
          { label: t("language-versions-guided-step-pages") },
          { label: t("language-versions-guided-step-exercises") },
          { label: t("language-versions-guided-step-review") },
        ]}
      />

      {step === STEP_COURSES && (
        <>
          <h2>{t("language-versions-guided-courses-title")}</h2>
          <p className={leadCss}>
            {courses.length > 1
              ? t("language-versions-guided-courses-lead-more")
              : t("language-versions-guided-courses-lead")}
          </p>
          <QueryResult
            query={candidatesQuery}
            emptyFallback={<p className={mutedCss}>{t("language-versions-join-no-results")}</p>}
          >
            {(candidates) => (
              <ul className={rowsCss}>
                {candidates.map((candidate) => renderCandidate(candidate))}
              </ul>
            )}
          </QueryResult>
          <TextField
            name="search"
            control={courseForm.control}
            type="search"
            label={t("language-versions-guided-search-label")}
          />
          {movingStudentCount > 0 ? (
            <Infobox
              tone={TONE.WARNING}
              heading={t("language-versions-guided-students-heading", {
                count: movingStudentCount,
              })}
            >
              {t("language-versions-guided-students-body")}
            </Infobox>
          ) : (
            <Infobox>
              {chosenCandidates.length > 0
                ? t("language-versions-guided-no-students-drafts")
                : t("language-versions-no-students-affected")}
            </Infobox>
          )}
        </>
      )}

      {step === STEP_PAGES && (
        <>
          <h2>{t("language-versions-guided-pages-title")}</h2>
          <p className={leadCss}>{t("language-versions-guided-pages-lead")}</p>
          {renderMatchStep(ITEM_KIND_PAGES)}
        </>
      )}

      {step === STEP_EXERCISES && (
        <>
          <h2>{t("language-versions-guided-exercises-title")}</h2>
          <p className={leadCss}>{t("language-versions-guided-exercises-lead")}</p>
          {renderMatchStep(ITEM_KIND_EXERCISES)}
        </>
      )}

      {step === STEP_REVIEW && !isApplied && (
        <>
          <h2>{t("language-versions-guided-review-title")}</h2>
          <p className={leadCss}>{t("language-versions-guided-review-lead")}</p>
          <StatTileList>
            {isJoining && (
              <StatTile
                label={t("language-versions-guided-stat-courses", {
                  count: chosenCandidates.length,
                })}
                value={chosenCandidates.length}
              />
            )}
            <StatTile
              label={t("language-versions-guided-stat-pages", { count: pageChanges.length })}
              value={pageChanges.length}
            />
            <StatTile
              label={t("language-versions-guided-stat-exercises", {
                count: exerciseChanges.length,
              })}
              value={exerciseChanges.length}
            />
          </StatTileList>
          {summary.pages.pendingCount > 0 && (
            <p className={hintCss}>
              {t("language-versions-guided-pages-not-accepted", {
                count: summary.pages.pendingCount,
              })}
            </p>
          )}
          {summary.exercises.pendingCount > 0 && (
            <p className={hintCss}>
              {t("language-versions-guided-exercises-not-accepted", {
                count: summary.exercises.pendingCount,
              })}
            </p>
          )}
          {(() => {
            const left = leftWithoutCounterpart()
            if (left.length === 0) {
              return null
            }
            return (
              <div className={cardCss}>
                <h3>{t("language-versions-left-without-counterpart")}</h3>
                <ul className={bulletsCss}>
                  {left.slice(0, LEFT_UNLINKED_LIMIT).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                  {left.length > LEFT_UNLINKED_LIMIT && (
                    <li>
                      {t("language-versions-n-more", { count: left.length - LEFT_UNLINKED_LIMIT })}
                    </li>
                  )}
                </ul>
                <p className={hintCss}>{t("language-versions-fix-later")}</p>
              </div>
            )
          })()}
          {joinPreviewQueries.map(
            (query) =>
              query.data && (
                <LeavesLanguageVersionsNotice key={query.data.course.id} preview={query.data} />
              ),
          )}
          {isJoining && (
            <div className={cardCss}>
              <h3>{t("language-versions-what-changes")}</h3>
              <ul className={bulletsCss}>
                <li>{t("language-versions-guided-change-switcher", { count: versionCount })}</li>
                <li>{t("language-versions-guided-change-enrol-one", { count: versionCount })}</li>
                <li>{t("language-versions-guided-change-shared", { count: versionCount })}</li>
                <li>{t("language-versions-points-stay")}</li>
                <li>{t("language-versions-change-no-content")}</li>
              </ul>
            </div>
          )}
        </>
      )}

      {isApplied && (
        <>
          <Infobox tone={TONE.SUCCESS} heading={t("language-versions-changes-applied")} announce>
            {isJoining
              ? t("language-versions-changes-applied-body-joined")
              : t("language-versions-changes-applied-body")}
          </Infobox>
          <div className={headActionsCss}>
            <Button variant="secondary" size="medium" onPress={() => onExit(false)}>
              {t("language-versions-check-again-link")}
            </Button>
            <Button variant="secondary" size="medium" onPress={() => onExit(true)}>
              {t("language-versions-compare-structure")}
            </Button>
          </div>
        </>
      )}

      {!isApplied && (
        <div className={footerCss}>
          <Button
            variant="secondary"
            size="medium"
            onPress={() =>
              step === STEP_COURSES || (startAtPages && step === STEP_PAGES)
                ? onExit(false)
                : setStep(step - 1)
            }
          >
            {step === STEP_COURSES || (startAtPages && step === STEP_PAGES)
              ? t("button-text-cancel")
              : t("language-versions-back")}
          </Button>
          <Button
            variant="primary"
            size="medium"
            disabled={step === STEP_COURSES && chosenCandidates.length === 0 && courses.length < 2}
            onPress={() => (step === STEP_REVIEW ? setIsConfirmOpen(true) : setStep(step + 1))}
          >
            {step === STEP_REVIEW
              ? t("language-versions-apply-changes")
              : t("language-versions-continue")}
          </Button>
        </div>
      )}

      <Dialog
        open={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        title={t("language-versions-apply-title")}
        actions={[
          cancelAction(t, () => setIsConfirmOpen(false)),
          {
            label: t("language-versions-apply-changes"),
            variant: "primary",
            isLoading: phase === PHASE_APPLYING,
            disabled: movingStudentCount > 0 && !isAcknowledged,
            onPress: () => void apply(),
          },
        ]}
      >
        <div className={dialogBodyCss}>
          <p>
            {isJoining
              ? t("language-versions-apply-body-joined", { count: versionCount })
              : t("language-versions-apply-body")}
          </p>
          {movingStudentCount > 0 ? (
            <Checkbox
              name="isAcknowledged"
              control={courseForm.control}
              label={t("language-versions-join-acknowledge", { count: movingStudentCount })}
            />
          ) : (
            isJoining && <p className={mutedCss}>{t("language-versions-apply-no-students")}</p>
          )}
        </div>
      </Dialog>
    </section>
  )
}

export default GuidedLinking
