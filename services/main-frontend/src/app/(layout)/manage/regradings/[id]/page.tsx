"use client"

/* oxlint-disable i18next/no-literal-string */
import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import type React from "react"
import { useTranslation } from "react-i18next"

import { getRegradingInfoOptions } from "@/generated/api/@tanstack/react-query.generated"
import DebugModal from "@/shared-module/common/components/DebugModal"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import { dateToString } from "@/shared-module/common/utils/time"
import { Meter, METER_KIND, QueryResult, Table, TONE } from "@/shared-module/components"

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
    refetchInterval: (latestQuery) => {
      const data = latestQuery.state.data
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
            <Meter
              kind={METER_KIND.PROGRESS}
              tone={TONE.SUCCESS}
              label={t("label-submissions-regraded")}
              value={nRegradingsReady}
              maxValue={data.submission_infos.length}
              valueLabel={t("value-of-maximum", {
                value: nRegradingsReady,
                maximum: data.submission_infos.length,
              })}
            />
            <div
              className={css`
                margin: 2rem 0;
              `}
            >
              <h2>{t("header-submissions")}</h2>
              <Table
                caption={t("header-submissions")}
                density="compact"
                rows={data.submission_infos}
                rowKey={(si) => si.exercise_task_submission_id}
                columns={[
                  {
                    // oxlint-disable-next-line i18next/no-literal-string
                    header: "execise_task_submission_id",
                    cell: (si) => si.exercise_task_submission_id,
                  },
                  {
                    // oxlint-disable-next-line i18next/no-literal-string
                    header: "grading_progress",
                    cell: (si) =>
                      si.grading_after_regrading
                        ? si.grading_after_regrading.grading_progress
                        : "null",
                  },
                  {
                    // oxlint-disable-next-line i18next/no-literal-string
                    header: "grading_started_at",
                    cell: (si) =>
                      si.grading_after_regrading?.grading_started_at
                        ? dateToString(si.grading_after_regrading.grading_started_at)
                        : "null",
                  },
                  {
                    // oxlint-disable-next-line i18next/no-literal-string
                    header: "grading_completed_at",
                    cell: (si) =>
                      si.grading_after_regrading?.grading_completed_at
                        ? dateToString(si.grading_after_regrading.grading_completed_at)
                        : "null",
                  },
                  {
                    // oxlint-disable-next-line i18next/no-literal-string
                    header: "grade_before_regrading",
                    cell: (si) => si.grading_before_regrading.score_given ?? "null",
                  },
                  {
                    // oxlint-disable-next-line i18next/no-literal-string
                    header: "regrading_grade",
                    cell: (si) =>
                      si.grading_after_regrading
                        ? (si.grading_after_regrading.score_given ?? "null")
                        : "null",
                  },
                ]}
              />
            </div>
            <DebugModal data={data} />
          </div>
        )
      }}
    </QueryResult>
  )
}

export default withSignedIn(ViewRegradingPage)
