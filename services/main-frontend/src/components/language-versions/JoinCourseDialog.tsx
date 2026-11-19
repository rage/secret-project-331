"use client"

import { css } from "@emotion/css"
import type { TFunction } from "i18next"
import React, { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import type {
  JoinCandidate,
  JoinCandidateReason,
  JoinLanguageVersionPreview,
  LanguageVersionCourse,
  StudentDataCount,
  StudentDataKind,
} from "@/generated/api/types.generated"
import {
  useJoinLanguageVersionMutation,
  useLanguageVersionJoinCandidates,
  useLanguageVersionJoinPreview,
} from "@/hooks/useLanguageVersions"
import useDebouncedValue from "@/shared-module/common/hooks/useDebouncedValue"
import useLanguageName from "@/shared-module/common/hooks/useLanguageName"
import {
  Checkbox,
  DescriptionList,
  Dialog,
  Infobox,
  QueryResult,
  Radio,
  RadioGroup,
  Stepper,
  Table,
  TextField,
  TONE,
} from "@/shared-module/components"

import { ADMIN_MODE, ALIGN_END, DENSITY_COMPACT, SEARCH_DEBOUNCE_MS } from "./constants"
import type { LanguageVersionToolMode } from "./LanguageVersionTool"
import {
  bulletsCss,
  courseContentText,
  dialogBodyCss,
  hintCss,
  mutedCss,
  studentCountText,
  useBlockedReasonText,
  useListFormatter,
} from "./shared"

const CANDIDATE_REASON_KEY = {
  copied_from_this_course: "language-versions-candidate-copied-from-this-course",
  copied_from_same_course: "language-versions-candidate-copied-from-same-course",
  same_chapter_and_page_counts: "language-versions-candidate-same-counts",
  same_teachers: "language-versions-candidate-same-teachers",
  created_on_same_day: "language-versions-candidate-created-same-day",
  similar_name: "language-versions-candidate-similar-name",
} as const satisfies Record<JoinCandidateReason, string>

const MOVED_DATA_KEY = {
  enrolment_settings: "language-versions-moved-enrolment-settings",
  hidden_from_my_courses: "language-versions-moved-hidden-from-my-courses",
  completions: "language-versions-moved-completions",
  marketing_consents: "language-versions-moved-marketing-consents",
  ai_notice_acknowledgements: "language-versions-moved-ai-notice-acknowledgements",
  mailing_list_access_tokens: "language-versions-moved-mailing-list-access-tokens",
  mailchimp_tags: "language-versions-moved-mailchimp-tags",
} as const satisfies Record<StudentDataKind, string>

const stepperCss = css`
  margin-bottom: var(--space-2);
`

/** Why a course looks like a translation, e.g. "Created on the same day. 7 chapters, 33 pages." */
export function candidateReasonsText(t: TFunction, candidate: JoinCandidate): string {
  return [
    ...candidate.reasons.map((reason) => t(CANDIDATE_REASON_KEY[reason])),
    courseContentText(t, candidate.course),
  ].join(" ")
}

/** What moves with a join or split, one row per kind of student data. */
export const MovedDataTable: React.FC<{ movedData: StudentDataCount[] }> = ({ movedData }) => {
  const { t } = useTranslation()
  return (
    <Table
      caption={t("language-versions-moved-caption")}
      density={DENSITY_COMPACT}
      rows={movedData}
      rowKey={(row) => row.kind}
      columns={[
        {
          header: t("language-versions-moved-what"),
          cell: (row) => t(MOVED_DATA_KEY[row.kind]),
          grow: true,
        },
        {
          header: t("language-versions-column-students"),
          cell: (row) => row.count,
          align: ALIGN_END,
        },
      ]}
    />
  )
}

/**
 * Warns that a join takes the course out of the language versions it already belongs to, or
 * renders nothing when it has none.
 */
export const LeavesLanguageVersionsNotice: React.FC<{ preview: JoinLanguageVersionPreview }> = ({
  preview,
}) => {
  const { t } = useTranslation()
  const languageName = useLanguageName()
  const list = useListFormatter()
  const left = preview.left_language_versions
  if (left.length === 0) {
    return null
  }
  return (
    <Infobox
      tone={TONE.WARNING}
      heading={t("language-versions-join-leaves-heading", { name: preview.course.name })}
    >
      <p>
        {t("language-versions-join-leaves-body", {
          count: left.length,
          courses: list(
            left.map((course) =>
              t("language-versions-course-with-language", {
                name: course.name,
                language: languageName(course.language_code),
              }),
            ),
            left.length,
          ),
        })}
      </p>
      {preview.unlinked_page_count + preview.unlinked_exercise_count > 0 && (
        <p>
          {t("language-versions-join-leaves-unlinks", {
            pages: preview.unlinked_page_count,
            exercises: preview.unlinked_exercise_count,
          })}
        </p>
      )}
    </Infobox>
  )
}

interface Props {
  courseId: string
  mode: LanguageVersionToolMode
  courses: LanguageVersionCourse[]
  open: boolean
  onClose: () => void
  onJoined: (joinedCourseId: string) => void
}

interface JoinFields {
  search: string
  pickedCourseId: string
  isAcknowledged: boolean
}

const STEP_FIND = 0
const STEP_CHECK = 1
const STEP_CONFIRM = 2

/** Adds an existing course as a language version in three steps: find, check, confirm. */
const JoinCourseDialog: React.FC<Props> = ({
  courseId,
  mode,
  courses,
  open,
  onClose,
  onJoined,
}) => {
  const { t } = useTranslation()
  const languageName = useLanguageName()
  const blockedReasonText = useBlockedReasonText()
  const list = useListFormatter()
  const [step, setStep] = useState(STEP_FIND)
  const { control, watch, reset, setValue } = useForm<JoinFields>({
    defaultValues: { search: "", pickedCourseId: "", isAcknowledged: false },
  })
  const search = watch("search")
  const pickedCourseId = watch("pickedCourseId")
  const isAcknowledged = watch("isAcknowledged")

  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS)

  useEffect(() => {
    if (open) {
      reset()
      setStep(STEP_FIND)
    }
  }, [open, reset])

  // The acknowledgement covers one course's students, so it never carries over to another pick.
  useEffect(() => {
    if (step !== STEP_CONFIRM) {
      setValue("isAcknowledged", false)
    }
  }, [step, pickedCourseId, setValue])

  const candidatesQuery = useLanguageVersionJoinCandidates(courseId, debouncedSearch, open)
  const previewQuery = useLanguageVersionJoinPreview(
    courseId,
    open && step !== STEP_FIND && pickedCourseId !== "" ? pickedCourseId : null,
  )
  const joinMutation = useJoinLanguageVersionMutation()
  const thisCourse = courses.find((course) => course.id === courseId)
  const thisCourseName = thisCourse?.name ?? ""
  const preview = previewQuery.data
  const studentCount = preview?.expected_student_count ?? 0
  const isBlocked = Boolean(preview?.blocked_reason)

  const join = () => {
    if (!preview) {
      return
    }
    joinMutation.mutate(
      {
        path: { course_id: courseId },
        body: { course_id: preview.course.id, expected_student_count: studentCount },
      },
      {
        onSuccess: () => onJoined(preview.course.id),
        onError: () => {
          void previewQuery.refetch()
        },
      },
    )
  }

  const back =
    step === STEP_FIND
      ? { label: t("button-text-cancel"), variant: "secondary" as const, onPress: onClose }
      : {
          label: t("language-versions-back"),
          variant: "secondary" as const,
          onPress: () => setStep(step - 1),
        }
  const next =
    step === STEP_CONFIRM
      ? {
          label: t("language-versions-join-confirm"),
          variant: "primary" as const,
          disabled: !preview || isBlocked || (studentCount > 0 && !isAcknowledged),
          isLoading: joinMutation.isPending,
          onPress: join,
        }
      : {
          label: t("language-versions-continue"),
          variant: "primary" as const,
          disabled: pickedCourseId === "" || (step === STEP_CHECK && (!preview || isBlocked)),
          onPress: () => setStep(step + 1),
        }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="wide"
      title={t("language-versions-join-title")}
      actions={[back, next]}
    >
      <div className={dialogBodyCss}>
        <Stepper
          className={stepperCss}
          aria-label={t("language-versions-steps")}
          currentStep={step}
          steps={[
            { label: t("language-versions-join-step-find") },
            { label: t("language-versions-join-step-check") },
            { label: t("language-versions-join-step-confirm") },
          ]}
        />
        {step === STEP_FIND && (
          <>
            <p>{t("language-versions-join-find-lead", { name: thisCourseName })}</p>
            <TextField
              name="search"
              control={control}
              type="search"
              label={t("language-versions-course-search-label")}
            />
            <QueryResult
              query={candidatesQuery}
              emptyFallback={<p className={mutedCss}>{t("language-versions-join-no-results")}</p>}
            >
              {(candidates) => (
                <RadioGroup
                  name="pickedCourseId"
                  control={control}
                  label={t("language-versions-join-results-label")}
                >
                  {candidates.map((candidate) => {
                    const blocked = blockedReasonText(candidate.blocked_reason, candidate.course)
                    return (
                      <Radio
                        key={candidate.course.id}
                        value={candidate.course.id}
                        isDisabled={blocked !== null}
                        label={`${candidate.course.name} (${languageName(candidate.course.language_code)})`}
                        description={
                          <>
                            {candidate.course.slug}
                            <span className={hintCss}>{candidateReasonsText(t, candidate)}</span>
                            <span className={hintCss}>{studentCountText(t, candidate.course)}</span>
                            {blocked && <span className={hintCss}>{blocked}</span>}
                          </>
                        }
                      />
                    )
                  })}
                </RadioGroup>
              )}
            </QueryResult>
            <p className={hintCss}>
              {mode === ADMIN_MODE
                ? t("language-versions-join-admin-any")
                : t("language-versions-join-editable-only")}
            </p>
          </>
        )}
        {step === STEP_CHECK && (
          <QueryResult query={previewQuery}>
            {(data) => (
              <>
                <p>
                  {t("language-versions-join-becomes", {
                    name: data.course.name,
                    language: languageName(data.course.language_code),
                    course: thisCourseName,
                  })}
                </p>
                {blockedReasonText(data.blocked_reason, data.course) && (
                  <Infobox tone={TONE.DANGER}>
                    {blockedReasonText(data.blocked_reason, data.course)}
                  </Infobox>
                )}
                <LeavesLanguageVersionsNotice preview={data} />
                <h3>{t("language-versions-for-students")}</h3>
                {data.expected_student_count > 0 ? (
                  <>
                    <Infobox
                      tone={TONE.WARNING}
                      heading={t("language-versions-join-students-heading", {
                        count: data.expected_student_count,
                      })}
                    >
                      {t("language-versions-join-students-body", {
                        name: data.course.name,
                        course: thisCourseName,
                      })}
                    </Infobox>
                    <MovedDataTable movedData={data.moved_data} />
                    {data.students_in_both_count > 0 && (
                      <Infobox
                        heading={t("language-versions-students-in-both-heading", {
                          count: data.students_in_both_count,
                        })}
                      >
                        {t("language-versions-students-in-both-body", { name: data.course.name })}
                      </Infobox>
                    )}
                    <p className={hintCss}>{t("language-versions-points-stay")}</p>
                  </>
                ) : (
                  <p className={mutedCss}>{t("language-versions-no-students-affected-course")}</p>
                )}
                <h3>{t("language-versions-in-the-courses")}</h3>
                <ul className={bulletsCss}>
                  <li>{t("language-versions-change-switcher")}</li>
                  <li>{t("language-versions-change-enrol-one")}</li>
                  <li>{t("language-versions-change-not-linked-yet")}</li>
                  <li>{t("language-versions-change-no-content")}</li>
                </ul>
              </>
            )}
          </QueryResult>
        )}
        {step === STEP_CONFIRM &&
          preview &&
          (studentCount > 0 ? (
            <>
              <p>{t("language-versions-join-confirm-lead")}</p>
              <DescriptionList
                items={[
                  { label: t("language-versions-course-to-add"), value: preview.course.name },
                  {
                    label: t("language-versions-as-language"),
                    value: languageName(preview.course.language_code),
                  },
                  ...(preview.left_language_versions.length > 0
                    ? [
                        {
                          label: t("language-versions-leaves"),
                          value: list(
                            preview.left_language_versions.map((course) => course.name),
                            preview.left_language_versions.length,
                          ),
                        },
                      ]
                    : []),
                  { label: t("language-versions-students-affected"), value: studentCount },
                  ...(preview.students_in_both_count > 0
                    ? [
                        {
                          label: t("language-versions-enrolled-in-both"),
                          value: t("language-versions-enrolled-in-both-details", {
                            count: preview.students_in_both_count,
                          }),
                        },
                      ]
                    : []),
                ]}
              />
              <Checkbox
                name="isAcknowledged"
                control={control}
                label={t("language-versions-join-acknowledge", { count: studentCount })}
              />
            </>
          ) : (
            <>
              <p>
                {t("language-versions-join-add-as", {
                  name: preview.course.name,
                  language: languageName(preview.course.language_code),
                  course: thisCourseName,
                })}
              </p>
              <LeavesLanguageVersionsNotice preview={preview} />
              <p className={mutedCss}>{t("language-versions-no-students-affected")}</p>
            </>
          ))}
      </div>
    </Dialog>
  )
}

export default JoinCourseDialog
