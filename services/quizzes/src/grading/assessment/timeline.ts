import { UserItemAnswerTimeline } from "../../../types/quizTypes/answer"
import { PrivateSpecQuizItemTimeline } from "../../../types/quizTypes/privateSpec"

import { clamp01, safeDivide } from "@/utils/math"

const assessTimeline = (
  quizItemAnswer: UserItemAnswerTimeline,
  quizItem: PrivateSpecQuizItemTimeline,
) => {
  if (!quizItem.timelineItems) {
    throw new Error("No timeline items for timeline assignment")
  }

  const result = quizItemAnswer.timelineChoices.map((choice) => {
    const item = quizItem.timelineItems?.find((qItem) => qItem.id === choice.timelineItemId)
    return item?.correctEventId === choice.chosenEventId
  })

  const totalItems = quizItem.timelineItems.length
  const correctItems = result.filter((item) => item === true).length
  const rawCoefficient = safeDivide(correctItems, totalItems)
  const correctnessCoefficient = clamp01(rawCoefficient)

  return {
    quizItemId: quizItem.id,
    correctnessCoefficient,
  }
}

export { assessTimeline }
