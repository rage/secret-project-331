import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import useExamSubmissionsInfo from "../../hooks/useExamSubmissionsInfo"
import {
  addTeacherGrading,
  fetchGradingInfo,
  fetchSubmissionInfo,
} from "../../services/backend/submissions"

import { NewTeacherGradingDecision } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import TextAreaField from "@/shared-module/common/components/InputFields/TextAreaField"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import usePaginationInfo from "@/shared-module/common/hooks/usePaginationInfo"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import dontRenderUntilQueryParametersReady from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady"

interface GradeExamAnswerProps {
  submissionId: string
}

const GradeExamAnswerForm: React.FC<React.PropsWithChildren<GradeExamAnswerProps>> = ({
  submissionId,
}) => {
  const { t } = useTranslation()

  const { register, handleSubmit } = useForm<NewTeacherGradingDecision>()
  const [nextSubmissionId, setNextSubmissionId] = useState("")
  const paginationInfo = usePaginationInfo()

  const getSubmissionInfo = useQuery({
    queryKey: [`submission-${submissionId}`],
    queryFn: () => fetchSubmissionInfo(submissionId),
  })

  const examId = getSubmissionInfo.data?.exercise.exam_id ?? ""
  const exerciseId = getSubmissionInfo.data?.exercise.id ?? ""
  const userId = getSubmissionInfo.data?.exercise_slide_submission.user_id ?? ""

  const getCurrentGradingInfo = useQuery({
    queryKey: [`exercise-slide-submissions-${examId}-user-exercise-state-info`, exerciseId, userId],
    queryFn: () => fetchGradingInfo(examId, exerciseId, userId),
    enabled: getSubmissionInfo.isFetched,
  })

  const getSubmissions = useExamSubmissionsInfo(
    exerciseId,
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

  const onSubmitWrapper = handleSubmit((data) => {
    const newGrading: NewTeacherGradingDecision = {
      user_exercise_state_id: getCurrentGradingInfo.data?.id ?? "",
      justification: data.justification,
      hidden: true,
      exercise_id: getSubmissionInfo.data?.exercise.id ?? "",
      // eslint-disable-next-line i18next/no-literal-string
      action: "CustomPoints",
      manual_points: Number(data.manual_points),
    }
    submitMutation.mutate(newGrading)
  })

  const submitMutation = useToastMutation(
    (update: NewTeacherGradingDecision) => {
      return addTeacherGrading(update)
    },
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

  return (
    <form
      onSubmit={onSubmitWrapper}
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
            {t("label-points")} / {getSubmissionInfo.data?.exercise.score_maximum}
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
          <Button variant={"primary"} size={"medium"} transform="none" type="submit">
            {t("button-text-submit")}
          </Button>
        </div>
        <div>
          <Button
            variant={"blue"}
            size={"medium"}
            transform="none"
            disabled={nextSubmissionId === "lastAnswer"}
            type="submit"
            onClick={() => {
              location.href = `/submissions/${nextSubmissionId}/grading/`
            }}
          >
            {t("button-text-save-and-next")}
          </Button>
        </div>
      </div>
    </form>
  )
}

export default dontRenderUntilQueryParametersReady(GradeExamAnswerForm)
