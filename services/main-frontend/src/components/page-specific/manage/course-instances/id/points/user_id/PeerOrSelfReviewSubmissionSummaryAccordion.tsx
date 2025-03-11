import { css } from "@emotion/css"
import styled from "@emotion/styled"
import Link from "next/link"
import { useTranslation } from "react-i18next"

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

const PeerReviewDiv = styled.div`
  margin-bottom: 0.5rem;
`

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
          {showSubmissionBeingReviewed && (
            <PeerReviewDiv>
              {t("label-submission-being-reviewed")}:{" "}
              <Link
                href={{
                  pathname: "/submissions/[submissionId]",
                  query: { submissionId: peerOrSelfReviewSubmission.exercise_slide_submission_id },
                }}
              >
                <HideTextInSystemTests
                  text={peerOrSelfReviewSubmission.exercise_slide_submission_id}
                  testPlaceholder="00000000-0000-0000-0000-000000000000"
                />
              </Link>
            </PeerReviewDiv>
          )}
          {peerOrSelfReviewQuestionSubmissions.map((prqs) => {
            const peerOrSelfReviewQuestion = peerOrSelfReviewQuestions.find(
              (prq) => prq.id === prqs.peer_or_self_review_question_id,
            )
            return (
              <PeerReviewDiv key={prqs.id}>
                <p>
                  {t("question")}: {peerOrSelfReviewQuestion?.question}{" "}
                  {prqs.number_data !== null && (
                    <span
                      className={css`
                        background-color: ${baseTheme.colors.clear[100]};
                        padding: 0.5rem;
                        white-space: pre-wrap;
                      `}
                    >
                      {prqs.number_data}
                    </span>
                  )}
                </p>

                {prqs.text_data !== null && (
                  <div
                    className={css`
                      background-color: ${baseTheme.colors.clear[100]};
                      padding: 0.5rem;
                      white-space: pre-wrap;
                    `}
                  >
                    {prqs.text_data}
                  </div>
                )}
              </PeerReviewDiv>
            )
          })}
        </details>
      </Accordion>
    </div>
  )
}

export default PeerOrSelfReviewSubmissionSummaryAccordion
