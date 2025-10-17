"use client"
import { css } from "@emotion/css"
import Link from "next/link"
import React from "react"
import { useTranslation } from "react-i18next"

import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import HideTextInSystemTests from "@/shared-module/common/components/system-tests/HideTextInSystemTests"
import { baseTheme } from "@/shared-module/common/styles"
import { narrowContainerWidthRem } from "@/shared-module/common/styles/constants"
import { dateToString } from "@/shared-module/common/utils/time"

interface Submission {
  id: string
  created_at: string
}

interface AllSubmissionsListProps {
  submissions: Submission[] | undefined
  isLoading: boolean
  isError: boolean
  error: Error | null
  currentSubmissionId: string
}

const AllSubmissionsList: React.FC<AllSubmissionsListProps> = ({
  submissions,
  isLoading,
  isError,
  error,
  currentSubmissionId,
}) => {
  const { t } = useTranslation()

  return (
    <div
      className={css`
        max-width: ${narrowContainerWidthRem}rem;
        margin: 3rem auto 2rem auto;
      `}
    >
      <h2
        className={css`
          margin-bottom: 1.5rem;
          font-size: 1.5rem;
          font-weight: 600;
          color: ${baseTheme.colors.gray[700]};
        `}
      >
        {t("all-submissions-by-user")}
      </h2>

      {isLoading && <Spinner variant="medium" />}
      {isError && <ErrorBanner variant="readOnly" error={error} />}
      {submissions && (
        <div
          className={css`
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
          `}
        >
          {submissions
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .map((submission, index) => {
              const isCurrentSubmission = submission.id === currentSubmissionId
              const isLatestSubmission = index === 0

              return (
                <Link
                  key={submission.id}
                  href={`/submissions/${submission.id}`}
                  className={css`
                    text-decoration: none;
                    display: block;
                    transition: all 0.2s ease;

                    &:hover {
                      filter: brightness(1.05);
                    }
                  `}
                >
                  <div
                    className={css`
                      padding: 1rem 1.5rem;
                      border-radius: 8px;
                      border: 2px solid
                        ${isCurrentSubmission
                          ? baseTheme.colors.green[500]
                          : baseTheme.colors.gray[200]};
                      background-color: ${isCurrentSubmission
                        ? baseTheme.colors.green[100]
                        : baseTheme.colors.clear[100]};
                      position: relative;

                      &:hover {
                        border-color: ${baseTheme.colors.blue[400]};
                      }
                    `}
                  >
                    {isLatestSubmission && (
                      <div
                        className={css`
                          position: absolute;
                          top: -8px;
                          right: 12px;
                          background-color: ${baseTheme.colors.blue[600]};
                          color: white;
                          padding: 0.25rem 0.75rem;
                          border-radius: 12px;
                          font-size: 0.75rem;
                          font-weight: 600;
                          text-transform: uppercase;
                          letter-spacing: 0.5px;
                        `}
                      >
                        {t("latest")}
                      </div>
                    )}

                    {isCurrentSubmission && (
                      <div
                        className={css`
                          position: absolute;
                          top: -8px;
                          left: 12px;
                          background-color: ${baseTheme.colors.green[600]};
                          color: white;
                          padding: 0.25rem 0.75rem;
                          border-radius: 12px;
                          font-size: 0.75rem;
                          font-weight: 600;
                          text-transform: uppercase;
                          letter-spacing: 0.5px;
                        `}
                      >
                        {t("current")}
                      </div>
                    )}

                    <div
                      className={css`
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-top: ${isLatestSubmission || isCurrentSubmission ? "0.5rem" : "0"};
                      `}
                    >
                      <div>
                        <div
                          className={css`
                            font-weight: 600;
                            color: ${baseTheme.colors.gray[600]};
                            margin-bottom: 0.25rem;
                          `}
                        >
                          <HideTextInSystemTests
                            text={submission.id}
                            testPlaceholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                          />
                        </div>
                        <div
                          className={css`
                            font-size: 0.875rem;
                            color: ${baseTheme.colors.gray[600]};
                          `}
                        >
                          {dateToString(submission.created_at)}
                        </div>
                      </div>

                      <div
                        className={css`
                          text-align: right;
                        `}
                      >
                        <div
                          className={css`
                            font-weight: 600;
                            color: ${baseTheme.colors.gray[700]};
                            font-size: 0.875rem;
                          `}
                        >
                          {t("submission")} #{submissions.length - index}
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
        </div>
      )}
    </div>
  )
}

export default AllSubmissionsList
