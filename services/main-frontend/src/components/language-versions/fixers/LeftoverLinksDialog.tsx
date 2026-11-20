"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import type { LeftoverExerciseLink, LeftoverPageLink } from "@/generated/api/types.generated"
import { useRemoveLeftoverLinksMutation } from "@/hooks/useLanguageVersions"
import useLanguageName from "@/shared-module/common/hooks/useLanguageName"
import { Dialog } from "@/shared-module/components"

import { bulletsCss, cancelAction, dialogBodyCss, mutedCss, pageLabel } from "../shared"

interface Props {
  courseId: string
  pages: LeftoverPageLink[]
  exercises: LeftoverExerciseLink[]
  onClose: () => void
}

/** Removes links whose other end is a deleted page or exercise. */
const LeftoverLinksDialog: React.FC<Props> = ({ courseId, pages, exercises, onClose }) => {
  const { t } = useTranslation()
  const languageName = useLanguageName()
  const removeMutation = useRemoveLeftoverLinksMutation()
  const count = pages.length + exercises.length

  const remove = () => {
    removeMutation.mutate(
      {
        path: { course_id: courseId },
        body: {
          deleted_page_ids: pages.map((link) => link.deleted_page.id),
          deleted_exercise_ids: exercises.map((link) => link.deleted_exercise.id),
        },
      },
      { onSuccess: onClose },
    )
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("language-versions-leftover-title", { count })}
      actions={[
        cancelAction(t, onClose),
        {
          label: t("language-versions-remove-links"),
          variant: "primary",
          isLoading: removeMutation.isPending,
          onPress: remove,
        },
      ]}
    >
      <div className={dialogBodyCss}>
        <ul className={bulletsCss}>
          {pages.map((link) => (
            <li key={link.deleted_page.id + link.page.id}>
              {t("language-versions-leftover-page-item", {
                page: pageLabel(t, link.page),
                language: languageName(link.deleted_page.language_code),
                deleted: link.deleted_page.title,
              })}
            </li>
          ))}
          {exercises.map((link) => (
            <li key={link.deleted_exercise.id + link.exercise.id}>
              {t("language-versions-leftover-exercise-item", {
                exercise: link.exercise.name,
                language: languageName(link.deleted_exercise.language_code),
                deleted: link.deleted_exercise.name,
              })}
            </li>
          ))}
        </ul>
        <p className={mutedCss}>{t("language-versions-leftover-stays-deleted")}</p>
      </div>
    </Dialog>
  )
}

export default LeftoverLinksDialog
