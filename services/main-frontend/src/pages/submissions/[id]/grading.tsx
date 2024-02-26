/* eslint-disable i18next/no-literal-string */
//   POISTA  ESLINT   DISABLE
import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { Question } from "@vectopus/atlas-icons-react"
import React from "react"
import { useTranslation } from "react-i18next"

import SubmissionIFrame from "../../../components/page-specific/submissions/id/SubmissionIFrame"
import { fetchSubmissionInfo } from "../../../services/backend/submissions"
import Button from "../../../shared-module/components/Button"
import DebugModal from "../../../shared-module/components/DebugModal"
import ErrorBanner from "../../../shared-module/components/ErrorBanner"
import TextAreaField from "../../../shared-module/components/InputFields/TextAreaField"
import Spinner from "../../../shared-module/components/Spinner"
import { baseTheme } from "../../../shared-module/styles"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "../../../shared-module/utils/dontRenderUntilQueryParametersReady"

interface SubmissionPageProps {
  query: SimplifiedUrlQuery<"id">
}

const Submission: React.FC<React.PropsWithChildren<SubmissionPageProps>> = ({ query }) => {
  const { t } = useTranslation()
  const getSubmissionInfo = useQuery({
    queryKey: [`submission-${query.id}`],
    queryFn: () => fetchSubmissionInfo(query.id),
  })

  const totalScoreGiven = getSubmissionInfo.data?.tasks
    .map((task) => task.previous_submission_grading?.score_given)
    .reduce((a, b) => (a ?? 0) + (b ?? 0), 0)

  console.log(getSubmissionInfo, totalScoreGiven)
  return (
    <div>
      {getSubmissionInfo.isError && (
        <ErrorBanner variant={"readOnly"} error={getSubmissionInfo.error} />
      )}
      {getSubmissionInfo.isPending && <Spinner variant={"medium"} />}
      {getSubmissionInfo.isSuccess && (
        <>
          <h1
            className={css`
              margin-bottom: 2rem;
            `}
          >
            {t("label-grade")} {getSubmissionInfo.data.exercise.name}
          </h1>
          {
            <div
              className={css`
                padding: 1.5rem 2rem;
                margin: 2rem auto;
                display: flex;
                align-items: center;
              `}
            >
              what is the lorem ipsum here
            </div>
          }
          {getSubmissionInfo.data.tasks
            .sort((a, b) => a.order_number - b.order_number)
            .map((task) => (
              <SubmissionIFrame key={task.id} coursematerialExerciseTask={task} />
            ))}
        </>
      )}
      <div>
        <h3>{t("label-model-solution")}</h3>
        <TextAreaField resize="none" />
      </div>
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
          <TextAreaField resize="none" />
        </div>
        <div>
          <h3>{t("score")}</h3>
          <TextAreaField resize="none" />
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
          <Button variant={"primary"} size={"medium"} transform="none">
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
