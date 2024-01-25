import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import {
  PeerReviewAnswer,
  PeerReviewWithQuestionsAndAnswers,
} from "../../../../../../shared-module/common/bindings"
import Accordion from "../../../../../../shared-module/common/components/Accordion"
import LikertScale from "../../../../../../shared-module/common/components/PeerReview/LikertScale"
import { baseTheme } from "../../../../../../shared-module/common/styles"

export interface PeerReviewAccordionProps {
  peerReviews: Array<PeerReviewWithQuestionsAndAnswers>
  title: string
}

const Question = styled.div`
  font-size: 22px;
  margin: 0 auto;
  margin-bottom: 1rem;
  display: block;
  color: #1a2333;
`

const PeerReviewAccordion: React.FC<PeerReviewAccordionProps> = ({ peerReviews, title }) => {
  const { t } = useTranslation()

  const mapToAnswer = (question: string, answer: PeerReviewAnswer) => {
    switch (answer.type) {
      case "essay":
        return (
          <div>
            <Question>{question}</Question>
            <p>{answer.value}</p>
          </div>
        )
      case "scale":
        return (
          <div>
            <LikertScale
              question={question}
              disabled={true}
              answerRequired={false}
              selectedOption={answer.value}
              setSelectedOption={() => {
                // No-op
              }}
            />
          </div>
        )
      default:
        return (
          <div>
            <Question>{question}</Question>
            <p>
              <i>{t("no-answer-provided")}</i>
            </p>
          </div>
        )
    }
  }

  return (
    <Accordion variant="detail">
      <details>
        <summary>
          {title}{" "}
          <span
            className={css`
              background: ${baseTheme.colors.green[400]};
              border-radius: 20px;
              line-height: 10px;
              padding: 1px 5px;
              text-align: center;
              font-size: 14px;
              color: ${baseTheme.colors.primary[100]};
              margin-left: 3px;
              width: 20px;
              height: 20px;
            `}
          >
            {peerReviews.length}
          </span>
        </summary>
        <div
          className={css`
            background: ${baseTheme.colors.clear[100]};
            margin: 0.5rem 0;
          `}
        >
          {peerReviews.map((peerReview, i) => (
            <div key={peerReview.peer_review_submission_id}>
              <h5
                className={css`
                  border-bottom: 1px solid ${baseTheme.colors.clear[600]};
                  padding: 0 1.5rem 1rem;
                `}
              >
                {t("peer-review-n", { n: i + 1 })}
              </h5>
              {peerReview.questions_and_answers.map((x, i) => (
                <div
                  key={x.peer_review_question_id}
                  className={css`
                    margin: 2rem 1.5rem 0rem;
                  `}
                >
                  {mapToAnswer(
                    `${t("question-n", { n: i + 1 })}: ${x.question}${
                      x.answer_required ? " *" : ""
                    }`,
                    x.answer,
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </details>
    </Accordion>
  )
}

export default PeerReviewAccordion
