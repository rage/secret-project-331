"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { getExerciseAnswerSharesOptions } from "@/generated/api/@tanstack/react-query.generated"
import type { ExerciseAnswerShare, UserDetail } from "@/generated/api/types.generated"
import { formatUserName, useUserDetailsLookup } from "@/hooks/useUserDetails"
import { dateToString } from "@/shared-module/common/utils/time"
import { EmptyState, Link, QueryResult, Table } from "@/shared-module/components"

interface Props {
  exerciseId: string
  courseId: string
}

/** The exercise's live share links, pastes from the editor among them, with who made each. */
const AnswerShareList: React.FC<Props> = ({ exerciseId, courseId }) => {
  const { t } = useTranslation()
  const sharesQuery = useQuery(
    getExerciseAnswerSharesOptions({ path: { exercise_id: exerciseId } }),
  )
  const userIds = useMemo(
    () => (sharesQuery.data ?? []).map((share) => share.user_id),
    [sharesQuery.data],
  )
  const userDetails = useUserDetailsLookup(courseId, userIds)

  return (
    <QueryResult query={sharesQuery} emptyFallback={<EmptyState title={t("no-shared-answers")} />}>
      {(shares) => (
        <AnswerShareTable shares={shares} userOf={(share) => userDetails(share.user_id)} />
      )}
    </QueryResult>
  )
}

const AnswerShareTable: React.FC<{
  shares: ExerciseAnswerShare[]
  userOf: (share: ExerciseAnswerShare) => UserDetail | undefined
}> = ({ shares, userOf }) => {
  const { t } = useTranslation()
  return (
    <Table
      caption={t("header-shared-answers")}
      className={css`
        margin: 1.5rem auto 2rem auto;
      `}
      rows={shares}
      rowKey={(share) => share.share_id}
      columns={[
        {
          header: t("label-link"),
          cell: (share) => (
            <Link href={`/shared-submissions/${share.share_id}`}>
              {share.is_graded ? t("label-shared-submission") : t("label-paste")}
            </Link>
          ),
        },
        {
          header: t("label-created-at"),
          cell: (share) => dateToString(share.created_at),
        },
        {
          header: t("label-name"),
          cell: (share) => formatUserName(userOf(share)) || "",
        },
        {
          header: t("label-email"),
          cell: (share) => userOf(share)?.email || share.user_id,
        },
      ]}
    />
  )
}

export default AnswerShareList
