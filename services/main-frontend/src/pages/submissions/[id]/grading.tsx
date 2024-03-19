import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import SubmissionIFrame from "../../../components/page-specific/submissions/id/SubmissionIFrame"
import {
  addTeacherGrading,
  fetchGradingInfo,
  fetchSubmissionInfo,
} from "../../../services/backend/submissions"
import { NewTeacherGradingDecision } from "../../../shared-module/bindings"
import Button from "../../../shared-module/components/Button"
import DebugModal from "../../../shared-module/components/DebugModal"
import ErrorBanner from "../../../shared-module/components/ErrorBanner"
import CheckBox from "../../../shared-module/components/InputFields/CheckBox"
import TextAreaField from "../../../shared-module/components/InputFields/TextAreaField"
import Spinner from "../../../shared-module/components/Spinner"
import useToastMutation from "../../../shared-module/hooks/useToastMutation"
import { baseTheme } from "../../../shared-module/styles"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "../../../shared-module/utils/dontRenderUntilQueryParametersReady"

interface SubmissionPageProps {
  query: SimplifiedUrlQuery<"id">
  onSubmit: (form: NewTeacherGradingDecision) => void
}

//Model solution, lorem ipsum ja flag?
const Submission: React.FC<React.PropsWithChildren<SubmissionPageProps>> = ({ query }) => {
  const { t } = useTranslation()

  const { register, handleSubmit } = useForm<NewTeacherGradingDecision>()

  const getSubmissionInfo = useQuery({
    queryKey: [`submission-${query.id}`],
    queryFn: () => fetchSubmissionInfo(query.id),
  })

  const examId = getSubmissionInfo.data?.exercise.exam_id ?? ""
  const exerciseId = getSubmissionInfo.data?.exercise.id ?? ""
  const userId = getSubmissionInfo.data?.exercise_slide_submission.user_id ?? ""

  const getCurrentGradingInfo = useQuery({
    queryKey: [`exercise-slide-submissions-${examId}-user-exercise-state-info`, exerciseId, userId],
    queryFn: () => fetchGradingInfo(examId, exerciseId, userId),
    enabled: getSubmissionInfo.isFetched,
  })

  console.log("current grading info", getCurrentGradingInfo.data)

  const onSubmitWrapper = handleSubmit((data) => {
    const newGrading: NewTeacherGradingDecision = {
      user_exercise_state_id: getCurrentGradingInfo.data?.id ?? "",
      justification: data.justification,
      hidden: data.hidden,
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
    },
    {
      onSuccess: (data) => {
        console.log("teracher grading decison ", data)
        getCurrentGradingInfo.refetch()
      },
    },
  )

  return (
    <div>
      {getSubmissionInfo.isError && (
        <ErrorBanner variant={"readOnly"} error={getSubmissionInfo.error} />
      )}
      {getSubmissionInfo.isPending && <Spinner variant={"medium"} />}
      {getSubmissionInfo.isSuccess && (
        <div>
          <h1
            className={css`
              margin-bottom: 2rem;
            `}
          >
            {t("label-grade")} {getSubmissionInfo.data.exercise.name}
          </h1>
          {}
          {getSubmissionInfo.data.tasks
            .sort((a, b) => a.order_number - b.order_number)
            .map((task) => (
              <div key={task.id}>
                <div
                  className={css`
                    padding: 1.5rem 2rem;
                    margin: 2rem auto;
                    display: flex;
                    align-items: center;
                  `}
                >
                  {JSON.stringify(task.assignment) ?? ""}
                </div>
                <SubmissionIFrame key={task.id} coursematerialExerciseTask={task} />
              </div>
            ))}
        </div>
      )}
      <form onSubmit={onSubmitWrapper}>
        <CheckBox id={t("label-hidden")} label={t("label-hidden")} {...register("hidden")} />
        <div
          className={css`
            display: flex;
            flex-direction: row;
          `}
        >
          <div
            className={css`
              padding-right: 2rem;
              width: 100%;
            `}
          >
            <h3>
              {t("label-justification")} / {t("label-feedback")}
            </h3>
            <TextAreaField
              // eslint-disable-next-line i18next/no-literal-string
              resize="none"
              id={t("label-justification")}
              label={t("label-justification")}
              {...register("justification", { required: t("required-field") })}
            />
          </div>
          <div>
            <h3>{t("score")}</h3>
            <TextAreaField
              // eslint-disable-next-line i18next/no-literal-string
              resize="none"
              id={t("score")}
              label={t("score")}
              {...register("manual_points", { required: t("required-field") })}
            />
          </div>
        </div>
        <div
          className={css`
            display: flex;
            flex-direction: row;
            justify-content: space-between;
            width: 100%;
          `}
        >
          <div>
            <Button variant={"primary"} size={"medium"} transform="none" type="submit">
              {t("button-text-submit")}
            </Button>
            <Button variant={"secondary"} size={"medium"} transform="none">
              {t("save-as-draft")}
            </Button>
          </div>
          <div>
            <Button variant={"blue"} size={"medium"} transform="none">
              {t("button-text-next-answer")}
            </Button>
          </div>
        </div>
      </form>
      <div
        className={css`
          background-color: ${baseTheme.colors.clear[100]};
          color: ${baseTheme.colors.clear[100]};
          padding: 1.5rem 2rem;
          margin: 2rem auto;
          display: flex;
          align-items: center;
        `}
      >
        <div
          className={css`
            flex: 1;
          `}
        ></div>
        <DebugModal data={getSubmissionInfo.data} />
      </div>
    </div>
  )
}

export default dontRenderUntilQueryParametersReady(Submission)
