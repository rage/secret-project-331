import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/router"
import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import FullWidthTable, { FullWidthTableRow } from "../../../components/tables/FullWidthTable"
import {
  createNewRegrading,
  fetchAllRegradings,
  fetchRegradingsCount,
} from "../../../services/backend/regradings"

import {
  NewRegrading,
  NewRegradingIdType,
  UserPointsUpdateStrategy,
} from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import DebugModal from "@/shared-module/common/components/DebugModal"
import Dialog from "@/shared-module/common/components/Dialog"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import SelectField from "@/shared-module/common/components/InputFields/SelectField"
import TextAreaField from "@/shared-module/common/components/InputFields/TextAreaField"
import Pagination from "@/shared-module/common/components/Pagination"
import Spinner from "@/shared-module/common/components/Spinner"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import usePaginationInfo from "@/shared-module/common/hooks/usePaginationInfo"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { isUuid } from "@/shared-module/common/utils/fetching"
import { dateToString } from "@/shared-module/common/utils/time"

interface Fields {
  ids: string
  userPointsUpdateStrategy: UserPointsUpdateStrategy
  idType: NewRegradingIdType
}

const RegradingsPage: React.FC = () => {
  const { t } = useTranslation()
  const router = useRouter()
  const paginationInfo = usePaginationInfo()
  const regradingsQuery = useQuery({
    queryKey: ["all-regradings", JSON.stringify(paginationInfo)],
    queryFn: () => fetchAllRegradings(paginationInfo),
  })
  const regradingsCountQuery = useQuery({
    queryKey: ["all-regradings-count"],
    queryFn: () => fetchRegradingsCount(),
  })
  const [newRegradingDialogOpen, setNewRegradingDialogOpen] = useState(false)
  const {
    register,
    reset,
    handleSubmit,
    formState: { isValid },
  } = useForm<Fields>({
    // eslint-disable-next-line i18next/no-literal-string
    mode: "onChange",
    defaultValues: {
      ids: "",
      // eslint-disable-next-line i18next/no-literal-string
      userPointsUpdateStrategy: "CanAddPointsButCannotRemovePoints",
      // eslint-disable-next-line i18next/no-literal-string
      idType: "ExerciseTaskSubmissionId",
    },
  })
  const newRegradingMutation = useToastMutation(
    (newRegrading: NewRegrading) => createNewRegrading(newRegrading),
    { notify: true, method: "POST" },
    {
      onSuccess: (data) => {
        setNewRegradingDialogOpen(false)
        reset()
        // eslint-disable-next-line i18next/no-literal-string
        router.push(`/manage/regradings/${data}`)
      },
    },
  )

  if (regradingsQuery.isError) {
    return <ErrorBanner variant="readOnly" error={regradingsQuery.error} />
  }

  if (regradingsQuery.isPending) {
    return <Spinner variant="medium" />
  }

  return (
    <>
      <div
        className={css`
          margin-top: 40px;
          ${respondToOrLarger.sm} {
            margin-top: 80px;
          }
        `}
      >
        <h1>{t("title-regradings")}</h1>
        <FullWidthTable>
          <thead>
            <tr
              className={css`
                text-align: left;
                font-size: 13px;
              `}
            >
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <th>id</th>
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <th>created_at</th>
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <th>updated_at</th>
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <th>regrading_started_at</th>
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <th>regrading_completed_at</th>
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <th>total_grading_progress</th>
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <th>user_points_update_strategy</th>
            </tr>
          </thead>
          <tbody>
            {regradingsQuery.data.map((regrading) => (
              <FullWidthTableRow key={regrading.id}>
                <td>
                  <Link href={`/manage/regradings/${regrading.id}`}>{regrading.id}</Link>
                </td>
                <td>{dateToString(regrading.created_at)}</td>
                <td>{dateToString(regrading.updated_at)}</td>
                <td>
                  {regrading.regrading_started_at
                    ? dateToString(regrading.regrading_started_at)
                    : // eslint-disable-next-line i18next/no-literal-string
                      "null"}
                </td>
                <td>
                  {" "}
                  {regrading.regrading_completed_at
                    ? dateToString(regrading.regrading_completed_at)
                    : // eslint-disable-next-line i18next/no-literal-string
                      "null"}
                </td>
                <td>{regrading.total_grading_progress}</td>
                <td>{regrading.user_points_update_strategy}</td>
              </FullWidthTableRow>
            ))}
          </tbody>
        </FullWidthTable>
        {regradingsCountQuery.data !== undefined && (
          <Pagination
            totalPages={Math.ceil(regradingsCountQuery.data / paginationInfo.limit)}
            paginationInfo={paginationInfo}
          />
        )}
      </div>
      <Button
        variant="primary"
        size="medium"
        onClick={() => {
          setNewRegradingDialogOpen(true)
        }}
      >
        {t("button-text-new-regrading")}
      </Button>
      <Dialog open={newRegradingDialogOpen} onClose={() => setNewRegradingDialogOpen(false)}>
        <h1>{t("button-text-new-regrading")}</h1>

        <SelectField
          id={"id-type"}
          label={t("label-id-type")}
          options={[
            {
              label: t("option-exercise-task-submission-id"),
              // eslint-disable-next-line i18next/no-literal-string
              value: "ExerciseTaskSubmissionId" satisfies NewRegradingIdType,
            },

            {
              label: t("option-exercise-id"),
              // eslint-disable-next-line i18next/no-literal-string
              value: "ExerciseId" satisfies NewRegradingIdType,
            },
          ]}
          {...register("idType")}
        />
        <TextAreaField
          label={t("label-ids-one-per-line")}
          rows={20}
          {...register("ids", {
            validate: (input) => {
              const lines = input.trim().split("\n")
              if (lines.length === 0) {
                return false
              }

              return lines.every((line) => isUuid(line.trim()))
            },
          })}
        />

        <SelectField
          id={"user-points-update-strategy"}
          label={t("label-user-points-update-strategy")}
          options={[
            {
              label: t("option-can-add-points-but-cannot-remove-points"),
              // eslint-disable-next-line i18next/no-literal-string
              value: "CanAddPointsButCannotRemovePoints" satisfies UserPointsUpdateStrategy,
            },

            {
              label: t("option-can-add-points-and-can-remove-points"),
              // eslint-disable-next-line i18next/no-literal-string
              value: "CanAddPointsAndCanRemovePoints" satisfies UserPointsUpdateStrategy,
            },
          ]}
          {...register("userPointsUpdateStrategy")}
        />

        <Button
          variant="primary"
          size="medium"
          disabled={!isValid || newRegradingMutation.isPending}
          onClick={handleSubmit(async (data) => {
            const lines = data.ids
              .trim()
              .split("\n")
              .map((line) => line.trim())
            newRegradingMutation.mutate({
              ids: lines,
              user_points_update_strategy: data.userPointsUpdateStrategy,
              id_type: data.idType,
            })
          })}
        >
          {t("button-text-create")}
        </Button>
      </Dialog>
      <DebugModal data={regradingsQuery.data} />
    </>
  )
}

export default withSignedIn(RegradingsPage)
