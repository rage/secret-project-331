/* eslint-disable i18next/no-literal-string */
import { OldQuizAnswer, OldQuizItemAnswer } from "../../../../types/oldQuizTypes"

// Quiz answers
const emptyQuizAnswer = (): OldQuizAnswer => ({
  createdAt: "",
  updatedAt: "",
  id: "",
  itemAnswers: [],
  quizId: "",
  status: "open",
})

const emptyQuizItemAnswer = (): OldQuizItemAnswer => ({
  id: "v4()",
  quizAnswerId: "v4()",
  quizItemId: "v4()",
  textData: null,
  intData: null,
  createdAt: "",
  updatedAt: "",
  correct: false,
  /** Whether or not the provided answer can be submitted. */
  valid: true,
  /** Only contains an id of a selected option */
  optionAnswers: null,
  optionCells: null,
  /** Only used for timeline answers. */
  timelineChoices: null,
})

// Quiz answer generation
export const generateQuizAnswer = <T extends Partial<OldQuizAnswer>>(
  initialValues: T,
): OldQuizAnswer & T => {
  return Object.assign(emptyQuizAnswer(), initialValues)
}

export const generateQuizItemAnswer = <T extends Partial<OldQuizItemAnswer>>(
  initialValues: T,
): OldQuizItemAnswer & T => {
  return Object.assign(emptyQuizItemAnswer(), initialValues)
}

const generateUserAnswerForCheckbox = (quizItemId: string): OldQuizItemAnswer => {
  return generateQuizItemAnswer({
    quizItemId,
    intData: 1,
  })
}

const generateUserAnswerForClosedEnded = (quizItemId: string): OldQuizItemAnswer => {
  return generateQuizItemAnswer({
    quizItemId,
    textData: "answer for closed ended question.",
  })
}

const generateUserAnswerForEssay = (quizItemId: string): OldQuizItemAnswer => {
  return generateQuizItemAnswer({
    quizItemId,
    textData: "essay answer for the exercise.",
  })
}

const generateUserAnswerForMatrix = (quizItemId: string): OldQuizItemAnswer => {
  return generateQuizItemAnswer({
    quizItemId,
    optionCells: [
      ["0", "0", "0"],
      ["0", "0", "0"],
      ["0", "0", "0"],
    ],
  })
}

const generateUserAnswerForScale = (quizItemId: string): OldQuizItemAnswer => {
  return generateQuizItemAnswer({
    quizItemId,
    optionAnswers: ["0", "1", "2"],
  })
}

const generateUserAnswerForTimeline = (quizItemId: string): OldQuizItemAnswer => {
  return generateQuizItemAnswer({
    quizItemId,
    timelineChoices: [],
  })
}

const generateUserAnswerForMultipleChoice = (quizItemId: string): OldQuizItemAnswer => {
  return generateQuizItemAnswer({
    quizItemId,
    optionAnswers: ["0", "1"],
  })
}

const generateUserAnswerForChooseN = (quizItemId: string): OldQuizItemAnswer => {
  return generateQuizItemAnswer({
    quizItemId,
    optionAnswers: ["0", "1"],
  })
}

const packUserAnswers = (quizAnswers: OldQuizItemAnswer[]) =>
  generateQuizAnswer({ itemAnswers: quizAnswers })

export {
  generateUserAnswerForCheckbox,
  generateUserAnswerForClosedEnded,
  generateUserAnswerForEssay,
  generateUserAnswerForMatrix,
  generateUserAnswerForScale,
  generateUserAnswerForTimeline,
  generateUserAnswerForMultipleChoice,
  generateUserAnswerForChooseN,
  packUserAnswers,
}
