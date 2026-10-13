"use client"

import { css } from "@emotion/css"
import { Link as LinkIcon } from "@vectopus/atlas-icons-react"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { ALIGN_CENTER } from "@/components/credit-registration/constants"
import type { ExerciseSlideSubmission, UserDetail } from "@/generated/api/types.generated"
import { useBulkUserDetails } from "@/hooks/useUserDetails"
import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import { dateToString } from "@/shared-module/common/utils/time"
import { Link, Table } from "@/shared-module/components"

interface Props {
  exerciseSubmissions: ExerciseSlideSubmission[]
  courseId: string
}

const ExerciseSubmissionList: React.FC<React.PropsWithChildren<Props>> = ({
  exerciseSubmissions,
  courseId,
}) => {
  const { t } = useTranslation()

  // Extract unique user IDs from submissions
  const userIds = useMemo(() => {
    const uniqueUserIds = Array.from(
      new Set(exerciseSubmissions.map((submission) => submission.user_id)),
    )
    return uniqueUserIds
  }, [exerciseSubmissions])

  // Fetch user details for all unique users
  const userDetailsQuery = useBulkUserDetails(courseId, userIds)

  // Create a map for quick user lookup
  const userDetailsMap = useMemo(() => {
    if (!userDetailsQuery.data) {
      return new Map<string, UserDetail>()
    }
    return new Map(userDetailsQuery.data.map((user) => [user.user_id, user]))
  }, [userDetailsQuery.data])

  if (exerciseSubmissions.length === 0) {
    return <div>{t("no-submissions")}</div>
  }

  const userOf = (submission: ExerciseSlideSubmission): UserDetail | undefined =>
    userDetailsMap.get(submission.user_id)

  return (
    <BreakFromCentered sidebar={false}>
      <Table
        caption={t("header-submissions")}
        className={css`
          margin: 1.5rem auto 2rem auto;
        `}
        rows={exerciseSubmissions}
        rowKey={(submission) => submission.id}
        columns={[
          {
            header: t("label-link"),
            align: ALIGN_CENTER,
            cell: (submission) => (
              <Link href={`/submissions/${submission.id}`}>
                <LinkIcon
                  size={20}
                  className={css`
                    color: #868b93;
                  `}
                />
              </Link>
            ),
          },
          {
            header: t("label-submission-time"),
            cell: (submission) => dateToString(submission.created_at),
          },
          { header: t("first-name"), cell: (submission) => userOf(submission)?.first_name || "" },
          { header: t("last-name"), cell: (submission) => userOf(submission)?.last_name || "" },
          {
            header: t("label-email"),
            // Falls back to the user ID while details are missing.
            cell: (submission) => userOf(submission)?.email || submission.user_id,
          },
        ]}
      />
    </BreakFromCentered>
  )
}

export default ExerciseSubmissionList
