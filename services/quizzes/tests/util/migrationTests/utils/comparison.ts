/* eslint-disable i18next/no-literal-string */

import { FlexDirection, sanitizeQuizDirection } from "../../../../src/util/css-sanitization"
import {
  OldModelSolutionQuiz as OldModelSolutionQuiz,
  OldModelSolutionQuizItem as OldModelSolutionQuizItem,
  OldPublicQuiz,
  OldPublicQuizItem,
  OldQuiz,
  OldQuizItemAnswer,
  QuizItem,
} from "../../../../types/oldQuizTypes"
import { UserItemAnswer } from "../../../../types/quizTypes/answer"
import {
  ModelSolutionQuiz,
  ModelSolutionQuizItem,
} from "../../../../types/quizTypes/modelSolutionSpec"
import { PrivateSpecQuiz, PrivateSpecQuizItem } from "../../../../types/quizTypes/privateSpec"
import { PublicSpecQuiz, PublicSpecQuizItem } from "../../../../types/quizTypes/publicSpec"

const QUIZ_VERSION = "2"

/**
 * Check if all fields excluding quiz items match for private spec quiz
 * @param oldQuiz Old private spec quiz
 * @param privateSpecQuiz New private spec quiz
 * @param version Version of the private spec quiz
 */
const expectPrivateSpecMetadataToMatch = (
  oldQuiz: OldQuiz,
  privateSpecQuiz: PrivateSpecQuiz,
  version = QUIZ_VERSION,
) => {
  expect(privateSpecQuiz.title).toEqual(oldQuiz.title)
  expect(privateSpecQuiz.body).toEqual(oldQuiz.body)
  expect(privateSpecQuiz.submitMessage).toEqual(oldQuiz.submitMessage)
  expect(privateSpecQuiz.awardPointsEvenIfWrong).toEqual(oldQuiz.awardPointsEvenIfWrong)
  expect(privateSpecQuiz.grantPointsPolicy).toEqual(oldQuiz.grantPointsPolicy)
  expect(privateSpecQuiz.version).toEqual(version)
}

/**
 * Check if all fields excluding quiz items match for public spec quiz
 * @param oldQuiz Old public spec quiz
 * @param publicSpecQuiz New public spec quiz
 * @param version Version of the public spec quiz
 */
const expectPublicSpecMetadataToMatch = (
  oldQuiz: OldPublicQuiz,
  publicSpecQuiz: PublicSpecQuiz,
  version = QUIZ_VERSION,
) => {
  expect(publicSpecQuiz.title).toEqual(oldQuiz.title)
  expect(publicSpecQuiz.version).toEqual(version)
  expect(publicSpecQuiz.body).toEqual(oldQuiz.body)
}

/**
 * Check if all fields excluding quiz items match for model solution spec quiz
 * @param oldQuiz Old model solution spec quiz
 * @param modelSpecQuiz New model solution spec quiz
 * @param version Version of the model solution spec quiz
 */
const expectModelSolutionSpecMetadataToMatch = (
  oldQuiz: OldModelSolutionQuiz,
  modelSolutionSpecQuiz: ModelSolutionQuiz,
  version = QUIZ_VERSION,
) => {
  expect(modelSolutionSpecQuiz.title).toEqual(oldQuiz.title)
  expect(modelSolutionSpecQuiz.body).toEqual(oldQuiz.body)
  expect(modelSolutionSpecQuiz.submitMessage).toEqual(oldQuiz.submitMessage)
  expect(modelSolutionSpecQuiz.awardPointsEvenIfWrong).toEqual(oldQuiz.awardPointsEvenIfWrong)
  expect(modelSolutionSpecQuiz.grantPointsPolicy).toEqual(oldQuiz.grantPointsPolicy)
  expect(modelSolutionSpecQuiz.version).toEqual(version)
}

/**
 * Compare specified fields from new object to older object. Also check that there isn't
 * any extra fields in the new object.
 *
 * @param fields Fields from new object to older object
 * @param newObject New object, e.g. new quiz item
 * @param oldObject Old object, e.g. older quiz item
 */
const compareFields = <T extends object, S extends object>(
  fields: { [key: string]: string },
  newQuizItem: T,
  oldQuizItem: S,
) => {
  Object.keys(fields).forEach((key) => {
    if (!Object.keys(newQuizItem).includes(key)) {
      throw new Error(
        `field '${key}' does not exist in the newer quiz item: ${JSON.stringify(newQuizItem)}`,
      )
    }
    if (!Object.keys(oldQuizItem).includes(fields[key])) {
      throw new Error(
        `field '${fields[key]}' does not exist in old quiz item: ${JSON.stringify(oldQuizItem)}`,
      )
    }
    if (key === "options") {
      // Fields has been changed in the options of multiple-choice exercises
      return
    } else if (key === "optionDisplayDirection") {
      // direction is changed to optionDisplayDirection with different values.
      const direction = sanitizeQuizDirection(oldQuizItem[fields[key] as keyof S] as FlexDirection)
      expect(direction).toEqual(newQuizItem[key as keyof T])
    } else {
      expect(newQuizItem[key as keyof T]).toEqual(oldQuizItem[fields[key] as keyof S])
    }
  })
}

/**
 * Compare all fields excluding options
 *
 * @param privateSpecQuizItem private spec quiz
 * @param oldQuizItem old quiz item
 */
const comparePrivateSpecQuizItem = (
  privateSpecQuizItem: PrivateSpecQuizItem,
  oldQuizItem: QuizItem,
) => {
  let fields = {}
  switch (privateSpecQuizItem.type) {
    case "checkbox":
      fields = {
        id: "id",
        order: "order",
        title: "title",
        body: "body",
        successMessage: "successMessage",
        failureMessage: "failureMessage",
      }
      break
    case "choose-n":
      fields = {
        id: "id",
        order: "order",
        title: "title",
        body: "body",
        successMessage: "successMessage",
        failureMessage: "failureMessage",
      }
      break
    case "closed-ended-question":
      fields = {
        id: "id",
        order: "order",
        validityRegex: "validityRegex",
        formatRegex: "formatRegex",
        title: "title",
        body: "body",
        successMessage: "successMessage",
        failureMessage: "failureMessage",
      }
      break
    case "essay":
      fields = {
        id: "id",
        order: "order",
        minWords: "minWords",
        maxWords: "maxWords",
        title: "title",
        body: "body",
        successMessage: "successMessage",
        failureMessage: "failureMessage",
      }
      break
    case "matrix":
      fields = {
        id: "id",
        order: "order",
        optionCells: "optionCells",
        successMessage: "successMessage",
        failureMessage: "failureMessage",
      }
      break
    case "multiple-choice":
      fields = {
        shuffleOptions: "shuffleOptions",
        id: "id",
        order: "order",
        allowSelectingMultipleOptions: "multi",
        title: "title",
        body: "body",
        successMessage: "successMessage",
        failureMessage: "failureMessage",
        sharedOptionFeedbackMessage: "sharedOptionFeedbackMessage",
        optionDisplayDirection: "direction",
        multipleChoiceMultipleOptionsGradingPolicy: "multipleChoiceMultipleOptionsGradingPolicy",
      }
      break
    case "multiple-choice-dropdown":
      fields = {
        id: "id",
        order: "order",
        title: "title",
        body: "body",
        successMessage: "successMessage",
        failureMessage: "failureMessage",
      }
      break
    case "scale":
      fields = {
        id: "id",
        order: "order",
        maxValue: "maxValue",
        minValue: "minValue",
        maxLabel: "maxLabel",
        minLabel: "minLabel",
        title: "title",
        body: "body",
        successMessage: "successMessage",
        failureMessage: "failureMessage",
      }
      break
    case "timeline":
      fields = {
        id: "id",
        order: "order",
        successMessage: "successMessage",
        failureMessage: "failureMessage",
      }
      break
  }
  compareFields<PrivateSpecQuizItem, QuizItem>(fields, privateSpecQuizItem, oldQuizItem)
}

const comparePublicSpecQuizItem = (
  publicSpecQuizItem: PublicSpecQuizItem,
  oldQuizItem: OldPublicQuizItem,
) => {
  let fields = {}
  switch (publicSpecQuizItem.type) {
    case "checkbox":
      fields = {
        id: "id",
        order: "order",
        title: "title",
        body: "body",
      }
      break
    case "choose-n":
      fields = {
        id: "id",
        order: "order",
        options: "options",
        title: "title",
        body: "body",
      }
      break
    case "closed-ended-question":
      fields = {
        id: "id",
        order: "order",
        formatRegex: "formatRegex",
        title: "title",
        body: "body",
      }
      break
    case "essay":
      fields = {
        id: "id",
        order: "order",
        minWords: "minWords",
        maxWords: "maxWords",
        title: "title",
        body: "body",
      }
      break
    case "matrix":
      fields = {
        id: "id",
        order: "order",
      }
      break
    case "multiple-choice":
      fields = {
        shuffleOptions: "shuffleOptions",
        id: "id",
        order: "order",
        allowSelectingMultipleOptions: "multi",
        title: "title",
        body: "body",
        optionDisplayDirection: "direction",
        multipleChoiceMultipleOptionsGradingPolicy: "multipleChoiceMultipleOptionsGradingPolicy",
      }
      break
    case "multiple-choice-dropdown":
      fields = {
        id: "id",
        order: "order",
        title: "title",
        body: "body",
      }
      break
    case "scale":
      fields = {
        id: "id",
        order: "order",
        maxValue: "maxValue",
        minValue: "minValue",
        maxLabel: "maxLabel",
        minLabel: "minLabel",
        title: "title",
        body: "body",
      }
      break
    case "timeline":
      fields = {
        id: "id",
        order: "order",
      }
      break
  }
  compareFields<PublicSpecQuizItem, OldPublicQuizItem>(fields, publicSpecQuizItem, oldQuizItem)
}

const compareModelSolutionSpecQuizItem = (
  modelSolutionQuizItem: ModelSolutionQuizItem,
  oldQuizItem: OldModelSolutionQuizItem,
) => {
  let fields = {}
  switch (modelSolutionQuizItem.type) {
    case "checkbox":
      fields = {
        id: "id",
        order: "order",
        title: "title",
        body: "body",
        successMessage: "successMessage",
        failureMessage: "failureMessage",
      }
      break
    case "choose-n":
      fields = {
        id: "id",
        order: "order",
        title: "title",
        body: "body",
        successMessage: "successMessage",
        failureMessage: "failureMessage",
      }
      break
    case "closed-ended-question":
      fields = {
        id: "id",
        order: "order",
        formatRegex: "formatRegex",
        title: "title",
        body: "body",
        successMessage: "successMessage",
        failureMessage: "failureMessage",
      }
      break
    case "essay":
      fields = {
        id: "id",
        order: "order",
        minWords: "minWords",
        maxWords: "maxWords",
        title: "title",
        body: "body",
        successMessage: "successMessage",
        failureMessage: "failureMessage",
      }
      break
    case "matrix":
      fields = {
        id: "id",
        order: "order",
        successMessage: "successMessage",
        failureMessage: "failureMessage",
      }
      break
    case "multiple-choice":
      fields = {
        shuffleOptions: "shuffleOptions",
        id: "id",
        order: "order",
        allowSelectingMultipleOptions: "multi",
        title: "title",
        body: "body",
        successMessage: "successMessage",
        failureMessage: "failureMessage",
        sharedOptionFeedbackMessage: "sharedOptionFeedbackMessage",
        optionDisplayDirection: "direction",
        multipleChoiceMultipleOptionsGradingPolicy: "multipleChoiceMultipleOptionsGradingPolicy",
      }
      break
    case "multiple-choice-dropdown":
      fields = {
        id: "id",
        order: "order",
        title: "title",
        body: "body",
        successMessage: "successMessage",
        failureMessage: "failureMessage",
      }
      break
    case "scale":
      fields = {
        id: "id",
        order: "order",
        maxValue: "maxValue",
        minValue: "minValue",
        maxLabel: "maxLabel",
        minLabel: "minLabel",
        title: "title",
        body: "body",
        successMessage: "successMessage",
        failureMessage: "failureMessage",
      }
      break
    case "timeline":
      fields = {
        id: "id",
        order: "order",
        successMessage: "successMessage",
        failureMessage: "failureMessage",
      }
      break
  }
  compareFields<ModelSolutionQuizItem, OldModelSolutionQuizItem>(
    fields,
    modelSolutionQuizItem,
    oldQuizItem,
  )
}

const compareUserItemAnswer = (
  quizItemAnswer: OldQuizItemAnswer,
  userItemAnswer: UserItemAnswer,
) => {
  let fields = {}

  switch (userItemAnswer.type) {
    case "checkbox":
      fields = {
        id: "id",
        quizItemId: "quizItemId",
        valid: "valid",
        // intData: "checked",  // This is tested manually
      }
      break
    case "choose-n":
      fields = {
        id: "id",
        quizItemId: "quizItemId",
        valid: "valid",
        optionAnswers: "selectedOptionIds",
      }
      break
    case "closed-ended-question":
      fields = {
        id: "id",
        quizItemId: "quizItemId",
        valid: "valid",
        textData: "textData",
      }
      break
    case "essay":
      fields = {
        id: "id",
        quizItemId: "quizItemId",
        valid: "valid",
        textData: "textData",
      }
      break
    case "matrix":
      fields = {
        id: "id",
        quizItemId: "quizItemId",
        valid: "valid",
        optionCells: "matrix",
      }
      break
    case "multiple-choice":
      fields = {
        id: "id",
        quizItemId: "quizItemId",
        valid: "valid",
        optionAnswers: "selectedOptionIds",
      }
      break
    case "multiple-choice-dropdown":
      fields = {
        id: "id",
        quizItemId: "quizItemId",
        valid: "valid",
        optionAnswers: "selectedOptionIds",
      }
      break
    case "scale":
      fields = {
        id: "id",
        quizItemId: "quizItemId",
        valid: "valid",
        intData: "intData",
      }
      break
    case "timeline":
      fields = {
        id: "id",
        quizItemId: "quizItemId",
        valid: "valid",
        timelineChoices: "timelineChoices",
      }
      break
  }

  compareFields<OldQuizItemAnswer, UserItemAnswer>(fields, quizItemAnswer, userItemAnswer)
}

export {
  compareFields,
  comparePrivateSpecQuizItem,
  comparePublicSpecQuizItem,
  compareModelSolutionSpecQuizItem,
  expectModelSolutionSpecMetadataToMatch,
  expectPrivateSpecMetadataToMatch,
  expectPublicSpecMetadataToMatch,
  compareUserItemAnswer,
}
