"use client"

/* oxlint-disable i18next/no-literal-string */
import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import type React from "react"
import { useTranslation } from "react-i18next"

import FullWidthTable, { FullWidthTableRow } from "@/components/tables/FullWidthTable"
import { getRegradingInfoOptions } from "@/generated/api/@tanstack/react-query.generated"
import ProgressBar from "@/shared-module/common/components/CourseProgress/ProgressBar"
import DebugModal from "@/shared-module/common/components/DebugModal"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import { dateToString } from "@/shared-module/common/utils/time"
import { QueryResult } from "@/shared-module/components"

const ViewRegradingPage: React.FC = () => {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  usePageTitle(t("title-regrading-id", { id }))

  const query = useQuery({
    ...getRegradingInfoOptions({
      path: {
        regrading_id: id,
      },
    }),
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data || data.regrading.total_grading_progress === "FullyGraded") {
        return false
      }
      return 3000
    },
  })

  return (
    <QueryResult query={query}>
      {(data) => {
        const nRegradingsReady = data.submission_infos.filter(
          (i) => i.grading_after_regrading?.grading_progress === "FullyGraded",
        ).length

        return (
          <div>
            <h1>{t("title-regrading-id", { id })}</h1>

            <div
              className={css`
                margin: 2rem 0;
              `}
            >
              <p>
                <b>created_at</b>:{" "}
                {data.regrading.created_at ? dateToString(data.regrading.created_at) : "null"}
              </p>
              <p>
                <b>updated_at</b>:{" "}
                {data.regrading.updated_at ? dateToString(data.regrading.updated_at) : "null"}
              </p>
              <p>
                <b>regrading_started_at</b>:{" "}
                {data.regrading.regrading_started_at
                  ? dateToString(data.regrading.regrading_started_at)
                  : "null"}
              </p>
              <p>
                <b>regrading_completed_at</b>:{" "}
                {data.regrading.regrading_completed_at
                  ? dateToString(data.regrading.regrading_completed_at)
                  : "null"}
              </p>
              <p>
                <b>total_grading_progress</b>:{" "}
                {data.regrading.total_grading_progress
                  ? data.regrading.total_grading_progress
                  : "null"}
              </p>
              <p>
                <b>user_points_update_strategy</b>:{" "}
                {data.regrading.user_points_update_strategy
                  ? data.regrading.user_points_update_strategy
                  : "null"}
              </p>
              <p>
                <b>user_id</b>: {data.regrading.user_id ? data.regrading.user_id : "null"}
              </p>
            </div>
            <ProgressBar
              label={t("label-submissions-regraded")}
              variant={"bar"}
              exercisesAttempted={nRegradingsReady}
              exercisesTotal={data.submission_infos.length}
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
                    {}
                    <th>execise_task_submission_id</th>
                    {}
                    <th>grading_progress</th>
                    {}
                    <th>grading_started_at</th>
                    {}
                    <th>grading_completed_at</th>
                    {}
                    <th>grade_before_regrading</th>
                    {}
                    <th>regrading_grade</th>
                  </tr>
                </thead>
                <tbody>
                  {data.submission_infos.map((si) => (
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
                          ? (si.grading_after_regrading.score_given ?? "null")
                          : "null"}
                      </td>
                    </FullWidthTableRow>
                  ))}
                </tbody>
              </FullWidthTable>
            </div>
            <DebugModal data={data} />
          </div>
        )
      }}
    </QueryResult>
  )
}

export default withSignedIn(ViewRegradingPage)
