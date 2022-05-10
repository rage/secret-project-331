import React, { useEffect } from "react"

import {
  CourseMaterialPeerReviewData,
  CourseMaterialPeerReviewQuestionAnswer,
} from "../../../../shared-module/bindings"

export interface PeerReviewViewProps {
  peerReviewData: CourseMaterialPeerReviewData
  setPeerReviewQuestionAnswer(
    questionId: string,
    value: CourseMaterialPeerReviewQuestionAnswer,
  ): void
}

const PeerReviewView: React.FC<PeerReviewViewProps> = ({
  peerReviewData,
  setPeerReviewQuestionAnswer,
}) => {
  // This is the demo bit
  useEffect(() => {
    peerReviewData.peer_review_questions.forEach((question) => {
      if (question.question_type === "Essay") {
        setPeerReviewQuestionAnswer(question.id, {
          peer_review_question_id: question.id,
          // eslint-disable-next-line i18next/no-literal-string
          text_data: "I think that the answer was clearly thought out.",
          number_data: null,
        })
      } else if (question.question_type === "Scale") {
        setPeerReviewQuestionAnswer(question.id, {
          peer_review_question_id: question.id,
          text_data: null,
          number_data: 5,
        })
      }
    })
  }, [peerReviewData, setPeerReviewQuestionAnswer])

  return (
    <div>
      <pre>
        {JSON.stringify(
          peerReviewData.exercise_task_submissions.map((x) => x.data_json),
          undefined,
          2,
        )}
      </pre>
      <pre>
        {JSON.stringify(
          peerReviewData.peer_review_questions.map((x) => x.question),
          undefined,
          2,
        )}
      </pre>
    </div>
  )
}

export default PeerReviewView
