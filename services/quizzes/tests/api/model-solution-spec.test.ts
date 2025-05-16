import handler from "../../src/pages/api/model-solution"
import {
  ModelSolutionQuiz,
  ModelSolutionQuizItemClosedEndedQuestion,
} from "../../types/quizTypes/modelSolutionSpec"

import { generatePrivateSpecWithOneClosedEndedQuestionQuizItem } from "./utils/privateSpecGenerator"
import testClient from "./utils/testClient"

import { SpecRequest } from "@/shared-module/common/bindings"

const client = testClient(handler)
const MODEL_SOLUTION_SPEC_ENDPOINT = "/api/model-solution"

describe("Model solution spec generation", () => {
  it("Generating with a closed ended question doesn't add illegal properties", async () => {
    const privateSpec = generatePrivateSpecWithOneClosedEndedQuestionQuizItem()
    const specRequest: SpecRequest = {
      request_id: "1",
      private_spec: privateSpec,
      upload_url: null,
    }
    const response = await client.post(MODEL_SOLUTION_SPEC_ENDPOINT).send(specRequest)
    // response should be succesful
    expect(response.status).toBe(200)
    const modelSolutionSpec = response.body as ModelSolutionQuiz
    const closedEndedQuestionQuizItemModelSolution = modelSolutionSpec
      .items[0] as ModelSolutionQuizItemClosedEndedQuestion
    // Make sure we don't accidentally leak the validity regex
    // @ts-expect-error: Checking that a property that should not exist does not exist
    expect(closedEndedQuestionQuizItemModelSolution.validityRegex).toBeUndefined()
    // Should contain the message on model solution
    expect(closedEndedQuestionQuizItemModelSolution.messageOnModelSolution).toEqual(
      privateSpec.items[0].messageOnModelSolution,
    )
  })
})
