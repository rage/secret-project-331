import handler from "../../src/pages/api/public-spec"
import {
  PrivateSpecQuiz,
  PrivateSpecQuizItemCheckbox,
  PrivateSpecQuizItemChooseN,
  PrivateSpecQuizItemClosedEndedQuestion,
  PrivateSpecQuizItemEssay,
  PrivateSpecQuizItemMatrix,
  PrivateSpecQuizItemMultiplechoice,
  PrivateSpecQuizItemMultiplechoiceDropdown,
  PrivateSpecQuizItemScale,
  PrivateSpecQuizItemTimeline,
  PrivateSpecQuizItemTimelineItem,
  QuizItemOption,
} from "../../types/quizTypes/privateSpec"
import {
  PublicSpecQuiz,
  PublicSpecQuizItemChooseN,
  PublicSpecQuizItemMultiplechoice,
  PublicSpecQuizItemMultiplechoiceDropdown,
  PublicSpecQuizItemTimeline,
} from "../../types/quizTypes/publicSpec"

import {
  ADDITIONAL_CORRECTNESS_EXPLANATION_ON_MODEL_SOLUTION_CANARY_FOR_TESTS,
  FAILURE_MESSAGE_CANARY_FOR_TESTS,
  generatePrivateSpecWithOneCheckboxQuizItem,
  generatePrivateSpecWithOneChooseNQuizItem,
  generatePrivateSpecWithOneClosedEndedQuestionQuizItem,
  generatePrivateSpecWithOneEssayQuizItem,
  generatePrivateSpecWithOneMatrixQuizItem,
  generatePrivateSpecWithOneMultipleChoiceDropdownQuizItem,
  generatePrivateSpecWithOneMultipleChoiceQuizItem,
  generatePrivateSpecWithOneScaleQuizItem,
  generatePrivateSpecWithOneTimelineQuizItem,
  MESSAGE_AFTER_SUBMISSION_CANARY_FOR_TESTS,
  MESSAGE_ON_MODEL_SOLUTION_CANARY_FOR_TESTS,
  OPTION_CELLS_CANARY_FOR_TESTS,
  SHARED_OPTION_FEEDBACK_MESSAGE_CANARY_FOR_TESTS,
  SUCCESS_MESSAGE_CANARY_FOR_TESTS,
  VALIDITY_REGEX_CANARY_FOR_TESTS,
} from "./utils/privateSpecGenerator"
import testClient from "./utils/testClient"

import { SpecRequest } from "@/shared-module/common/bindings"

const client = testClient(handler)
const MODEL_SOLUTION_SPEC_ENDPOINT = "/api/public-spec"

/**
 * This function checks that the object does not have the properties in the notAllowedProperties array.
 * T is a type that has the properties in the notAllowedProperties array.
 */
function expectPropertiesHaveBeenRemoved<T>(object: unknown, notAllowedProperties: (keyof T)[]) {
  for (const notAllowedProperty of notAllowedProperties) {
    if (typeof notAllowedProperty === "string") {
      expect(object).not.toHaveProperty(notAllowedProperty)
    } else {
      throw new Error("notAllowedProperty must be a string")
    }
  }
}

/**
 * Stringifies the object and checks that no known canary strings are in the output.
 * Canary strings are special strings for which we know that they should not be in the output.
 * If they somehow end up in the output, we know that something has been leaked.
 */
function expectNoCanariesInOutput(object: unknown) {
  // Additional checking just to be sure. If we see a canary string, we know something has been leaked.
  const objectAsString = JSON.stringify(object)
  expect(objectAsString).not.toContain(MESSAGE_AFTER_SUBMISSION_CANARY_FOR_TESTS)
  expect(objectAsString).not.toContain(
    ADDITIONAL_CORRECTNESS_EXPLANATION_ON_MODEL_SOLUTION_CANARY_FOR_TESTS,
  )
  expect(objectAsString).not.toContain(SUCCESS_MESSAGE_CANARY_FOR_TESTS)
  expect(objectAsString).not.toContain(SHARED_OPTION_FEEDBACK_MESSAGE_CANARY_FOR_TESTS)
  expect(objectAsString).not.toContain(FAILURE_MESSAGE_CANARY_FOR_TESTS)
  expect(objectAsString).not.toContain(VALIDITY_REGEX_CANARY_FOR_TESTS)
  expect(objectAsString).not.toContain(OPTION_CELLS_CANARY_FOR_TESTS)
  expect(objectAsString).not.toContain(MESSAGE_ON_MODEL_SOLUTION_CANARY_FOR_TESTS)
}

describe("Public spec generation", () => {
  it("Generating with a multiple choice doesn't add illegal properties", async () => {
    const privateSpec = generatePrivateSpecWithOneMultipleChoiceQuizItem()
    const specRequest: SpecRequest = {
      request_id: "1",
      private_spec: privateSpec,
      upload_url: null,
    }
    const response = await client.post(MODEL_SOLUTION_SPEC_ENDPOINT).send(specRequest)
    expect(response.status).toEqual(200)
    const publicSpec = response.body as PublicSpecQuiz

    expectPropertiesHaveBeenRemoved<PrivateSpecQuiz>(publicSpec, ["submitMessage"])
    // verify quiz items
    for (const quizItem of publicSpec.items) {
      expectPropertiesHaveBeenRemoved<PrivateSpecQuizItemMultiplechoice>(quizItem, [
        "successMessage",
        "failureMessage",
        "messageOnModelSolution",
        "sharedOptionFeedbackMessage",
      ])
      for (const option of (quizItem as PublicSpecQuizItemMultiplechoice).options) {
        expectPropertiesHaveBeenRemoved<QuizItemOption>(option, [
          "correct",
          "messageAfterSubmissionWhenSelected",
          "additionalCorrectnessExplanationOnModelSolution",
        ])
      }
    }
    expectNoCanariesInOutput(publicSpec)
  })

  it("Generating with a essay doesn't add illegal properties", async () => {
    const privateSpec = generatePrivateSpecWithOneEssayQuizItem()
    const specRequest: SpecRequest = {
      request_id: "1",
      private_spec: privateSpec,
      upload_url: null,
    }
    const response = await client.post(MODEL_SOLUTION_SPEC_ENDPOINT).send(specRequest)
    expect(response.status).toEqual(200)
    const publicSpec = response.body as PublicSpecQuiz

    expectPropertiesHaveBeenRemoved<PrivateSpecQuiz>(publicSpec, ["submitMessage"])
    // verify quiz items
    for (const quizItem of publicSpec.items) {
      expectPropertiesHaveBeenRemoved<PrivateSpecQuizItemEssay>(quizItem, [
        "successMessage",
        "failureMessage",
        "messageOnModelSolution",
      ])
    }
    expectNoCanariesInOutput(publicSpec)
  })

  it("Generating with a scale doesn't add illegal properties", async () => {
    const privateSpec = generatePrivateSpecWithOneScaleQuizItem()
    const specRequest: SpecRequest = {
      request_id: "1",
      private_spec: privateSpec,
      upload_url: null,
    }
    const response = await client.post(MODEL_SOLUTION_SPEC_ENDPOINT).send(specRequest)
    expect(response.status).toEqual(200)
    const publicSpec = response.body as PublicSpecQuiz

    expectPropertiesHaveBeenRemoved<PrivateSpecQuiz>(publicSpec, ["submitMessage"])
    // verify quiz items
    for (const quizItem of publicSpec.items) {
      expectPropertiesHaveBeenRemoved<PrivateSpecQuizItemScale>(quizItem, [
        "successMessage",
        "failureMessage",
        "messageOnModelSolution",
      ])
    }
    expectNoCanariesInOutput(publicSpec)
  })

  it("Generating with a checkbox doesn't add illegal properties", async () => {
    const privateSpec = generatePrivateSpecWithOneCheckboxQuizItem()
    const specRequest: SpecRequest = {
      request_id: "1",
      private_spec: privateSpec,
      upload_url: null,
    }
    const response = await client.post(MODEL_SOLUTION_SPEC_ENDPOINT).send(specRequest)
    expect(response.status).toEqual(200)
    const publicSpec = response.body as PublicSpecQuiz

    expectPropertiesHaveBeenRemoved<PrivateSpecQuiz>(publicSpec, ["submitMessage"])
    // verify quiz items
    for (const quizItem of publicSpec.items) {
      expectPropertiesHaveBeenRemoved<PrivateSpecQuizItemCheckbox>(quizItem, [
        "successMessage",
        "failureMessage",
        "messageOnModelSolution",
      ])
    }
    expectNoCanariesInOutput(publicSpec)
  })

  it("Generating with a closed ended question doesn't add illegal properties", async () => {
    const privateSpec = generatePrivateSpecWithOneClosedEndedQuestionQuizItem()
    const specRequest: SpecRequest = {
      request_id: "1",
      private_spec: privateSpec,
      upload_url: null,
    }
    const response = await client.post(MODEL_SOLUTION_SPEC_ENDPOINT).send(specRequest)
    expect(response.status).toEqual(200)
    const publicSpec = response.body as PublicSpecQuiz

    expectPropertiesHaveBeenRemoved<PrivateSpecQuiz>(publicSpec, ["submitMessage"])
    // verify quiz items
    for (const quizItem of publicSpec.items) {
      expectPropertiesHaveBeenRemoved<PrivateSpecQuizItemClosedEndedQuestion>(quizItem, [
        "successMessage",
        "failureMessage",
        "messageOnModelSolution",
        "validityRegex",
      ])
    }
    expectNoCanariesInOutput(publicSpec)
  })

  it("Generating with a matrix doesn't add illegal properties", async () => {
    const privateSpec = generatePrivateSpecWithOneMatrixQuizItem()
    const specRequest: SpecRequest = {
      request_id: "1",
      private_spec: privateSpec,
      upload_url: null,
    }
    const response = await client.post(MODEL_SOLUTION_SPEC_ENDPOINT).send(specRequest)
    expect(response.status).toEqual(200)
    const publicSpec = response.body as PublicSpecQuiz

    expectPropertiesHaveBeenRemoved<PrivateSpecQuiz>(publicSpec, ["submitMessage"])
    // verify quiz items
    for (const quizItem of publicSpec.items) {
      expectPropertiesHaveBeenRemoved<PrivateSpecQuizItemMatrix>(quizItem, [
        "successMessage",
        "failureMessage",
        "messageOnModelSolution",
        "optionCells",
      ])
    }
    expectNoCanariesInOutput(publicSpec)
  })

  it("Generating with a timeline doesn't add illegal properties", async () => {
    const privateSpec = generatePrivateSpecWithOneTimelineQuizItem()
    const specRequest: SpecRequest = {
      request_id: "1",
      private_spec: privateSpec,
      upload_url: null,
    }
    const response = await client.post(MODEL_SOLUTION_SPEC_ENDPOINT).send(specRequest)
    expect(response.status).toEqual(200)
    const publicSpec = response.body as PublicSpecQuiz

    expectPropertiesHaveBeenRemoved<PrivateSpecQuiz>(publicSpec, ["submitMessage"])
    // verify quiz items
    for (const quizItem of publicSpec.items) {
      expectPropertiesHaveBeenRemoved<PrivateSpecQuizItemTimeline>(quizItem, [
        "successMessage",
        "failureMessage",
        "messageOnModelSolution",
      ])
      for (const timelineItems of (quizItem as PublicSpecQuizItemTimeline).timelineItems) {
        expectPropertiesHaveBeenRemoved<PrivateSpecQuizItemTimelineItem>(timelineItems, [
          "correctEventId",
          "correctEventName",
        ])
      }
    }
    expectNoCanariesInOutput(publicSpec)
  })

  it("Generating with a choose n doesn't add illegal properties", async () => {
    const privateSpec = generatePrivateSpecWithOneChooseNQuizItem()
    const specRequest: SpecRequest = {
      request_id: "1",
      private_spec: privateSpec,
      upload_url: null,
    }
    const response = await client.post(MODEL_SOLUTION_SPEC_ENDPOINT).send(specRequest)
    expect(response.status).toEqual(200)
    const publicSpec = response.body as PublicSpecQuiz

    expectPropertiesHaveBeenRemoved<PrivateSpecQuiz>(publicSpec, ["submitMessage"])
    // verify quiz items
    for (const quizItem of publicSpec.items) {
      expectPropertiesHaveBeenRemoved<PrivateSpecQuizItemChooseN>(quizItem, [
        "successMessage",
        "failureMessage",
        "messageOnModelSolution",
      ])
      for (const option of (quizItem as PublicSpecQuizItemChooseN).options) {
        expectPropertiesHaveBeenRemoved<QuizItemOption>(option, [
          "correct",
          "messageAfterSubmissionWhenSelected",
          "additionalCorrectnessExplanationOnModelSolution",
        ])
      }
    }
    expectNoCanariesInOutput(publicSpec)
  })

  it("Generating with a multiple choice dropdown doesn't add illegal properties", async () => {
    const privateSpec = generatePrivateSpecWithOneMultipleChoiceDropdownQuizItem()
    const specRequest: SpecRequest = {
      request_id: "1",
      private_spec: privateSpec,
      upload_url: null,
    }
    const response = await client.post(MODEL_SOLUTION_SPEC_ENDPOINT).send(specRequest)
    expect(response.status).toEqual(200)
    const publicSpec = response.body as PublicSpecQuiz

    expectPropertiesHaveBeenRemoved<PrivateSpecQuiz>(publicSpec, ["submitMessage"])
    // verify quiz items
    for (const quizItem of publicSpec.items) {
      expectPropertiesHaveBeenRemoved<PrivateSpecQuizItemMultiplechoiceDropdown>(quizItem, [
        "successMessage",
        "failureMessage",
        "messageOnModelSolution",
      ])
      for (const option of (quizItem as PublicSpecQuizItemMultiplechoiceDropdown).options) {
        expectPropertiesHaveBeenRemoved<QuizItemOption>(option, [
          "correct",
          "messageAfterSubmissionWhenSelected",
          "additionalCorrectnessExplanationOnModelSolution",
        ])
      }
    }
    expectNoCanariesInOutput(publicSpec)
  })
})
