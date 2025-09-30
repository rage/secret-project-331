import { UserItemAnswerTimeline } from "../../../types/quizTypes/answer"
import { PrivateSpecQuizItemTimeline } from "../../../types/quizTypes/privateSpec"

const assessTimeline = (
  quizItemAnswer: UserItemAnswerTimeline,
  quizItem: PrivateSpecQuizItemTimeline,
) => {
  if (!quizItem.timelineItems) {
    throw new Error("No timeline items for timeline assignment")
  }

  const result = quizItemAnswer.timelineChoices.map((choice) => {
    const item = quizItem.timelineItems?.find((qItem) => qItem.id == choice.timelineItemId)
    return item?.correctEventId == choice.chosenEventId
  })

  const totalItems = quizItem.timelineItems.length
  const correctnessCoefficient =
    totalItems === 0 ? 0 : result.filter((item) => item == true).length / totalItems

  return {
    quizItemId: quizItem.id,
    correctnessCoefficient,
  }
}

export { assessTimeline }
