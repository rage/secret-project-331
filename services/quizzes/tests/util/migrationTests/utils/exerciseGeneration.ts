/* eslint-disable i18next/no-literal-string */
import {
  OldModelSolutionQuiz,
  OldModelSolutionQuizItem,
  OldPublicQuiz,
  OldPublicQuizItem,
  OldPublicQuizItemOption,
  OldQuiz,
  OldQuizItemOption,
  OldQuizItemTimelineItem,
  QuizItem,
} from "../../../../types/oldQuizTypes"

// Content for private quiz item

// Private spec quiz
const emptyPrivateQuizItemOption = (): OldQuizItemOption => ({
  id: "v4()",
  title: "",
  body: "",
  order: 0,
  quizItemId: "v4()",
  createdAt: new Date(),
  updatedAt: new Date(),
  correct: false,
  messageAfterSubmissionWhenSelected: "",
  additionalCorrectnessExplanationOnModelSolution: "",
})

const emptyPrivateQuizItem = (): QuizItem => ({
  validityRegex: "",
  id: "v4()",
  allAnswersCorrect: false,
  body: "",
  createdAt: new Date(),
  direction: "column",
  failureMessage: "",
  formatRegex: "",
  maxLabel: "",
  minLabel: "",
  maxWords: 0,
  minValue: 0,
  maxValue: 0,
  minWords: 0,
  multi: false,
  multipleChoiceMultipleOptionsGradingPolicy: "default",
  optionCells: [],
  options: [],
  order: 0,
  quizId: "v4()",
  sharedOptionFeedbackMessage: null,
  shuffleOptions: false,
  successMessage: "",
  timelineItems: [],
  title: "",
  type: "",
  updatedAt: new Date(),
  usesSharedOptionFeedbackMessage: false,
})

const emptyPrivateQuiz = (): OldQuiz => ({
  id: "",
  updatedAt: new Date(),
  createdAt: new Date(),
  courseId: "",
  part: 1,
  section: 1,
  title: "",
  body: "",
  deadline: new Date(),
  direction: "column",
  open: new Date(),
  items: [],
  tries: 10,
  triesLimited: false,
  autoConfirm: false,
  autoReject: false,
  awardPointsEvenIfWrong: false,
  excludedFromScore: false,
  grantPointsPolicy: "grant_only_when_answer_fully_correct",
  points: 0,
  submitMessage: "",
})

// Public spec quiz
const emptyPublicQuiz = (): OldPublicQuiz => ({
  body: "",
  courseId: "",
  deadline: new Date(),
  direction: "column",
  id: "",
  items: [],
  open: new Date(),
  part: 0,
  section: 0,
  title: "",
  tries: 10,
  triesLimited: false,
})

const emptyPublicQuizItem = (): OldPublicQuizItem => ({
  body: "",
  direction: "column",
  formatRegex: "",
  id: "",
  maxLabel: "",
  maxValue: 10,
  maxWords: 0,
  minLabel: "",
  minValue: 0,
  minWords: 0,
  multi: false,
  multipleChoiceMultipleOptionsGradingPolicy: "default",
  options: [],
  order: 0,
  quizId: "",
  shuffleOptions: false,
  timelineItemEvents: [],
  timelineItems: [],
  title: "",
  type: "",
})

const emptyPublicQuizItemOption = (): OldPublicQuizItemOption => ({
  body: "",
  id: "",
  order: 0,
  title: "",
  quizItemId: "",
})

// Model solution spec
const emptyModelSolutionQuiz = (): OldModelSolutionQuiz => ({
  autoConfirm: false,
  autoReject: false,
  awardPointsEvenIfWrong: false,
  body: "",
  courseId: "",
  createdAt: new Date(),
  deadline: new Date(),
  excludedFromScore: false,
  grantPointsPolicy: "grant_only_when_answer_fully_correct",
  id: "",
  items: [],
  open: new Date(),
  part: 0,
  points: 0,
  section: 0,
  submitMessage: "",
  title: "",
  tries: 0,
  triesLimited: false,
  updatedAt: new Date(),
})

const emptyModelSolutionQuizItem = (): OldModelSolutionQuizItem => ({
  allAnswersCorrect: false,
  body: "",
  createdAt: new Date(),
  direction: "column",
  failureMessage: "",
  formatRegex: "",
  id: "",
  maxLabel: "",
  maxValue: 0,
  maxWords: 0,
  minLabel: "",
  minValue: 0,
  minWords: 0,
  multi: false,
  multipleChoiceMultipleOptionsGradingPolicy: "default",
  optionCells: [],
  options: [],
  order: 0,
  quizId: "",
  sharedOptionFeedbackMessage: null,
  shuffleOptions: false,
  successMessage: "",
  timelineItems: [],
  title: "",
  type: "",
  updatedAt: new Date(),
  usesSharedOptionFeedbackMessage: false,
})

// Generate from templates above
// Generate private spec quiz and quiz items
export const generatePrivateQuiz = <T extends Partial<OldQuiz>>(initialValues: T): OldQuiz & T => {
  return Object.assign(emptyPrivateQuiz(), initialValues)
}

export const generatePrivateQuizItem = <T extends Partial<QuizItem>>(
  initialValues: T,
): QuizItem & T => {
  return Object.assign(emptyPrivateQuizItem(), initialValues)
}

export const generatePrivateQuizItemOption = <T extends Partial<OldQuizItemOption>>(
  initialValues: T,
): OldQuizItemOption & T => {
  return Object.assign(emptyPrivateQuizItemOption(), initialValues)
}

// Generate public spec quiz and quiz items
export const generatePublicQuiz = <T extends Partial<OldPublicQuiz>>(
  initialValues: T,
): OldPublicQuiz & T => {
  return Object.assign(emptyPublicQuiz(), initialValues)
}

export const generatePublicQuizItem = <T extends Partial<OldPublicQuizItem>>(
  initialValues: T,
): OldPublicQuizItem & T => {
  return Object.assign(emptyPublicQuizItem(), initialValues)
}

export const generatePublicQuizItemOption = <T extends Partial<OldPublicQuizItemOption>>(
  initialValues: T,
): OldPublicQuizItemOption & T => {
  return Object.assign(emptyPublicQuizItemOption(), initialValues)
}

// Generate model solution spec quiz and quiz item
export const generateModelSolutionQuiz = <T extends Partial<OldModelSolutionQuiz>>(
  initialValues: T,
): OldModelSolutionQuiz & T => {
  return Object.assign(emptyModelSolutionQuiz(), initialValues)
}

export const generateModelSolutionQuizItem = <T extends Partial<OldModelSolutionQuizItem>>(
  initialValues: T,
): OldModelSolutionQuizItem & T => {
  return Object.assign(emptyModelSolutionQuizItem(), initialValues)
}

// MULTIPLE CHOICE EXERCISE GENERATION

// == Generator functions
/**
 * Generate multiple-choice quiz item for older quizzes. First items
 * in the multiple-choice are correct, rest are incorrect.
 *
 * @param correctOptions Number of correct options
 * @param numberOfOptions Number of options
 * @param order Order of the quiz item
 * @returns Private quiz item for multiple choice question
 */
const generateMultipleChoicePrivateSpecQuiz = (
  correctOptions: number,
  numberOfOptions: number,
  order: number,
): QuizItem => {
  const quizOptions: OldQuizItemOption[] = []
  for (let i = 0; i < numberOfOptions; i++) {
    quizOptions.push(
      generatePrivateQuizItemOption({
        quizItemId: "multiple-choice-exercise",
        correct: i < correctOptions,
        title: `option-${i + 1}`,
        id: `option-${i + 1}`,
        order: i + 1,
      }),
    )
  }

  return generatePrivateQuizItem({
    id: "multiple-choice-exercise",
    title: "multiple-choice-quiz-item",
    type: "multiple-choice",
    multi: true,
    options: quizOptions,
    multipleChoiceMultipleOptionsGradingPolicy: "default",
    order,
  })
}

const generateMultipleChoicePublicSpecQuiz = (
  numberOfOptions: number,
  order: number,
): OldPublicQuizItem => {
  const quizOptions: OldPublicQuizItemOption[] = []
  for (let i = 0; i < numberOfOptions; i++) {
    quizOptions.push(
      generatePublicQuizItemOption({
        quizItemId: "multiple-choice-exercise",
        title: `option-${i + 1}`,
        id: `option-${i + 1}`,
        order: i + 1,
      }),
    )
  }

  return generatePublicQuizItem({
    id: "multiple-choice-exercise",
    title: "multiple-choice-quiz-item",
    type: "multiple-choice",
    multi: true,
    options: quizOptions,
    multipleChoiceMultipleOptionsGradingPolicy: "default",
    order,
  })
}

const generateMultipleChoiceModelSolutionSpecQuiz = (
  correctOptions: number,
  numberOfOptions: number,
  order: number,
): OldModelSolutionQuizItem => {
  const quizOptions: OldQuizItemOption[] = []
  for (let i = 0; i < numberOfOptions; i++) {
    quizOptions.push(
      generatePrivateQuizItemOption({
        quizItemId: "multiple-choice-exercise",
        correct: i < correctOptions,
        title: `option-${i + 1}`,
        id: `option-${i + 1}`,
        order: i + 1,
      }),
    )
  }

  return generateModelSolutionQuizItem({
    id: "multiple-choice-exercise",
    title: "multiple-choice-quiz-item",
    type: "multiple-choice",
    multi: true,
    options: quizOptions,
    multipleChoiceMultipleOptionsGradingPolicy: "default",
    order,
  })
}
// CHOOSE N -EXERCISE GENERATION
const generateChooseNForOlderPrivateSpecQuiz = (
  numberOfOptions: number,
  order: number,
): QuizItem => {
  const quizOptions: OldQuizItemOption[] = []
  for (let i = 0; i < numberOfOptions; i++) {
    quizOptions.push(
      generatePrivateQuizItemOption({
        quizItemId: "multiple-choice-exercise",
        correct: true,
        title: `option-${i + 1}`,
        id: `option-${i + 1}`,
        order: i + 1,
      }),
    )
  }

  return generatePrivateQuizItem({
    id: "choose-N-exercise",
    type: "clickable-multiple-choice",
    order,
    body: "choose-N-body",
    title: "choose-N-title",
    failureMessage: "choose-N-failure-message",
    successMessage: "choose-N-success-message",
    options: quizOptions,
  })
}

const generateChooseNForOlderPublicSpecQuiz = (
  numberOfOptions: number,
  order: number,
): OldPublicQuizItem => {
  const quizOptions: OldQuizItemOption[] = []
  for (let i = 0; i < numberOfOptions; i++) {
    quizOptions.push(
      generatePrivateQuizItemOption({
        quizItemId: "multiple-choice-exercise",
        correct: true,
        title: `option-${i + 1}`,
        id: `option-${i + 1}`,
        order: i + 1,
      }),
    )
  }

  return generatePublicQuizItem({
    id: "choose-N-exercise",
    type: "clickable-multiple-choice",
    order,
    body: "choose-N-body",
    title: "choose-N-title",
    failureMessage: "choose-N-failure-message",
    successMessage: "choose-N-success-message",
    options: quizOptions,
  })
}

const generateChooseNForOlderModelSolutionSpecQuiz = (
  numberOfOptions: number,
  order: number,
): OldModelSolutionQuizItem => {
  const quizOptions: OldQuizItemOption[] = []
  for (let i = 0; i < numberOfOptions; i++) {
    quizOptions.push(
      generatePrivateQuizItemOption({
        quizItemId: "multiple-choice-exercise",
        correct: true,
        title: `option-${i + 1}`,
        id: `option-${i + 1}`,
        order: i + 1,
      }),
    )
  }

  return generateModelSolutionQuizItem({
    id: "choose-N-exercise",
    type: "clickable-multiple-choice",
    order,
    body: "choose-N-body",
    title: "choose-N-title",
    failureMessage: "choose-N-failure-message",
    successMessage: "choose-N-success-message",
    options: quizOptions,
  })
}

// CHECKBOX EXERCISE GENERATION
const generateCheckboxForOlderPrivateSpecQuiz = (order: number): QuizItem => {
  return generatePrivateQuizItem({
    id: "checkbox-exercise",
    type: "checkbox",
    order,
    body: "checkbox-body",
    failureMessage: "checkbox-failure-message",
    successMessage: "checkbox-success-message",
    title: "checkbox-title",
  })
}

const generateCheckboxForOlderPublicSpecQuiz = (order: number): OldPublicQuizItem => {
  return generatePublicQuizItem({
    id: "checkbox-exercise",
    type: "checkbox",
    order,
    body: "checkbox-body",
    failureMessage: "checkbox-failure-message",
    successMessage: "checkbox-success-message",
    title: "checkbox-title",
  })
}

const generateCheckboxForOlderModelSolutionSpecQuiz = (order: number): OldModelSolutionQuizItem => {
  return generateModelSolutionQuizItem({
    id: "checkbox-exercise",
    type: "checkbox",
    order,
    body: "checkbox-body",
    failureMessage: "checkbox-failure-message",
    successMessage: "checkbox-success-message",
    title: "checkbox-title",
  })
}
// ESSAY EXERCISE GENERATION
const generateEssayForOlderPrivateSpecQuiz = (order: number): QuizItem => {
  return generatePrivateQuizItem({
    id: "essay-exercise",
    type: "essay",
    order,
    title: "essay-title",
    body: "essay-body",
    failureMessage: "essay-failure-message",
    successMessage: "essay-success-message",
    maxWords: 500,
    minWords: 100,
  })
}

const generateEssayForOlderPublicSpecQuiz = (order: number): OldPublicQuizItem => {
  return generatePublicQuizItem({
    id: "essay-exercise",
    type: "essay",
    order,
    title: "essay-title",
    body: "essay-body",
    failureMessage: "essay-failure-message",
    successMessage: "essay-success-message",
    maxWords: 500,
    minWords: 100,
  })
}

const generateEssayForOlderModelSolutionSpecQuiz = (order: number): OldModelSolutionQuizItem => {
  return generateModelSolutionQuizItem({
    id: "essay-exercise",
    type: "essay",
    order,
    title: "essay-title",
    body: "essay-body",
    failureMessage: "essay-failure-message",
    successMessage: "essay-success-message",
    maxWords: 500,
    minWords: 100,
  })
}

// MATRIX EXERCISE GENERATION
const generateMatrixForOlderPrivateSpecQuiz = (order: number): QuizItem => {
  return generatePrivateQuizItem({
    id: "matrix-exercise",
    type: "matrix",
    order,
    failureMessage: "matrix-failure-message",
    successMessage: "matrix-success-message",
    optionCells: [
      ["1", "0", "0"],
      ["0", "1", "0"],
      ["0", "0", "1"],
    ],
  })
}

const generateMatrixForOlderPublicSpecQuiz = (order: number): OldPublicQuizItem => {
  return generatePublicQuizItem({
    id: "matrix-exercise",
    type: "matrix",
    order,
    failureMessage: "matrix-failure-message",
    successMessage: "matrix-success-message",
    optionCells: [
      ["1", "0", "0"],
      ["0", "1", "0"],
      ["0", "0", "1"],
    ],
  })
}

const generateMatrixForOlderModelSolutionSpecQuiz = (order: number): OldModelSolutionQuizItem => {
  return generateModelSolutionQuizItem({
    id: "matrix-exercise",
    type: "matrix",
    order,
    failureMessage: "matrix-failure-message",
    successMessage: "matrix-success-message",
    optionCells: [
      ["1", "0", "0"],
      ["0", "1", "0"],
      ["0", "0", "1"],
    ],
  })
}
// CLOSED-ENDED QUESTION EXERCISE GENERATION
const generateClosedEndedForOlderPrivateSpecQuiz = (order: number): QuizItem => {
  return generatePrivateQuizItem({
    id: "closed-ended-exercise",
    type: "open",
    order,
    body: "closed-ended-body",
    title: "closed-ended-title",
    formatRegex: "s{5}",
    validityRegex: "answer",
    successMessage: "closed-ended-failure-message",
    failureMessage: "closed-ended-success-message",
  })
}

const generateClosedEndedForOlderPublicSpecQuiz = (order: number): OldPublicQuizItem => {
  return generatePublicQuizItem({
    id: "closed-ended-exercise",
    type: "open",
    order,
    body: "closed-ended-body",
    title: "closed-ended-title",
    formatRegex: "s{5}",
    validityRegex: "answer",
    successMessage: "closed-ended-failure-message",
    failureMessage: "closed-ended-success-message",
  })
}

const generateClosedEndedForOlderModelSolutionSpecQuiz = (
  order: number,
): OldModelSolutionQuizItem => {
  return generateModelSolutionQuizItem({
    id: "closed-ended-exercise",
    type: "open",
    order,
    body: "closed-ended-body",
    title: "closed-ended-title",
    formatRegex: "s{5}",
    validityRegex: "answer",
    successMessage: "closed-ended-failure-message",
    failureMessage: "closed-ended-success-message",
  })
}

// SCALE EXERCISE GENERATION
const generateScaleForOlderPrivateSpecQuiz = (order: number): QuizItem => {
  return generatePrivateQuizItem({
    id: "scale-exercise",
    type: "scale",
    order,
    title: "scale-exercise-title",
    body: "scale-exercise-body",
    failureMessage: "scale-exercise-failure-message",
    successMessage: "scale-exercise-success-message",
    maxLabel: "max",
    minLabel: "min",
    maxValue: 100,
    minValue: 1,
  })
}

const generateScaleForOlderPublicSpecQuiz = (order: number): OldPublicQuizItem => {
  return generatePublicQuizItem({
    id: "scale-exercise",
    type: "scale",
    order,
    title: "scale-exercise-title",
    body: "scale-exercise-body",
    failureMessage: "scale-exercise-failure-message",
    successMessage: "scale-exercise-success-message",
    maxLabel: "max",
    minLabel: "min",
    maxValue: 100,
    minValue: 1,
  })
}

const generateScaleForOlderModelSolutionSpecQuiz = (order: number): OldModelSolutionQuizItem => {
  return generateModelSolutionQuizItem({
    id: "scale-exercise",
    type: "scale",
    order,
    title: "scale-exercise-title",
    body: "scale-exercise-body",
    failureMessage: "scale-exercise-failure-message",
    successMessage: "scale-exercise-success-message",
    maxLabel: "max",
    minLabel: "min",
    maxValue: 100,
    minValue: 1,
  })
}

// TIMELINE EXERCISE GENERATION
const generateTimelineForOlderPrivateSpecQuiz = (order: number): QuizItem => {
  return generatePrivateQuizItem({
    id: "timeline-exercise",
    type: "timeline",
    order,
    failureMessage: "timeline-failure-message",
    successMessage: "timeline-success-message",
    timelineItems: [
      {
        id: "0001",
        year: "2000",
        correctEventName: "event-name-2000",
        correctEventId: "0001",
      } as OldQuizItemTimelineItem,
    ],
  })
}

const generateTimelineForOlderPublicSpecQuiz = (order: number): OldPublicQuizItem => {
  return generatePublicQuizItem({
    id: "timeline-exercise",
    type: "timeline",
    order,
    failureMessage: "timeline-failure-message",
    successMessage: "timeline-success-message",
    timelineItems: [
      {
        id: "0001",
        year: "2000",
        correctEventName: "event-name-2000",
        correctEventId: "0001",
      } as OldQuizItemTimelineItem,
    ],
  })
}

const generateTimelineForOlderModelSolutionSpecQuiz = (order: number): OldModelSolutionQuizItem => {
  return generateModelSolutionQuizItem({
    id: "timeline-exercise",
    type: "timeline",
    order,
    failureMessage: "timeline-failure-message",
    successMessage: "timeline-success-message",
    timelineItems: [
      {
        id: "0001",
        year: "2000",
        correctEventName: "event-name-2000",
        correctEventId: "0001",
      } as OldQuizItemTimelineItem,
    ],
  })
}

// Packing the quiz items into the quiz

const packToPrivateSpecQuiz = (quizItems: QuizItem[]) => generatePrivateQuiz({ items: quizItems })

const packToPublicSpecQuiz = (quizItems: OldPublicQuizItem[]) =>
  generatePublicQuiz({ items: quizItems })

const packToModelSolutionSpecQuiz = (quizItems: OldModelSolutionQuizItem[]) =>
  generateModelSolutionQuiz({ items: quizItems })

export {
  // Checkbox
  generateCheckboxForOlderPrivateSpecQuiz,
  generateCheckboxForOlderPublicSpecQuiz,
  generateCheckboxForOlderModelSolutionSpecQuiz,
  // Closed ended question (Open question in the older version)
  generateClosedEndedForOlderPrivateSpecQuiz,
  generateClosedEndedForOlderPublicSpecQuiz,
  generateClosedEndedForOlderModelSolutionSpecQuiz,
  // Essay
  generateEssayForOlderPrivateSpecQuiz,
  generateEssayForOlderPublicSpecQuiz,
  generateEssayForOlderModelSolutionSpecQuiz,
  // Matrix
  generateMatrixForOlderPrivateSpecQuiz,
  generateMatrixForOlderPublicSpecQuiz,
  generateMatrixForOlderModelSolutionSpecQuiz,
  // Scale
  generateScaleForOlderPrivateSpecQuiz,
  generateScaleForOlderPublicSpecQuiz,
  generateScaleForOlderModelSolutionSpecQuiz,
  // Timeline
  generateTimelineForOlderPrivateSpecQuiz,
  generateTimelineForOlderPublicSpecQuiz,
  generateTimelineForOlderModelSolutionSpecQuiz,
  // Multiple choice
  generateMultipleChoicePrivateSpecQuiz,
  generateMultipleChoicePublicSpecQuiz,
  generateMultipleChoiceModelSolutionSpecQuiz,
  // Choose n (Clickable multiple choice in the older version)
  generateChooseNForOlderPrivateSpecQuiz,
  generateChooseNForOlderPublicSpecQuiz,
  generateChooseNForOlderModelSolutionSpecQuiz,
  // Packing
  packToPrivateSpecQuiz,
  packToPublicSpecQuiz,
  packToModelSolutionSpecQuiz,
}
