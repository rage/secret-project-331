import styled from "@emotion/styled"
import * as React from "react"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import {
  PeerOrSelfReviewQuestion,
  PeerOrSelfReviewQuestionSubmission,
} from "../../../../../../shared-module/bindings"

import Essay from "./Essay"
import Likert from "./Likert"
interface ReviewProps {
  orderNumber: number
  reviews: PeerOrSelfReviewQuestionSubmission[]
  questions: PeerOrSelfReviewQuestion[]
  selfReview: boolean
}

const Wrapper = styled.div`
  background: #f5f6f7;
  padding: 0 !important;

  &:not(:last-child) {
    margin-bottom: 10px;
  }
`
const Heading = styled.div`
  padding: 1rem;
  border-bottom: 2px solid #ebedee;
`

const PeerOrSelfReviewsReceived: React.FunctionComponent<ReviewProps> = ({
  orderNumber,
  reviews,
  questions,
  selfReview,
}) => {
  const { t } = useTranslation()

  const sortedReviews = useMemo(
    () =>
      reviews.sort((o1, o2) => {
        const o1Question = questions.find((q) => q.id === o1.peer_or_self_review_question_id)
        const o2Question = questions.find((q) => q.id === o2.peer_or_self_review_question_id)
        if (!o1Question) {
          return 1
        }
        if (!o2Question) {
          return -1
        }
        return o1Question.order_number - o2Question.order_number
      }),
    [questions, reviews],
  )

  return (
    <Wrapper>
      <Heading>
        {selfReview ? t("title-self-review") : `${t("peer-review")} #${orderNumber + 1}`}
      </Heading>
      {sortedReviews.map(({ id, number_data, text_data, peer_or_self_review_question_id }, index) => {
        const questionIndex = questions.findIndex((q) => q.id === peer_or_self_review_question_id)
        if (questionIndex === -1) {
          return null
        }
        const question = questions[questionIndex].question
        return (
          <>
            {text_data && <Essay key={id} question={question} content={text_data} index={index} />}
            {number_data !== null && (
              <Likert key={id} question={question} content={number_data} index={index} />
            )}
          </>
        )
      })}
    </Wrapper>
  )
}

export default PeerOrSelfReviewsReceived
