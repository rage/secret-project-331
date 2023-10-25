import exp from "constants"
import e from "express"

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
  generatePrivateSpecWithOneClosedEndedQuestionQuizItem,
  generatePrivateSpecWithOneMultipleChoiceQuizItem,
} from "./utils/privateSpecGenerator"
import testClient from "./utils/testClient"

const client = testClient(handler)
const MODEL_SOLUTION_SPEC_ENDPOINT = "/api/public-spec"

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

    // Check for illegal properties
    type AllPrivateSpecProperties = keyof PrivateSpecQuiz
    const notAllowedProperties: AllPrivateSpecProperties[] = ["submitMessage"]
    for (const notAllowedProperty of notAllowedProperties) {
      expect(publicSpec).not.toHaveProperty(notAllowedProperty)
    }
    // verify quiz items
    for (const quizItem of publicSpec.items) {
      type AllQuizItemProperties = keyof PrivateSpecQuizItemMultiplechoice
      const notAllowedProperties: AllQuizItemProperties[] = [
        "successMessage",
        "failureMessage",
        "sharedOptionFeedbackMessage",
      ]
      for (const notAllowedProperty of notAllowedProperties) {
        expect(quizItem).not.toHaveProperty(notAllowedProperty)
      }
      for (const option of (quizItem as PublicSpecQuizItemMultiplechoice).options) {
        type AllQuizItemOptionProperties = keyof QuizItemOption
        const notAllowedProperties: AllQuizItemOptionProperties[] = [
          "correct",
          "messageAfterSubmissionWhenSelected",
          "additionalCorrectnessExplanationOnModelSolution",
        ]
        for (const notAllowedProperty of notAllowedProperties) {
          expect(option).not.toHaveProperty(notAllowedProperty)
        }
      }
    }
    // Additional checking just to be sure
    const specAsString = JSON.stringify(publicSpec)
    expect(specAsString).not.toContain("You selected this one")
    expect(specAsString).not.toContain("This spoils the answer")
    expect(specAsString).not.toContain("This might also spoil something")
  })
})
