"use client"

import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import type {
  LanguageVersionExercise,
  LanguageVersionPage,
  LanguageVersionProblem,
} from "@/generated/api/types.generated"
import {
  problemDismissal,
  useDismissProblemMutation,
  useExerciseLinksMutation,
  useLanguageVersionStructure,
} from "@/hooks/useLanguageVersions"
import useLanguageName from "@/shared-module/common/hooks/useLanguageName"
import { Dialog, QueryResult, Radio, RadioGroup, Select } from "@/shared-module/components"

import { LINK } from "../constants"
import {
  cancelAction,
  dialogBodyCss,
  findExerciseRow,
  findPageRow,
  hintCss,
  otherLanguageCounterpartIds,
} from "../shared"

const CHOICE_KEEP = "keep"
const CHOICE_RELINK = "relink"
const NO_COUNTERPART = "none"

interface Props {
  courseId: string
  problem: LanguageVersionProblem
  exercise: LanguageVersionExercise
  counterpart: LanguageVersionExercise
  expectedPage: LanguageVersionPage | null | undefined
  onClose: () => void
}

interface Fields {
  choice: typeof CHOICE_KEEP | typeof CHOICE_RELINK
  replacementId: string
}

/**
 * An exercise's counterpart sits on another page than expected: keeps the link (marks the problem
 * as intended) or links another exercise of the expected page.
 */
const ExerciseOnOtherPageDialog: React.FC<Props> = ({
  courseId,
  problem,
  exercise,
  counterpart,
  expectedPage,
  onClose,
}) => {
  const { t } = useTranslation()
  const languageName = useLanguageName()
  const language = languageName(counterpart.language_code)
  const sourceLanguage = languageName(exercise.language_code)
  const structureQuery = useLanguageVersionStructure(courseId)
  const linkMutation = useExerciseLinksMutation()
  const dismissMutation = useDismissProblemMutation()
  const { control, watch } = useForm<Fields>({
    defaultValues: { choice: CHOICE_KEEP, replacementId: "" },
  })
  const choice = watch("choice")
  const replacementId = watch("replacementId")

  const save = () => {
    if (choice === CHOICE_KEEP) {
      dismissMutation.mutate(problemDismissal(courseId, problem), { onSuccess: onClose })
      return
    }
    const row = structureQuery.data ? findExerciseRow(structureQuery.data, exercise.id) : null
    const rowExercises = (row?.exercises ?? []).map((item) => item.exercise)
    const ids = [
      exercise.id,
      ...otherLanguageCounterpartIds(rowExercises, exercise.id, counterpart.course_id),
    ]
    if (replacementId !== NO_COUNTERPART) {
      ids.push(replacementId)
    }
    linkMutation.mutate(
      { path: { course_id: courseId }, body: { changes: [{ action: LINK, ids }] } },
      { onSuccess: onClose },
    )
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("language-versions-exercise-other-page-title", { name: exercise.name })}
      actions={[
        cancelAction(t, onClose),
        {
          label: t("button-text-save"),
          variant: "primary",
          disabled: choice === CHOICE_RELINK && replacementId === "",
          isLoading: linkMutation.isPending || dismissMutation.isPending,
          onPress: save,
        },
      ]}
    >
      <div className={dialogBodyCss}>
        <RadioGroup
          name="choice"
          control={control}
          label={t("language-versions-exercise-other-page-lead")}
        >
          <Radio
            value={CHOICE_KEEP}
            label={t("language-versions-keep-the-link")}
            description={t("language-versions-keep-the-link-description", { language })}
          />
          <Radio
            value={CHOICE_RELINK}
            label={t("language-versions-link-another-exercise", { language })}
            nestedContent={
              <QueryResult query={structureQuery}>
                {(structure) => {
                  const pageRow = expectedPage ? findPageRow(structure, expectedPage.id)?.row : null
                  const options = (pageRow?.exercise_rows ?? []).flatMap((exerciseRow) => {
                    const candidate = exerciseRow.exercises.find(
                      (item) => item.exercise.page_id === expectedPage?.id,
                    )?.exercise
                    if (!candidate) {
                      return []
                    }
                    const isLinked = exerciseRow.exercises.some(
                      (item) => item.exercise.course_id === exercise.course_id,
                    )
                    return [
                      {
                        value: candidate.id,
                        isDisabled: isLinked,
                        label: isLinked
                          ? t("language-versions-option-already-linked", { name: candidate.name })
                          : candidate.name,
                      },
                    ]
                  })
                  return (
                    <Select
                      name="replacementId"
                      control={control}
                      label={
                        expectedPage
                          ? t("language-versions-choose-exercise-on", { page: expectedPage.title })
                          : t("language-versions-choose-exercise")
                      }
                      options={[
                        ...options,
                        {
                          value: NO_COUNTERPART,
                          label: t("language-versions-no-language-counterpart", { language }),
                        },
                      ]}
                    />
                  )
                }}
              </QueryResult>
            }
          />
        </RadioGroup>
        <p className={hintCss}>
          {t("language-versions-points-stay-with-course", { language: sourceLanguage })}
        </p>
      </div>
    </Dialog>
  )
}

export default ExerciseOnOtherPageDialog
