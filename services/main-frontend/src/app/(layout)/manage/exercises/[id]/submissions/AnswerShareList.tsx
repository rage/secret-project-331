"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { getExerciseAnswerSharesOptions } from "@/generated/api/@tanstack/react-query.generated"
import type { ExerciseAnswerShare, UserDetail } from "@/generated/api/types.generated"
import { formatUserName, useBulkUserDetails } from "@/hooks/useUserDetails"
import { dateToString } from "@/shared-module/common/utils/time"
import { EmptyState, ErrorNotice, Link, Table } from "@/shared-module/components"

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
  const shares = useMemo(() => sharesQuery.data ?? [], [sharesQuery.data])
  const userIds = useMemo(() => Array.from(new Set(shares.map((s) => s.user_id))), [shares])
  const userDetailsQuery = useBulkUserDetails(courseId, userIds)
  const userDetailsMap = useMemo(
    () => new Map<string, UserDetail>((userDetailsQuery.data ?? []).map((u) => [u.user_id, u])),
    [userDetailsQuery.data],
  )

  if (sharesQuery.isError) {
    return <ErrorNotice error={sharesQuery.error} />
  }
  if (sharesQuery.isSuccess && shares.length === 0) {
    return <EmptyState title={t("no-shared-answers")} />
  }

  const userOf = (share: ExerciseAnswerShare) => userDetailsMap.get(share.user_id)
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
