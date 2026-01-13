"use client"
import { css } from "@emotion/css"
import { Link as LinkIcon } from "@vectopus/atlas-icons-react"
import Link from "next/link"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { useBulkUserDetails } from "@/hooks/useUserDetails"
import { ExerciseSlideSubmission, UserDetail } from "@/shared-module/common/bindings"
import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import { baseTheme, fontWeights, headingFont, secondaryFont } from "@/shared-module/common/styles"
import { dateToString } from "@/shared-module/common/utils/time"

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
  return (
    <>
      <BreakFromCentered sidebar={false}>
        <div
          className={css`
            overflow-x: auto;
            width: 100%;
          `}
        >
          <table
            className={css`
              border-collapse: collapse;
              border: 1px solid ${baseTheme.colors.clear[300]};
              margin: 1.5rem auto 2rem auto;
              width: auto;
              min-width: 600px;

              td,
              th {
                border-left: 1px solid ${baseTheme.colors.clear[300]};
                border-right: 1px solid ${baseTheme.colors.clear[300]};
                color: ${baseTheme.colors.gray[500]};
                padding-left: 30px;
                padding-right: 30px;
                text-align: left;
                height: 60px;
                overflow-wrap: break-word;
                word-break: break-all;
              }
            `}
          >
            <thead>
              <tr
                className={css`
                  font-family: ${secondaryFont};
                  font-weight: ${fontWeights.semibold};
                  font-size: ${baseTheme.fontSizes[14]};
                  text-transform: uppercase;
                  opacity: 0.8;
                  padding-right: 30px;
                `}
              >
                <th
                  className={css`
                    min-width: 100px;
                  `}
                >
                  {t("label-link")}
                </th>
                <th
                  className={css`
                    min-width: 200px;
                  `}
                >
                  {t("label-submission-time")}
                </th>
                <th
                  className={css`
                    width: auto;
                    min-width: 120px;
                  `}
                >
                  {t("first-name")}
                </th>
                <th
                  className={css`
                    width: auto;
                    min-width: 120px;
                  `}
                >
                  {t("last-name")}
                </th>
                <th
                  className={css`
                    width: auto;
                    min-width: 200px;
                  `}
                >
                  {t("label-email")}
                </th>
              </tr>
            </thead>
            <tbody
              className={css`
                tr:nth-child(odd) {
                  background-color: ${baseTheme.colors.clear[100]};
                }
              `}
            >
              {exerciseSubmissions.map((x) => (
                <tr
                  key={x.id}
                  className={css`
                    font-family: ${headingFont};
                    font-weight: ${fontWeights.medium};
                    font-size: ${baseTheme.fontSizes[16]};
                    line-height: 19px;
                  `}
                >
                  <td
                    className={css`
                      font-size: 20px;
                      text-align: center !important;
                    `}
                  >
                    <Link href={`/submissions/${x.id}`}>
                      <LinkIcon
                        size={20}
                        className={css`
                          color: #868b93;
                        `}
                      />
                    </Link>
                  </td>
                  <td>{dateToString(x.created_at)}</td>
                  <td>
                    {(() => {
                      const userDetails = userDetailsMap.get(x.user_id) as UserDetail | undefined
                      return userDetails?.first_name || ""
                    })()}
                  </td>
                  <td>
                    {(() => {
                      const userDetails = userDetailsMap.get(x.user_id) as UserDetail | undefined
                      return userDetails?.last_name || ""
                    })()}
                  </td>
                  <td>
                    {(() => {
                      const userDetails = userDetailsMap.get(x.user_id) as UserDetail | undefined
                      return userDetails?.email || x.user_id // Fallback to user ID if email not found
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </BreakFromCentered>
    </>
  )
}

export default ExerciseSubmissionList
