"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import type { LanguageVersionCourse, LanguageVersionProblem } from "@/generated/api/types.generated"
import { useExerciseLinksMutation, usePageLinksMutation } from "@/hooks/useLanguageVersions"
import useLanguageName from "@/shared-module/common/hooks/useLanguageName"

import { pageLabel } from "../shared"
import ExerciseOnOtherPageDialog from "./ExerciseOnOtherPageDialog"
import ForeignCourseLinkDialog from "./ForeignCourseLinkDialog"
import KeepOneLinkedDialog from "./KeepOneLinkedDialog"
import LeftoverLinksDialog from "./LeftoverLinksDialog"
import MissingPageCounterpartDialog from "./MissingPageCounterpartDialog"

interface Props {
  courseId: string
  courses: LanguageVersionCourse[]
  problem: LanguageVersionProblem
  onClose: () => void
}

/** The fix dialog for problems fixed in a dialog; renders nothing for the other kinds. */
const ProblemFixDialog: React.FC<Props> = ({ courseId, courses, problem, onClose }) => {
  const { t } = useTranslation()
  const languageName = useLanguageName()
  const pageLinksMutation = usePageLinksMutation()
  const exerciseLinksMutation = useExerciseLinksMutation()
  const kind = problem.kind
  switch (kind.kind) {
    case "missing_page_counterpart":
      return (
        <MissingPageCounterpartDialog
          courseId={courseId}
          courses={courses}
          counterpartCourseId={kind.counterpart_course_id}
          pages={kind.pages}
          onClose={onClose}
        />
      )
    case "duplicate_pages_in_group": {
      const linkedPage =
        kind.linked_pages.find((page) => page.course_id === courseId) ?? kind.linked_pages[0]
      return (
        <KeepOneLinkedDialog
          courseId={courseId}
          items={kind.pages.map((page) => ({ id: page.id, label: pageLabel(t, page) }))}
          language={kind.pages[0] ? languageName(kind.pages[0].language_code) : ""}
          linkedTitle={linkedPage?.title ?? ""}
          suggestedId={kind.suggested_page_id ?? null}
          suggestionReason={kind.suggestion_reason ?? null}
          lead={t("language-versions-keep-one-pages-lead")}
          hint={t("language-versions-keep-one-pages-hint")}
          linkMutation={pageLinksMutation}
          onClose={onClose}
        />
      )
    }
    case "duplicate_exercises_in_group": {
      const linkedExercise =
        kind.linked_exercises.find((exercise) => exercise.course_id === courseId) ??
        kind.linked_exercises[0]
      return (
        <KeepOneLinkedDialog
          courseId={courseId}
          items={kind.exercises.map((exercise) => ({
            id: exercise.id,
            label: t("language-versions-exercise-on-page", {
              name: exercise.name,
              page: exercise.page_title,
            }),
          }))}
          language={kind.exercises[0] ? languageName(kind.exercises[0].language_code) : ""}
          linkedTitle={linkedExercise?.name ?? ""}
          suggestedId={null}
          suggestionReason={null}
          lead={t("language-versions-keep-one-exercises-lead")}
          hint={t("language-versions-keep-one-exercises-hint")}
          linkMutation={exerciseLinksMutation}
          onClose={onClose}
        />
      )
    }
    case "foreign_course_link":
      return (
        <ForeignCourseLinkDialog
          courseId={courseId}
          page={kind.page}
          foreignPage={kind.foreign_page}
          foreignCourseName={kind.foreign_course_name}
          linkedPages={kind.linked_pages}
          onClose={onClose}
        />
      )
    case "exercise_counterpart_on_other_page":
      return (
        <ExerciseOnOtherPageDialog
          courseId={courseId}
          problem={problem}
          exercise={kind.exercise}
          counterpart={kind.counterpart}
          expectedPage={kind.expected_page}
          onClose={onClose}
        />
      )
    case "leftover_links":
      return (
        <LeftoverLinksDialog
          courseId={courseId}
          pages={kind.pages}
          exercises={kind.exercises}
          onClose={onClose}
        />
      )
    default:
      return null
  }
}

export default ProblemFixDialog
