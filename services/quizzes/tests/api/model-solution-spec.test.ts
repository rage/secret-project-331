import { handleModelSolution } from "@/server/modelSolution"
import type { SpecRequest } from "@/utils/exerciseServiceApi"

/**
 * @vitest-environment node
 */
import type {
  ModelSolutionQuiz,
  ModelSolutionQuizItemClosedEndedQuestion,
  ModelSolutionQuizItemMultiplechoice,
} from "../../types/quizTypes/modelSolutionSpec"
import type { PrivateSpecQuiz } from "../../types/quizTypes/privateSpec"
import testClient from "./utils/appRouterTestClient"
import {
  AFTER_ANSWER_AND_ACCEPTANCE_CANARIES,
  generatePrivateSpecWithOneClosedEndedQuestionQuizItem,
  generatePrivateSpecWithOneMultipleChoiceQuizItem,
  ITEM_ON_MODEL_SOLUTION_CANARY,
  OPTION_ON_MODEL_SOLUTION_CANARY,
  QUIZ_ON_MODEL_SOLUTION_CANARY,
} from "./utils/privateSpecGenerator"

const client = testClient(handleModelSolution)
const MODEL_SOLUTION_SPEC_ENDPOINT = "/api/model-solution"

async function generateModelSolution(privateSpec: PrivateSpecQuiz): Promise<ModelSolutionQuiz> {
  const specRequest: SpecRequest = {
    request_id: "1",
    private_spec: privateSpec,
    upload_url: null,
  }
  const response = await client.post(MODEL_SOLUTION_SPEC_ENDPOINT).send(specRequest)
  expect(response.status).toBe(200)
  return response.body as ModelSolutionQuiz
}

// The model solution may only carry on-model-solution feedback; after-answer messages and the
// acceptance rule must never reach it.
function expectNoAfterAnswerCanaries(modelSolution: unknown) {
  const asString = JSON.stringify(modelSolution)
  for (const canary of AFTER_ANSWER_AND_ACCEPTANCE_CANARIES) {
    expect(asString).not.toContain(canary)
  }
}

describe("Model solution spec generation", () => {
  it("carries only the on-model-solution messages for a closed ended question", async () => {
    const privateSpec = generatePrivateSpecWithOneClosedEndedQuestionQuizItem()
    const modelSolution = await generateModelSolution(privateSpec)

    const item = modelSolution.items[0] as ModelSolutionQuizItemClosedEndedQuestion
    // The validity regex must never leak.
    // @ts-expect-error: property that should not exist on the model solution
    expect(item.validityRegex).toBeUndefined()
    expect(item.messagesOnModelSolution).toEqual([ITEM_ON_MODEL_SOLUTION_CANARY])
    // Quiz-level model-solution message is projected too.
    expect(modelSolution.messagesOnModelSolution).toEqual([QUIZ_ON_MODEL_SOLUTION_CANARY])
    expectNoAfterAnswerCanaries(modelSolution)
  })

  it("carries option on-model-solution messages for multiple choice", async () => {
    const privateSpec = generatePrivateSpecWithOneMultipleChoiceQuizItem()
    const modelSolution = await generateModelSolution(privateSpec)

    const item = modelSolution.items[0] as ModelSolutionQuizItemMultiplechoice
    expect(item.messagesOnModelSolution).toEqual([ITEM_ON_MODEL_SOLUTION_CANARY])
    for (const option of item.options) {
      expect(option.messagesOnModelSolution).toEqual([OPTION_ON_MODEL_SOLUTION_CANARY])
    }
    expect(modelSolution.messagesOnModelSolution).toEqual([QUIZ_ON_MODEL_SOLUTION_CANARY])
    expectNoAfterAnswerCanaries(modelSolution)
  })
})
