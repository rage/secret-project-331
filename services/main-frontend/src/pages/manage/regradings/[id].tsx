/* eslint-disable i18next/no-literal-string */
import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import FullWidthTable, { FullWidthTableRow } from "../../../components/tables/FullWidthTable"
import { fetchRegradingInfo } from "../../../services/backend/regradings"
import ProgressBar from "../../../shared-module/components/CourseProgress/ProgressBar"
import DebugModal from "../../../shared-module/components/DebugModal"
import ErrorBanner from "../../../shared-module/components/ErrorBanner"
import Spinner from "../../../shared-module/components/Spinner"
import useQueryParameter from "../../../shared-module/hooks/useQueryParameter"
import dontRenderUntilQueryParametersReady from "../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import { dateToString } from "../../../shared-module/utils/time"

const ViewRegradingPage: React.FC<React.PropsWithChildren<unknown>> = () => {
  const { t } = useTranslation()
  const id = useQueryParameter("id")

  const query = useQuery({
    queryKey: [`regrading`, id],
    queryFn: () => fetchRegradingInfo(id),
    refetchInterval: (query) => {
      if (
        !query.state.data ||
        query.state.data.regrading.total_grading_progress === "FullyGraded"
      ) {
        return false
      }
      return 3000
    },
  })

  if (query.isError) {
    return <ErrorBanner variant="readOnly" error={query.error} />
  }

  if (query.isPending) {
    return <Spinner variant="medium" />
  }

  const nRegradingsReady = query.data.submission_infos.filter(
    (i) => i.grading_after_regrading?.grading_progress === "FullyGraded",
  ).length

  return (
    <div>
      <h1>
        {t("title-regrading")} {id}
      </h1>

      <div
        className={css`
          margin: 2rem 0;
        `}
      >
        <p>
          <b>created_at</b>:{" "}
          {query.data.regrading.created_at ? dateToString(query.data.regrading.created_at) : "null"}
        </p>
        <p>
          <b>updated_at</b>:{" "}
          {query.data.regrading.updated_at ? dateToString(query.data.regrading.updated_at) : "null"}
        </p>
        <p>
          <b>regrading_started_at</b>:{" "}
          {query.data.regrading.regrading_started_at
            ? dateToString(query.data.regrading.regrading_started_at)
            : "null"}
        </p>
        <p>
          <b>regrading_completed_at</b>:{" "}
          {query.data.regrading.regrading_completed_at
            ? dateToString(query.data.regrading.regrading_completed_at)
            : "null"}
        </p>
        <p>
          <b>total_grading_progress</b>:{" "}
          {query.data.regrading.total_grading_progress
            ? query.data.regrading.total_grading_progress
            : "null"}
        </p>
        <p>
          <b>user_points_update_strategy</b>:{" "}
          {query.data.regrading.user_points_update_strategy
            ? query.data.regrading.user_points_update_strategy
            : "null"}
        </p>
        <p>
          <b>user_id</b>: {query.data.regrading.user_id ? query.data.regrading.user_id : "null"}
        </p>
      </div>
      <ProgressBar
        label={t("label-submissions-regraded")}
        variant={"bar"}
        exercisesAttempted={nRegradingsReady}
        exercisesTotal={query.data.submission_infos.length}
      />
      <div
        className={css`
          margin: 2rem 0;
        `}
      >
        <h2>{t("header-submissions")}</h2>
        <FullWidthTable>
          <thead>
            <tr
              className={css`
                text-align: left;
                font-size: 13px;
              `}
            >
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <th>execise_task_submission_id</th>
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <th>grading_progress</th>
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <th>grading_started_at</th>
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <th>grading_completed_at</th>
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <th>grade_before_regrading</th>
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <th>grade_after_regrading</th>
            </tr>
          </thead>
          <tbody>
            {query.data.submission_infos.map((si) => (
              <FullWidthTableRow key={si.exercise_task_submission_id}>
                <td>{si.exercise_task_submission_id}</td>
                <td>
                  {si.grading_after_regrading
                    ? si.grading_after_regrading.grading_progress
                    : "null"}
                </td>
                <td>
                  {si?.grading_after_regrading?.grading_started_at
                    ? dateToString(si.grading_after_regrading.grading_started_at)
                    : "null"}
                </td>
                <td>
                  {si?.grading_after_regrading?.grading_completed_at
                    ? dateToString(si.grading_after_regrading.grading_completed_at)
                    : "null"}
                </td>
                <td>{si.grading_before_regrading.score_given ?? "null"}</td>
                <td>
                  {si.grading_after_regrading
                    ? si.grading_after_regrading.score_given ?? "null"
                    : "null"}
                </td>
              </FullWidthTableRow>
            ))}
          </tbody>
        </FullWidthTable>
      </div>
      <DebugModal data={query.data} />
    </div>
  )
}

export default dontRenderUntilQueryParametersReady(ViewRegradingPage)
