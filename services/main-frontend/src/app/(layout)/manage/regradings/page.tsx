"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import {
  createRegradingMutation as createNewRegradingMutationOptions,
  getRegradingsCountOptions,
  getRegradingsOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import type { NewRegradingIdType, UserPointsUpdateStrategy } from "@/generated/api/types.generated"
import DebugModal from "@/shared-module/common/components/DebugModal"
import Pagination from "@/shared-module/common/components/Pagination"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import usePaginationInfo from "@/shared-module/common/hooks/usePaginationInfo"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { isUuid } from "@/shared-module/common/utils/fetching"
import { manageRegradingRoute } from "@/shared-module/common/utils/routes"
import { dateToString } from "@/shared-module/common/utils/time"
import {
  ABSENT_LABEL,
  Button,
  Dialog,
  Link,
  QueryResult,
  Select,
  Table,
  TextArea,
} from "@/shared-module/components"

interface Fields {
  ids: string
  userPointsUpdateStrategy: UserPointsUpdateStrategy
  idType: NewRegradingIdType
}

const pageCss = css`
  margin-top: 40px;

  ${respondToOrLarger.sm} {
    margin-top: 80px;
  }
`

const headerCss = css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
`

const pageTitleCss = css`
  margin: 0;
`

/** A regrading timestamp, or the absent glyph for a step that has not happened yet. */
const timestampOrAbsent = (timestamp: string | null | undefined): string =>
  timestamp ? dateToString(timestamp) : ABSENT_LABEL

const RegradingsPage: React.FC = () => {
  const { t } = useTranslation()
  usePageTitle(t("title-regradings"))
  const router = useRouter()
  const paginationInfo = usePaginationInfo()
  const regradingsQuery = useQuery({
    ...getRegradingsOptions({
      query: {
        page: paginationInfo.page,
        limit: paginationInfo.limit,
      },
    }),
  })
  const regradingsCountQuery = useQuery(getRegradingsCountOptions())
  const [newRegradingDialogOpen, setNewRegradingDialogOpen] = useState(false)
  const {
    control,
    reset,
    handleSubmit,
    formState: { isValid },
  } = useForm<Fields>({
    // oxlint-disable-next-line i18next/no-literal-string
    mode: "onChange",
    defaultValues: {
      ids: "",
      // oxlint-disable-next-line i18next/no-literal-string
      userPointsUpdateStrategy: "CanAddPointsButCannotRemovePoints",
      // oxlint-disable-next-line i18next/no-literal-string
      idType: "ExerciseTaskSubmissionId",
    },
  })
  const newRegradingMutation = useToastMutationOptions(
    createNewRegradingMutationOptions(),
    { notify: true, method: "POST" },
    {
      onSuccess: (data) => {
        setNewRegradingDialogOpen(false)
        reset()
        router.push(manageRegradingRoute(data))
      },
    },
  )

  const pointsUpdateStrategyLabel = (strategy: UserPointsUpdateStrategy): string => {
    switch (strategy) {
      case "CanAddPointsAndCanRemovePoints":
        return t("option-can-add-points-and-can-remove-points")
      case "CanAddPointsButCannotRemovePoints":
        return t("option-can-add-points-but-cannot-remove-points")
    }
  }

  return (
    <div className={pageCss}>
      <div className={headerCss}>
        <h1 className={pageTitleCss}>{t("title-regradings")}</h1>
        <Button
          variant="primary"
          size="medium"
          onClick={() => {
            setNewRegradingDialogOpen(true)
          }}
        >
          {t("button-text-new-regrading")}
        </Button>
      </div>

      <QueryResult query={regradingsQuery} treatEmptyAsData>
        {(regradings) => (
          <>
            <Table
              caption={t("title-regradings")}
              rows={regradings}
              rowKey={(regrading) => regrading.id}
              columns={[
                {
                  header: t("regradings-column-created"),
                  minWidth: "14rem",
                  nowrap: true,
                  cell: (regrading) => (
                    <Link href={manageRegradingRoute(regrading.id)}>
                      {dateToString(regrading.created_at)}
                    </Link>
                  ),
                },
                {
                  header: t("regradings-column-started"),
                  minWidth: "14rem",
                  nowrap: true,
                  cell: (regrading) => timestampOrAbsent(regrading.regrading_started_at),
                },
                {
                  header: t("regradings-column-completed"),
                  minWidth: "14rem",
                  nowrap: true,
                  cell: (regrading) => timestampOrAbsent(regrading.regrading_completed_at),
                },
                {
                  header: t("regradings-column-grading-progress"),
                  minWidth: "9rem",
                  cell: (regrading) => regrading.total_grading_progress,
                },
                {
                  header: t("regradings-column-points-update-strategy"),
                  minWidth: "14rem",
                  cell: (regrading) =>
                    pointsUpdateStrategyLabel(regrading.user_points_update_strategy),
                },
                {
                  header: t("regradings-column-updated"),
                  minWidth: "14rem",
                  nowrap: true,
                  cell: (regrading) => dateToString(regrading.updated_at),
                },
              ]}
            />
            {regradingsCountQuery.data !== undefined && (
              <Pagination
                totalPages={Math.ceil(regradingsCountQuery.data / paginationInfo.limit)}
                paginationInfo={paginationInfo}
              />
            )}
            <DebugModal data={regradings} />
          </>
        )}
      </QueryResult>

      <Dialog
        open={newRegradingDialogOpen}
        onClose={() => setNewRegradingDialogOpen(false)}
        title={t("button-text-new-regrading")}
      >
        <Select
          name="idType"
          control={control}
          label={t("label-id-type")}
          options={[
            {
              label: t("option-exercise-task-submission-id"),
              // oxlint-disable-next-line i18next/no-literal-string
              value: "ExerciseTaskSubmissionId" satisfies NewRegradingIdType,
            },

            {
              label: t("option-exercise-id"),
              // oxlint-disable-next-line i18next/no-literal-string
              value: "ExerciseId" satisfies NewRegradingIdType,
            },
          ]}
        />
        <TextArea
          name="ids"
          control={control}
          label={t("label-ids-one-per-line")}
          rows={20}
          rules={{
            validate: (input) => {
              const lines = input.trim().split("\n")
              if (lines.length === 0) {
                return false
              }

              return lines.every((line) => isUuid(line.trim()))
            },
          }}
        />

        <Select
          name="userPointsUpdateStrategy"
          control={control}
          label={t("label-user-points-update-strategy")}
          options={[
            {
              label: t("option-can-add-points-but-cannot-remove-points"),
              // oxlint-disable-next-line i18next/no-literal-string
              value: "CanAddPointsButCannotRemovePoints" satisfies UserPointsUpdateStrategy,
            },

            {
              label: t("option-can-add-points-and-can-remove-points"),
              // oxlint-disable-next-line i18next/no-literal-string
              value: "CanAddPointsAndCanRemovePoints" satisfies UserPointsUpdateStrategy,
            },
          ]}
        />

        <Button
          variant="primary"
          size="medium"
          disabled={!isValid || newRegradingMutation.isPending}
          onClick={handleSubmit((data) => {
            const lines = data.ids
              .trim()
              .split("\n")
              .map((line) => line.trim())
            newRegradingMutation.mutate({
              body: {
                ids: lines,
                user_points_update_strategy: data.userPointsUpdateStrategy,
                id_type: data.idType,
              },
            })
          })}
        >
          {t("button-text-create")}
        </Button>
      </Dialog>
    </div>
  )
}

export default withSignedIn(RegradingsPage)
