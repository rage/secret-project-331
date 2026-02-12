"use client"

import { css } from "@emotion/css"
import Link from "next/link"
import { useTranslation } from "react-i18next"

import { UserDisplay } from "@/components/UserDisplay"
import {
  PeerOrSelfReviewQuestion,
  PeerOrSelfReviewQuestionSubmission,
  PeerOrSelfReviewSubmission,
} from "@/shared-module/common/bindings"
import HideTextInSystemTests from "@/shared-module/common/components/system-tests/HideTextInSystemTests"
import { baseTheme } from "@/shared-module/common/styles"

export interface PeerOrSelfReviewSubmissionSummaryAccordionProps {
  peerOrSelfReviewSubmission: PeerOrSelfReviewSubmission
  peerOrSelfReviewQuestionSubmissions: PeerOrSelfReviewQuestionSubmission[]
  peerOrSelfReviewQuestions: PeerOrSelfReviewQuestion[]
  showSubmissionBeingReviewed?: boolean
}

const PeerOrSelfReviewSubmissionSummaryAccordion = ({
  peerOrSelfReviewSubmission,
  peerOrSelfReviewQuestionSubmissions,
  showSubmissionBeingReviewed,
  peerOrSelfReviewQuestions,
}: PeerOrSelfReviewSubmissionSummaryAccordionProps) => {
  const { t } = useTranslation()
  return (
    <div
      className={css`
        margin: 0.3rem 0;
      `}
    >
      <details
        className={css`
          border: 1px solid ${baseTheme.colors.green[200]};
          border-left: 3px solid ${baseTheme.colors.green[200]};
          border-radius: 4px;
          background: ${baseTheme.colors.green[50]};
          &[open] {
            border-left-color: ${baseTheme.colors.green[500]};
          }
          & > summary {
            padding: 0.45rem 0.75rem;
            cursor: pointer;
            list-style: none;
            font-size: 0.8rem;
            color: ${baseTheme.colors.gray[600]};
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 0.5rem;
            user-select: none;
          }
          & > summary:hover {
            background: ${baseTheme.colors.green[75]};
          }
          & > summary::-webkit-details-marker {
            display: none;
          }
          & > summary::after {
            content: "\\203A";
            font-size: 1.1rem;
            line-height: 1;
            color: ${baseTheme.colors.gray[500]};
            transition: transform 0.15s ease;
            display: inline-block;
            flex-shrink: 0;
          }
          &[open] > summary::after {
            transform: rotate(90deg);
          }
          &[open] > summary {
            border-bottom: 1px solid ${baseTheme.colors.green[100]};
          }
        `}
      >
        <summary>
          <span>
            {t("peer-review-submission-id")}:{" "}
            <HideTextInSystemTests
              text={peerOrSelfReviewSubmission.id}
              testPlaceholder="00000000-0000-0000-0000-000000000000"
            />
          </span>
        </summary>
        <div
          className={css`
            padding: 0.6rem 0.75rem;
            font-size: 0.8rem;
          `}
        >
          <div
            className={css`
              display: flex;
              align-items: center;
              justify-content: space-between;
              flex-wrap: wrap;
              gap: 0.4rem;
              margin-bottom: 0.5rem;
            `}
          >
            <UserDisplay
              userId={peerOrSelfReviewSubmission.user_id}
              courseId={peerOrSelfReviewSubmission.course_id}
            />
            {showSubmissionBeingReviewed && (
              <span
                className={css`
                  color: ${baseTheme.colors.gray[600]};
                `}
              >
                {t("label-submission-being-reviewed")}:{" "}
                <Link
                  href={`/submissions/${peerOrSelfReviewSubmission.exercise_slide_submission_id}`}
                  className={css`
                    color: ${baseTheme.colors.blue[600]};
                    text-decoration: none;
                    &:hover {
                      text-decoration: underline;
                    }
                  `}
                >
                  <HideTextInSystemTests
                    text={peerOrSelfReviewSubmission.exercise_slide_submission_id}
                    testPlaceholder="00000000-0000-0000-0000-000000000000"
                  />
                </Link>
              </span>
            )}
          </div>

          <div
            className={css`
              display: flex;
              flex-direction: column;
              gap: 0.4rem;
            `}
          >
            {peerOrSelfReviewQuestionSubmissions.map((prqs) => {
              const peerOrSelfReviewQuestion = peerOrSelfReviewQuestions.find(
                (prq) => prq.id === prqs.peer_or_self_review_question_id,
              )
              const hasNumber = prqs.number_data !== null
              const hasText = prqs.text_data !== null
              return (
                <div key={prqs.id}>
                  {hasNumber && !hasText && (
                    <div
                      className={css`
                        display: flex;
                        align-items: baseline;
                        gap: 0.5rem;
                      `}
                    >
                      <span
                        className={css`
                          color: ${baseTheme.colors.gray[700]};
                          font-weight: 500;
                        `}
                      >
                        {peerOrSelfReviewQuestion?.question}
                      </span>
                      <span
                        className={css`
                          padding: 0.05rem 0.4rem;
                          border-radius: 3px;
                          background: ${baseTheme.colors.green[100]};
                          color: ${baseTheme.colors.green[700]};
                          font-weight: 600;
                        `}
                      >
                        {prqs.number_data}
                      </span>
                    </div>
                  )}
                  {hasText && (
                    <div>
                      {hasNumber && (
                        <div
                          className={css`
                            display: flex;
                            align-items: baseline;
                            gap: 0.5rem;
                            margin-bottom: 0.25rem;
                          `}
                        >
                          <span
                            className={css`
                              color: ${baseTheme.colors.gray[700]};
                              font-weight: 500;
                            `}
                          >
                            {peerOrSelfReviewQuestion?.question}
                          </span>
                          <span
                            className={css`
                              padding: 0.05rem 0.4rem;
                              border-radius: 3px;
                              background: ${baseTheme.colors.green[100]};
                              color: ${baseTheme.colors.green[700]};
                              font-weight: 600;
                            `}
                          >
                            {prqs.number_data}
                          </span>
                        </div>
                      )}
                      {!hasNumber && (
                        <div
                          className={css`
                            color: ${baseTheme.colors.gray[700]};
                            font-weight: 500;
                            margin-bottom: 0.2rem;
                          `}
                        >
                          {peerOrSelfReviewQuestion?.question}
                        </div>
                      )}
                      <div
                        className={css`
                          padding: 0.4rem 0.5rem;
                          background: ${baseTheme.colors.primary[100]};
                          border: 1px solid ${baseTheme.colors.clear[200]};
                          border-radius: 3px;
                          color: ${baseTheme.colors.gray[600]};
                          line-height: 1.5;
                          white-space: pre-wrap;
                        `}
                      >
                        {prqs.text_data}
                      </div>
                    </div>
                  )}
                  {!hasNumber && !hasText && (
                    <span
                      className={css`
                        color: ${baseTheme.colors.gray[700]};
                        font-weight: 500;
                      `}
                    >
                      {peerOrSelfReviewQuestion?.question}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </details>
    </div>
  )
}

export default PeerOrSelfReviewSubmissionSummaryAccordion
