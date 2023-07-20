import { UserItemAnswerTimeline } from "../../../types/quizTypes/answer"
import { PrivateSpecQuizItemTimeline } from "../../../types/quizTypes/privateSpec"

const assessTimeline = (
  quizItemAnswer: UserItemAnswerTimeline,
  quizItem: PrivateSpecQuizItemTimeline,
) => {
  if (!quizItem.timelineItems) {
    throw new Error("No timeline items for timeline assignment")
  }
  let nCorrect = 0
  quizItem.timelineItems.forEach((ti) => {
    const answer = quizItemAnswer.timelineChoices.find((tc) => tc.timelineItemId === ti.id)
    if (answer) {
      nCorrect++
    }
  })

  const timeLineItemsCount = quizItem.timelineItems.length
  const correctnessCoefficient = nCorrect / quizItem.timelineItems.length

  return {
    quizItemId: quizItem.id,
    correct: nCorrect === timeLineItemsCount,
    correctnessCoefficient,
  }
}

export { assessTimeline }
