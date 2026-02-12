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
import Accordion from "@/shared-module/common/components/Accordion"
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
        margin: 0.5rem 0;
      `}
    >
      <Accordion>
        <details>
          <summary>
            {t("peer-review-submission-id")}:{" "}
            <HideTextInSystemTests
              text={peerOrSelfReviewSubmission.id}
              testPlaceholder="00000000-0000-0000-0000-000000000000"
            />
          </summary>
          <div
            className={css`
              padding: 1rem 1.5rem;
            `}
          >
            <div
              className={css`
                display: flex;
                align-items: center;
                justify-content: space-between;
                flex-wrap: wrap;
                gap: 0.5rem;
                margin-bottom: 1rem;
                padding-bottom: 0.75rem;
                border-bottom: 1px solid ${baseTheme.colors.clear[200]};
              `}
            >
              <UserDisplay
                userId={peerOrSelfReviewSubmission.user_id}
                courseId={peerOrSelfReviewSubmission.course_id}
              />
              {showSubmissionBeingReviewed && (
                <span
                  className={css`
                    font-size: 0.85rem;
                    color: ${baseTheme.colors.gray[500]};
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
                gap: 0.75rem;
              `}
            >
              {peerOrSelfReviewQuestionSubmissions.map((prqs) => {
                const peerOrSelfReviewQuestion = peerOrSelfReviewQuestions.find(
                  (prq) => prq.id === prqs.peer_or_self_review_question_id,
                )
                return (
                  <div
                    key={prqs.id}
                    className={css`
                      padding: 0.75rem;
                      border-radius: 6px;
                      border: 1px solid ${baseTheme.colors.clear[200]};
                      background: ${baseTheme.colors.primary[100]};
                    `}
                  >
                    <p
                      className={css`
                        margin: 0 0 0.25rem;
                        font-weight: 500;
                        color: ${baseTheme.colors.gray[700]};
                        font-size: 0.9rem;
                      `}
                    >
                      {peerOrSelfReviewQuestion?.question}
                    </p>
                    {prqs.number_data !== null && (
                      <span
                        className={css`
                          display: inline-block;
                          padding: 0.2rem 0.6rem;
                          border-radius: 4px;
                          background: ${baseTheme.colors.green[100]};
                          color: ${baseTheme.colors.green[700]};
                          font-weight: 600;
                          font-size: 0.95rem;
                        `}
                      >
                        {prqs.number_data}
                      </span>
                    )}
                    {prqs.text_data !== null && (
                      <div
                        className={css`
                          margin-top: 0.25rem;
                          padding: 0.5rem 0.75rem;
                          border-radius: 4px;
                          background: ${baseTheme.colors.clear[100]};
                          white-space: pre-wrap;
                          font-size: 0.9rem;
                          color: ${baseTheme.colors.gray[600]};
                          line-height: 1.5;
                        `}
                      >
                        {prqs.text_data}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </details>
      </Accordion>
    </div>
  )
}

export default PeerOrSelfReviewSubmissionSummaryAccordion
