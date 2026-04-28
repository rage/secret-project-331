"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import {
  addTeacherGradingForExamSubmissionMutation,
  getExamUserExerciseStateInfoOptions,
  getExerciseSlideSubmissionInfoOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import type {
  ExerciseSlideSubmissionInfo,
  NewTeacherGradingDecision,
} from "@/generated/api/types.generated"
import useExamSubmissionsInfo from "@/hooks/useExamSubmissionsInfo"
import Button from "@/shared-module/common/components/Button"
import TextAreaField from "@/shared-module/common/components/InputFields/TextAreaField"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import usePaginationInfo from "@/shared-module/common/hooks/usePaginationInfo"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"
import { submissionGradingRoute } from "@/shared-module/common/utils/routes"

interface GradeExamAnswerProps {
  submissionId: string
}

const GradeExamAnswerForm: React.FC<React.PropsWithChildren<GradeExamAnswerProps>> = ({
  submissionId,
}) => {
  const getSubmissionInfo = useQuery({
    ...getExerciseSlideSubmissionInfoOptions({
      path: {
        submission_id: submissionId,
      },
    }),
  })

  if (!getSubmissionInfo.data?.exercise.exam_id) {
    return null
  }

  return (
    <LoadedGradeExamAnswerForm
      examId={getSubmissionInfo.data.exercise.exam_id}
      submissionId={submissionId}
      submissionInfo={getSubmissionInfo.data}
    />
  )
}

const LoadedGradeExamAnswerForm: React.FC<{
  examId: string
  submissionId: string
  submissionInfo: ExerciseSlideSubmissionInfo
}> = ({ examId, submissionId, submissionInfo }) => {
  const { t } = useTranslation()
  const router = useRouter()

  const { register, handleSubmit } = useForm<NewTeacherGradingDecision>()
  const [nextSubmissionId, setNextSubmissionId] = useState("")
  const paginationInfo = usePaginationInfo()

  const getCurrentGradingInfo = useQuery({
    ...getExamUserExerciseStateInfoOptions({
      path: {
        exam_id: examId,
      },
      query: {
        exercise_id: submissionInfo.exercise.id,
        user_id: submissionInfo.exercise_slide_submission.user_id,
      },
    }),
  })

  const getSubmissions = useExamSubmissionsInfo(
    submissionInfo.exercise.id,
    paginationInfo.page,
    paginationInfo.limit,
  )

  // Current submission for reviewing
  const currentSubmission = getSubmissions.data?.data.filter((submission) => {
    return submission.exercise_slide_submission.id === submissionId
  })[0]

  // Get next submission
  if (getSubmissions.isSuccess && nextSubmissionId === "") {
    const currentSubmissionIndex = getSubmissions.data?.data.findIndex(
      (id) => id.exercise_slide_submission.id === submissionId,
    )
    if (currentSubmissionIndex + 1 !== getSubmissions.data.data.length) {
      setNextSubmissionId(
        getSubmissions.data.data.at(currentSubmissionIndex + 1)?.exercise_slide_submission.id ?? "",
      )
    } else {
      // eslint-disable-next-line i18next/no-literal-string
      setNextSubmissionId("lastAnswer")
    }
  }

  const submitMutation = useToastMutationOptions(
    addTeacherGradingForExamSubmissionMutation(),
    {
      notify: true,
      method: "PUT",
      // eslint-disable-next-line i18next/no-literal-string
      errorMessage: "Cannot give more points than maximum points",
    },
    {
      onSuccess: () => {
        getCurrentGradingInfo.refetch()
      },
    },
  )

  const handleGradeSubmission = async (
    data: NewTeacherGradingDecision,
    navigateToNext: boolean,
  ) => {
    const newGrading: NewTeacherGradingDecision = {
      user_exercise_state_id: assertNotNullOrUndefined(getCurrentGradingInfo.data?.id),
      justification: data.justification,
      hidden: true,
      exercise_id: submissionInfo.exercise.id,
      // eslint-disable-next-line i18next/no-literal-string
      action: "CustomPoints",
      manual_points: Number(data.manual_points),
    }

    await submitMutation.mutateAsync({
      body: newGrading,
    })

    if (navigateToNext) {
      router.push(submissionGradingRoute(nextSubmissionId))
    }
  }

  const handleSubmitForm = (data: NewTeacherGradingDecision) => handleGradeSubmission(data, false)
  const handleSubmitAndNext = (data: NewTeacherGradingDecision) => handleGradeSubmission(data, true)

  return (
    <form
      className={css`
        padding: 1.5rem 1rem;
      `}
    >
      <div
        className={css`
          display: flex;
          flex-direction: column;
        `}
      >
        <div
          className={css`
            width: 100%;
            margin-bottom: 0.5rem;
            height: 150px;
          `}
        >
          <h4>
            {t("label-justification")} / {t("label-feedback")}
          </h4>
          <TextAreaField
            className={css`
              width: 100%;
              margin-bottom: 0.5rem;
              height: 100rem;
            `}
            id={t("label-justification")}
            defaultValue={currentSubmission?.teacher_grading_decision?.justification ?? ""}
            {...register("justification", { required: t("required-field") })}
          />
        </div>

        <div
          className={css`
            width: 20%;
          `}
        >
          <h4>
            {t("label-points")} / {submissionInfo.exercise.score_maximum}
          </h4>
          <TextField
            id={t("score")}
            label={t("score")}
            defaultValue={currentSubmission?.teacher_grading_decision?.score_given ?? ""}
            {...register("manual_points", { required: t("required-field") })}
          />
        </div>
      </div>
      <div
        className={css`
          display: flex;
          flex-direction: row;
          justify-content: space-between;
        `}
      >
        <div>
          <Button
            variant={"primary"}
            size={"medium"}
            transform="none"
            type="button"
            onClick={handleSubmit(handleSubmitForm)}
          >
            {t("button-text-submit")}
          </Button>
        </div>
        <div>
          <Button
            variant={"blue"}
            size={"medium"}
            transform="none"
            type="button"
            disabled={nextSubmissionId === "lastAnswer"}
            onClick={handleSubmit(handleSubmitAndNext)}
          >
            {t("button-text-save-and-next")}
          </Button>
        </div>
      </div>
    </form>
  )
}

export default GradeExamAnswerForm
