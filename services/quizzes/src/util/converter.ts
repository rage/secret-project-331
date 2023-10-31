import {
  PrivateSpecQuiz,
  PrivateSpecQuizItem,
  PrivateSpecQuizItemCheckbox,
  PrivateSpecQuizItemChooseN,
  PrivateSpecQuizItemClosedEndedQuestion,
  PrivateSpecQuizItemEssay,
  PrivateSpecQuizItemMatrix,
  PrivateSpecQuizItemMultiplechoice,
  PrivateSpecQuizItemMultiplechoiceDropdown,
  PrivateSpecQuizItemScale,
  PrivateSpecQuizItemTimeline,
  QuizItemOption,
} from "../../types/quizTypes/privateSpec"
import {
  PublicQuizItemOption,
  PublicSpecQuiz,
  PublicSpecQuizItem,
  PublicSpecQuizItemCheckbox,
  PublicSpecQuizItemChooseN,
  PublicSpecQuizItemClosedEndedQuestion,
  PublicSpecQuizItemEssay,
  PublicSpecQuizItemMatrix,
  PublicSpecQuizItemMultiplechoice,
  PublicSpecQuizItemMultiplechoiceDropdown,
  PublicSpecQuizItemScale,
  PublicSpecQuizItemTimeline,
  PublicSpecQuizItemTimelineItem,
  PublicTimelineEvent,
} from "../../types/quizTypes/publicSpec"

export const convertPublicSpecFromPrivateSpec = (quiz: PrivateSpecQuiz) => {
  const publicQuiz: PublicSpecQuiz = {
    version: "2",
    body: quiz.body,
    items: [],
    title: quiz.title,
    quizItemDisplayDirection: quiz.quizItemDisplayDirection,
  }

  quiz.items.forEach((quizItem) => {
    const privateSpecQuizItem: PublicSpecQuizItem | null =
      convertPublicSpecItemFromPrivateSpecItem(quizItem)
    if (privateSpecQuizItem != null) {
      publicQuiz.items.push(privateSpecQuizItem)
    }
  })

  return publicQuiz
}

export const convertPublicSpecItemFromPrivateSpecItem = (
  quizItem: PrivateSpecQuizItem | null,
): PublicSpecQuizItem | null => {
  if (quizItem == null) {
    return null
  }
  if (quizItem.type === "checkbox") {
    const checkboxItem = quizItem as PrivateSpecQuizItemCheckbox
    return {
      id: checkboxItem.id,
      type: "checkbox",
      order: checkboxItem.order,
      body: checkboxItem.body,
      title: checkboxItem.title,
    } satisfies PublicSpecQuizItemCheckbox
  } else if (quizItem.type === "choose-n") {
    const chooseNItem = quizItem as PrivateSpecQuizItemChooseN
    return {
      id: chooseNItem.id,
      type: "choose-n",
      order: chooseNItem.order,
      body: chooseNItem.body,
      title: chooseNItem.title,
      options: chooseNItem.options.map(
        convertPublicSpecQuizItemOptionFromPrivateSpecQuizItemOption,
      ),
      n: chooseNItem.n,
    } satisfies PublicSpecQuizItemChooseN
  } else if (quizItem.type === "closed-ended-question") {
    const closedQuestionItem = quizItem as PrivateSpecQuizItemClosedEndedQuestion
    return {
      id: closedQuestionItem.id,
      type: "closed-ended-question",
      order: closedQuestionItem.order,
      body: closedQuestionItem.body,
      title: closedQuestionItem.title,
      formatRegex: closedQuestionItem.formatRegex,
    } satisfies PublicSpecQuizItemClosedEndedQuestion
  } else if (quizItem.type === "essay") {
    const essayItem = quizItem as PrivateSpecQuizItemEssay
    return {
      id: essayItem.id,
      type: "essay",
      order: essayItem.order,
      maxWords: essayItem.maxWords,
      minWords: essayItem.minWords,
      title: essayItem.title,
      body: essayItem.body,
    } satisfies PublicSpecQuizItemEssay
  } else if (quizItem.type === "matrix") {
    const matrixItem = quizItem as PrivateSpecQuizItemMatrix
    return {
      id: matrixItem.id,
      type: "matrix",
      order: matrixItem.order,
    } satisfies PublicSpecQuizItemMatrix
  } else if (quizItem.type === "multiple-choice") {
    const multipleChoiceItem = quizItem as PrivateSpecQuizItemMultiplechoice
    return {
      id: multipleChoiceItem.id,
      type: "multiple-choice",
      allowSelectingMultipleOptions: multipleChoiceItem.allowSelectingMultipleOptions,
      body: multipleChoiceItem.body,
      optionDisplayDirection: multipleChoiceItem.optionDisplayDirection,
      multipleChoiceMultipleOptionsGradingPolicy:
        multipleChoiceItem.multipleChoiceMultipleOptionsGradingPolicy,
      options: multipleChoiceItem.options.map(
        convertPublicSpecQuizItemOptionFromPrivateSpecQuizItemOption,
      ),
      order: multipleChoiceItem.order,
      shuffleOptions: multipleChoiceItem.shuffleOptions,
      title: multipleChoiceItem.title,
    } satisfies PublicSpecQuizItemMultiplechoice
  } else if (quizItem.type === "multiple-choice-dropdown") {
    const dropDownItem = quizItem as PrivateSpecQuizItemMultiplechoiceDropdown
    return {
      id: dropDownItem.id,
      type: "multiple-choice-dropdown",
      order: dropDownItem.order,
      body: dropDownItem.body,
      title: dropDownItem.title,
      options: dropDownItem.options.map(
        convertPublicSpecQuizItemOptionFromPrivateSpecQuizItemOption,
      ),
    } satisfies PublicSpecQuizItemMultiplechoiceDropdown
  } else if (quizItem.type === "scale") {
    const scaleItem = quizItem as PrivateSpecQuizItemScale
    return {
      id: scaleItem.id,
      type: "scale",
      order: scaleItem.order,
      title: scaleItem.title,
      body: scaleItem.body,
      maxLabel: scaleItem.maxLabel ? scaleItem.maxLabel : "?",
      minLabel: scaleItem.minLabel ? scaleItem.minLabel : "?",
      maxValue: scaleItem.maxValue,
      minValue: scaleItem.minValue,
      optionAnswers: [],
    } satisfies PublicSpecQuizItemScale
  } else if (quizItem.type === "timeline") {
    const timeLineItem = quizItem as PrivateSpecQuizItemTimeline
    return {
      id: timeLineItem.id,
      type: "timeline",
      events:
        timeLineItem.timelineItems
          ?.map(
            (item) =>
              ({
                eventId: item.correctEventId,
                name: item.correctEventName,
              }) as PublicTimelineEvent,
          )
          .sort((i1, i2) => i1.name.localeCompare(i2.name)) ?? [],
      order: timeLineItem.order,
      timelineItems:
        timeLineItem.timelineItems
          ?.map(
            (item) =>
              ({
                itemId: item.id,
                year: item.year,
              }) as PublicSpecQuizItemTimelineItem,
          )
          .sort((i1, i2) => i1.year.localeCompare(i2.year)) ?? [],
    } satisfies PublicSpecQuizItemTimeline
  }
  return null
}

const convertPublicSpecQuizItemOptionFromPrivateSpecQuizItemOption = (
  input: QuizItemOption,
): PublicQuizItemOption => {
  return {
    id: input.id,
    order: input.order,
    body: input.body,
    title: input.title,
  }
}
