import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/router"
import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import Layout from "../../../components/Layout"
import FullWidthTable, { FullWidthTableRow } from "../../../components/tables/FullWidthTable"
import {
  createNewRegrading,
  fetchAllRegradings,
  fetchRegradingsCount,
} from "../../../services/backend/regradings"
import { NewRegrading, UserPointsUpdateStrategy } from "../../../shared-module/bindings"
import Button from "../../../shared-module/components/Button"
import DebugModal from "../../../shared-module/components/DebugModal"
import Dialog from "../../../shared-module/components/Dialog"
import ErrorBanner from "../../../shared-module/components/ErrorBanner"
import SelectField from "../../../shared-module/components/InputFields/SelectField"
import TextAreaField from "../../../shared-module/components/InputFields/TextAreaField"
import Pagination from "../../../shared-module/components/Pagination"
import Spinner from "../../../shared-module/components/Spinner"
import usePaginationInfo from "../../../shared-module/hooks/usePaginationInfo"
import useToastMutation from "../../../shared-module/hooks/useToastMutation"
import { respondToOrLarger } from "../../../shared-module/styles/respond"
import { isUuid } from "../../../shared-module/utils/fetching"
import { dateToString } from "../../../shared-module/utils/time"

interface Fields {
  exerciseTaskSubmissionIds: string
  userPointsUpdateStrategy: UserPointsUpdateStrategy
}

const RegradingsPage: React.FC = () => {
  const { t } = useTranslation()
  const router = useRouter()
  const paginationInfo = usePaginationInfo()
  const regradingsQuery = useQuery(["all-regradings", JSON.stringify(paginationInfo)], () =>
    fetchAllRegradings(paginationInfo),
  )
  const regradingsCountQuery = useQuery(["all-regradings-count"], () => fetchRegradingsCount())
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
      exerciseTaskSubmissionIds: "",
      // eslint-disable-next-line i18next/no-literal-string
      userPointsUpdateStrategy: "CanAddPointsButCannotRemovePoints",
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
    return (
      <Layout navVariant="simple">
        <ErrorBanner variant="readOnly" error={regradingsQuery.error} />
      </Layout>
    )
  }

  if (regradingsQuery.isLoading) {
    return (
      <Layout navVariant="simple">
        <Spinner variant="medium" />
      </Layout>
    )
  }

  return (
    <Layout navVariant="simple">
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
                  <Link href={`/manage/regradings/${regrading.id}`} passHref>
                    <a>{regrading.id}</a>
                  </Link>
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
        <TextAreaField
          label={t("label-exercise-task-submission-ids")}
          rows={20}
          register={register("exerciseTaskSubmissionIds", {
            validate: (input) => {
              const lines = input.trim().split("\n")
              if (lines.length === 0) {
                return false
              }

              return lines.every((line) => isUuid(line.trim()))
            },
          })}
        />
        <SelectField<UserPointsUpdateStrategy>
          id={"user-points-update-strategy"}
          label={t("label-user-points-update-strategy")}
          options={[
            {
              label: t("option-can-add-points-but-cannot-remove-points"),
              // eslint-disable-next-line i18next/no-literal-string
              value: "CanAddPointsButCannotRemovePoints",
            },

            {
              label: t("option-can-add-points-and-can-remove-points"),
              // eslint-disable-next-line i18next/no-literal-string
              value: "CanAddPointsAndCanRemovePoints",
            },
          ]}
          register={register("userPointsUpdateStrategy")}
        />
        <Button
          variant="primary"
          size="medium"
          disabled={!isValid || newRegradingMutation.isLoading}
          onClick={handleSubmit(async (data) => {
            const lines = data.exerciseTaskSubmissionIds
              .trim()
              .split("\n")
              .map((line) => line.trim())
            newRegradingMutation.mutate({
              exercise_task_submission_ids: lines,
              user_points_update_strategy: data.userPointsUpdateStrategy,
            })
          })}
        >
          {t("button-text-create")}
        </Button>
      </Dialog>
      <DebugModal data={regradingsQuery.data} />
    </Layout>
  )
}

export default RegradingsPage
