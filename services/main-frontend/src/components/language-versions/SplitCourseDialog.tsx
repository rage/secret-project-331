"use client"

import React, { useEffect } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import {
  useLanguageVersionSplitPreview,
  useSplitLanguageVersionMutation,
} from "@/hooks/useLanguageVersions"
import useLanguageName from "@/shared-module/common/hooks/useLanguageName"
import { Checkbox, Dialog, Infobox, QueryResult, TONE } from "@/shared-module/components"

import { bulletsCss, cancelAction, dialogBodyCss, mutedCss } from "./shared"

interface Props {
  courseId: string
  /** The course to remove; `null` keeps the dialog closed. */
  splitCourseId: string | null
  onClose: () => void
}

interface AcknowledgeFields {
  isAcknowledged: boolean
}

/** Removes a course from the language versions after showing what moves with it. */
const SplitCourseDialog: React.FC<Props> = ({ courseId, splitCourseId, onClose }) => {
  const { t } = useTranslation()
  const languageName = useLanguageName()
  const previewQuery = useLanguageVersionSplitPreview(courseId, splitCourseId)
  const splitMutation = useSplitLanguageVersionMutation()
  const { control, watch, reset } = useForm<AcknowledgeFields>({
    defaultValues: { isAcknowledged: false },
  })
  const isAcknowledged = watch("isAcknowledged")

  useEffect(() => {
    reset({ isAcknowledged: false })
  }, [splitCourseId, reset])

  const preview = previewQuery.data
  const studentCount = preview?.expected_student_count ?? 0
  const name = preview?.course.name ?? ""

  const split = () => {
    if (!preview || !splitCourseId) {
      return
    }
    splitMutation.mutate(
      {
        path: { course_id: courseId },
        body: { course_id: splitCourseId, expected_student_count: preview.expected_student_count },
      },
      {
        onSuccess: onClose,
        onError: () => {
          // The student count may have changed since the preview.
          void previewQuery.refetch()
        },
      },
    )
  }

  return (
    <Dialog
      open={splitCourseId !== null}
      onClose={onClose}
      title={t("language-versions-split-title", { name })}
      actions={[
        cancelAction(t, onClose),
        {
          label: t("language-versions-split-confirm"),
          variant: "danger",
          disabled: !preview || (studentCount > 0 && !isAcknowledged),
          isLoading: splitMutation.isPending,
          onPress: split,
        },
      ]}
    >
      <QueryResult query={previewQuery}>
        {(data) => (
          <div className={dialogBodyCss}>
            <p>{t("language-versions-split-lead", { name: data.course.name })}</p>
            {studentCount > 0 ? (
              <Infobox
                tone={TONE.WARNING}
                heading={t("language-versions-split-students-heading", { count: studentCount })}
              >
                {t("language-versions-split-students-body", { name: data.course.name })}
              </Infobox>
            ) : (
              <p className={mutedCss}>{t("language-versions-no-students-affected-course")}</p>
            )}
            <h3>{t("language-versions-what-else-changes")}</h3>
            <ul className={bulletsCss}>
              <li>
                {t("language-versions-split-unlinks", {
                  pages: data.unlinked_page_count,
                  exercises: data.unlinked_exercise_count,
                })}
              </li>
              <li>
                {t("language-versions-split-no-switch", {
                  language: languageName(data.course.language_code),
                })}
              </li>
              <li>{t("language-versions-split-enrol-both")}</li>
              <li>{t("language-versions-points-stay")}</li>
            </ul>
            {studentCount > 0 && (
              <Checkbox
                name="isAcknowledged"
                control={control}
                label={t("language-versions-split-acknowledge", { count: studentCount })}
              />
            )}
          </div>
        )}
      </QueryResult>
    </Dialog>
  )
}

export default SplitCourseDialog
