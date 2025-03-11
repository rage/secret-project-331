import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import {
  PeerOrSelfReviewAnswer,
  PeerReviewWithQuestionsAndAnswers,
} from "@/shared-module/common/bindings"
import Accordion from "@/shared-module/common/components/Accordion"
import LikertScale from "@/shared-module/common/components/PeerReview/LikertScale"
import useUserInfo from "@/shared-module/common/hooks/useUserInfo"
import { baseTheme } from "@/shared-module/common/styles"

export interface PeerReviewAccordionProps {
  peerOrSelfReviews: Array<PeerReviewWithQuestionsAndAnswers>
  title: string
}

const Question = styled.div`
  font-size: 22px;
  margin: 0 auto;
  margin-bottom: 1rem;
  display: block;
  color: #1a2333;
`

// eslint-disable-next-line i18next/no-literal-string
const Title = styled.h5`
  border-bottom: 1px solid ${baseTheme.colors.clear[600]};
  padding: 0 1.5rem 1rem;
`

const QuestionWrapper = styled.div`
  margin: 2rem 1.5rem 0rem;
`

const PeerReviewAccordion: React.FC<PeerReviewAccordionProps> = ({ peerOrSelfReviews, title }) => {
  const { t } = useTranslation()
  const userInfo = useUserInfo()

  const mapToAnswer = (question: string, answer: PeerOrSelfReviewAnswer) => {
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

  const peerReviews = useMemo(() => {
    return peerOrSelfReviews.filter((x) => x.peer_review_giver_user_id !== userInfo.data?.user_id)
  }, [peerOrSelfReviews, userInfo.data?.user_id])

  const selfReviews = useMemo(() => {
    return peerOrSelfReviews.filter((x) => x.peer_review_giver_user_id === userInfo.data?.user_id)
  }, [peerOrSelfReviews, userInfo.data?.user_id])

  return (
    <Accordion>
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
            {peerOrSelfReviews.length}
          </span>
        </summary>
        <div
          className={css`
            background: ${baseTheme.colors.clear[100]};
            margin: 0.5rem 0;
          `}
        >
          {selfReviews.map((selfReview) => (
            <div key={selfReview.peer_or_self_review_submission_id}>
              <Title>{t("title-self-review")}</Title>
              {selfReview.questions_and_answers.map((x, i) => (
                <QuestionWrapper key={x.peer_or_self_review_question_id}>
                  {mapToAnswer(
                    `${t("question-n", { n: i + 1 })}: ${x.question}${
                      x.answer_required ? " *" : ""
                    }`,
                    x.answer,
                  )}
                </QuestionWrapper>
              ))}
            </div>
          ))}
          {peerReviews.map((peerReview, i) => (
            <div key={peerReview.peer_or_self_review_submission_id}>
              <Title>{t("peer-review-n", { n: i + 1 })}</Title>
              {peerReview.questions_and_answers.map((x, i) => (
                <QuestionWrapper key={x.peer_or_self_review_question_id}>
                  {mapToAnswer(
                    `${t("question-n", { n: i + 1 })}: ${x.question}${
                      x.answer_required ? " *" : ""
                    }`,
                    x.answer,
                  )}
                </QuestionWrapper>
              ))}
            </div>
          ))}
        </div>
      </details>
    </Accordion>
  )
}

export default PeerReviewAccordion
