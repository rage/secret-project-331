import { css } from "@emotion/css"
import styled from "@emotion/styled"
import Link from "next/link"
import { useTranslation } from "react-i18next"

import { PeerReviewDataForSubmission } from "../../../../../../../shared-module/bindings"
import Accordion from "../../../../../../../shared-module/components/Accordion"
import { baseTheme } from "../../../../../../../shared-module/styles"

export interface PeerReviewSubmissionSummaryAccordionProps {
  peerReviewSubmission: PeerReviewDataForSubmission
  submissionBeingreviewedId?: string
}

const PeerReviewDiv = styled.div`
  margin-bottom: 0.5rem;
`

const PeerReviewSubmissionSummaryAccordion = ({
  peerReviewSubmission,
  submissionBeingreviewedId,
}: PeerReviewSubmissionSummaryAccordionProps) => {
  const { t } = useTranslation()
  return (
    <div
      className={css`
        margin: 0.5rem 0;
      `}
    >
      <Accordion variant="detail">
        <details>
          <summary>
            {t("peer-review-submission-id")}: {peerReviewSubmission.submission_id}
          </summary>
          {submissionBeingreviewedId && (
            <PeerReviewDiv>
              Submission being reviewed:{" "}
              <Link
                href={{
                  pathname: "/submissions/[submissionId]",
                  query: { submissionId: submissionBeingreviewedId },
                }}
              >
                {submissionBeingreviewedId}
              </Link>
            </PeerReviewDiv>
          )}
          {peerReviewSubmission.data.map((test) => (
            <PeerReviewDiv key={test.pr_submission_id}>
              <p>
                {t("question")}: {test.question}{" "}
                {test.number_data !== null && (
                  <span
                    className={css`
                      background-color: ${baseTheme.colors.clear[100]};
                      padding: 0.5rem;
                      white-space: pre;
                    `}
                  >
                    {test.number_data}
                  </span>
                )}
              </p>

              {test.text_data !== null && (
                <div
                  className={css`
                    background-color: ${baseTheme.colors.clear[100]};
                    padding: 0.5rem;
                    white-space: pre;
                  `}
                >
                  {test.text_data}
                </div>
              )}
            </PeerReviewDiv>
          ))}
        </details>
      </Accordion>
    </div>
  )
}

export default PeerReviewSubmissionSummaryAccordion
