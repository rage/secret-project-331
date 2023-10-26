import handler from "../../src/pages/api/public-spec"
import { SpecRequest } from "../../src/shared-module/bindings"
import {
  PrivateSpecQuiz,
  PrivateSpecQuizItemMultiplechoice,
  QuizItemOption,
} from "../../types/quizTypes/privateSpec"
import {
  PublicSpecQuiz,
  PublicSpecQuizItemClosedEndedQuestion,
  PublicSpecQuizItemMultiplechoice,
} from "../../types/quizTypes/publicSpec"

import {
  ADDITIONAL_CORRECTNESS_EXPLANATION_ON_MODEL_SOLUTION_CANARY_FOR_TESTS,
  generatePrivateSpecWithOneClosedEndedQuestionQuizItem,
  generatePrivateSpecWithOneMultipleChoiceQuizItem,
  MESSAGE_AFTER_SUBMISSION_CANARY_FOR_TESTS,
  SHARED_OPTION_FEEDBACK_MESSAGE_CANARY_FOR_TESTS,
  SUCCESS_MESSAGE_CANARY_FOR_TESTS,
} from "./utils/privateSpecGenerator"
import testClient from "./utils/testClient"

const client = testClient(handler)
const MODEL_SOLUTION_SPEC_ENDPOINT = "/api/public-spec"

/** This function checks that the object does not have the properties in the notAllowedProperties array.
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

describe("Public spec generation", () => {
  it("Generating with a closed ended question doesn't add illegal properties", async () => {
    const privateSpec = generatePrivateSpecWithOneClosedEndedQuestionQuizItem()
    const specRequest: SpecRequest = {
      request_id: "1",
      private_spec: privateSpec,
      upload_url: null,
    }
    const response = await client.post(MODEL_SOLUTION_SPEC_ENDPOINT).send(specRequest)
    // response should be succesful
    expect(response.status).toEqual(200)
    const publicSpec = response.body as PublicSpecQuiz
    const closedEndedQuestionQuizItemModelSolution = publicSpec
      .items[0] as PublicSpecQuizItemClosedEndedQuestion
    // Make sure we don't accidentally leak the validity regex
    // @ts-expect-error: Checking that a property that should not exist does not exist
    expect(closedEndedQuestionQuizItemModelSolution.validityRegex).toBeUndefined()
  })

  it("Generating with a multiple choice doesn't add illegal properties", async () => {
    const privateSpec = generatePrivateSpecWithOneMultipleChoiceQuizItem()
    const specRequest: SpecRequest = {
      request_id: "1",
      private_spec: privateSpec,
      upload_url: null,
    }
    const response = await client.post(MODEL_SOLUTION_SPEC_ENDPOINT).send(specRequest)
    // response should be succesful
    expect(response.status).toEqual(200)
    const publicSpec = response.body as PublicSpecQuiz

    expectPropertiesHaveBeenRemoved<PrivateSpecQuiz>(publicSpec, ["submitMessage"])
    // verify quiz items
    for (const quizItem of publicSpec.items) {
      expectPropertiesHaveBeenRemoved<PrivateSpecQuizItemMultiplechoice>(quizItem, [
        "successMessage",
        "failureMessage",
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
    // Additional checking just to be sure. If we see a canary string, we know something has been leaked.
    const specAsString = JSON.stringify(publicSpec)
    expect(specAsString).not.toContain(MESSAGE_AFTER_SUBMISSION_CANARY_FOR_TESTS)
    expect(specAsString).not.toContain(
      ADDITIONAL_CORRECTNESS_EXPLANATION_ON_MODEL_SOLUTION_CANARY_FOR_TESTS,
    )
    expect(specAsString).not.toContain(SUCCESS_MESSAGE_CANARY_FOR_TESTS)
    expect(specAsString).not.toContain(SHARED_OPTION_FEEDBACK_MESSAGE_CANARY_FOR_TESTS)
  })
})
