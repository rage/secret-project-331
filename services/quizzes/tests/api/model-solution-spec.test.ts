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
  generatePrivateSpecWithOneCheckboxQuizItem,
  generatePrivateSpecWithOneChooseNQuizItem,
  generatePrivateSpecWithOneClosedEndedQuestionQuizItem,
  generatePrivateSpecWithOneEssayQuizItem,
  generatePrivateSpecWithOneMatrixQuizItem,
  generatePrivateSpecWithOneMultipleChoiceDropdownQuizItem,
  generatePrivateSpecWithOneMultipleChoiceQuizItem,
  generatePrivateSpecWithOneScaleQuizItem,
  generatePrivateSpecWithOneTimelineQuizItem,
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

// Every item type must project its on-model-solution feedback and drop every after-answer message.
const ALL_ITEM_GENERATORS: [string, () => PrivateSpecQuiz, boolean][] = [
  ["multiple-choice", generatePrivateSpecWithOneMultipleChoiceQuizItem, true],
  ["choose-n", generatePrivateSpecWithOneChooseNQuizItem, true],
  ["multiple-choice-dropdown", generatePrivateSpecWithOneMultipleChoiceDropdownQuizItem, true],
  ["essay", generatePrivateSpecWithOneEssayQuizItem, false],
  ["scale", generatePrivateSpecWithOneScaleQuizItem, false],
  ["checkbox", generatePrivateSpecWithOneCheckboxQuizItem, false],
  ["closed-ended-question", generatePrivateSpecWithOneClosedEndedQuestionQuizItem, false],
  ["matrix", generatePrivateSpecWithOneMatrixQuizItem, false],
  ["timeline", generatePrivateSpecWithOneTimelineQuizItem, false],
]

describe("Model solution on-model-solution presence and after-answer absence for every item type", () => {
  it.each(ALL_ITEM_GENERATORS)(
    "%s carries on-model-solution feedback but no after-answer messages",
    async (_type, generate, hasOptions) => {
      const modelSolution = await generateModelSolution(generate())

      // The quiz-level and item-level on-model-solution feedback is present.
      expect(modelSolution.messagesOnModelSolution).toContain(QUIZ_ON_MODEL_SOLUTION_CANARY)
      const item = modelSolution.items[0] as {
        messagesOnModelSolution: string[]
        options?: { messagesOnModelSolution: string[] }[]
      }
      expect(item.messagesOnModelSolution).toContain(ITEM_ON_MODEL_SOLUTION_CANARY)
      if (hasOptions) {
        for (const option of item.options!) {
          expect(option.messagesOnModelSolution).toContain(OPTION_ON_MODEL_SOLUTION_CANARY)
        }
      }
      // No after-answer / acceptance-rule message may leak into the model solution.
      expectNoAfterAnswerCanaries(modelSolution)
    },
  )
})
