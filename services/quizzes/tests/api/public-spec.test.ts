import { handlePublicSpec } from "@/server/publicSpec"
import type { SpecRequest } from "@/utils/exerciseServiceApi"

/**
 * @vitest-environment node
 */
import type {
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
  QuizItemOption,
} from "../../types/quizTypes/privateSpec"
import type {
  PublicSpecQuiz,
  PublicSpecQuizItemChooseN,
  PublicSpecQuizItemMultiplechoice,
  PublicSpecQuizItemMultiplechoiceDropdown,
  PublicSpecQuizItemTimeline,
} from "../../types/quizTypes/publicSpec"
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
  ON_MODEL_SOLUTION_CANARIES,
  OPTION_CELLS_CANARY_FOR_TESTS,
} from "./utils/privateSpecGenerator"

const client = testClient(handlePublicSpec)
const PUBLIC_SPEC_ENDPOINT = "/api/public-spec"

/**
 * This function checks that the object does not have the properties in the notAllowedProperties array.
 * T is a type that has the properties in the notAllowedProperties array.
 */
function expectPropertiesHaveBeenRemoved<T>(object: unknown, notAllowedProperties: (keyof T)[]) {
  for (const notAllowedProperty of notAllowedProperties) {
    if (typeof notAllowedProperty === "string") {
      expect(object).not.toHaveProperty(notAllowedProperty)
    } else {
      throw new TypeError("notAllowedProperty must be a string")
    }
  }
}

/**
 * Stringifies the object and checks that no known canary strings are in the output. The public spec
 * carries no feedback at all, so neither after-answer nor on-model-solution canaries may appear, and
 * the acceptance-rule (validity regex) and option-cell canaries must be gone too.
 */
function expectNoCanariesInOutput(object: unknown) {
  const objectAsString = JSON.stringify(object)
  for (const canary of [...AFTER_ANSWER_AND_ACCEPTANCE_CANARIES, ...ON_MODEL_SOLUTION_CANARIES]) {
    expect(objectAsString).not.toContain(canary)
  }
  expect(objectAsString).not.toContain(OPTION_CELLS_CANARY_FOR_TESTS)
}

async function generatePublicSpec(privateSpec: PrivateSpecQuiz): Promise<PublicSpecQuiz> {
  const specRequest: SpecRequest = {
    request_id: "1",
    private_spec: privateSpec,
    upload_url: null,
  }
  const response = await client.post(PUBLIC_SPEC_ENDPOINT).send(specRequest)
  expect(response.status).toBe(200)
  return response.body as PublicSpecQuiz
}

describe("Public spec generation", () => {
  it("Generating with a multiple choice doesn't add illegal properties", async () => {
    const publicSpec = await generatePublicSpec(generatePrivateSpecWithOneMultipleChoiceQuizItem())

    expectPropertiesHaveBeenRemoved<PrivateSpecQuiz>(publicSpec, ["feedbackMessages"])
    for (const quizItem of publicSpec.items) {
      expectPropertiesHaveBeenRemoved<PrivateSpecQuizItemMultiplechoice>(quizItem, [
        "feedbackMessages",
      ])
      for (const option of (quizItem as PublicSpecQuizItemMultiplechoice).options) {
        expectPropertiesHaveBeenRemoved<QuizItemOption>(option, ["correct", "feedbackMessages"])
      }
    }
    expectNoCanariesInOutput(publicSpec)
  })

  it("Generating with a essay doesn't add illegal properties", async () => {
    const publicSpec = await generatePublicSpec(generatePrivateSpecWithOneEssayQuizItem())

    expectPropertiesHaveBeenRemoved<PrivateSpecQuiz>(publicSpec, ["feedbackMessages"])
    for (const quizItem of publicSpec.items) {
      expectPropertiesHaveBeenRemoved<PrivateSpecQuizItemEssay>(quizItem, ["feedbackMessages"])
    }
    expectNoCanariesInOutput(publicSpec)
  })

  it("Generating with a scale doesn't add illegal properties", async () => {
    const publicSpec = await generatePublicSpec(generatePrivateSpecWithOneScaleQuizItem())

    expectPropertiesHaveBeenRemoved<PrivateSpecQuiz>(publicSpec, ["feedbackMessages"])
    for (const quizItem of publicSpec.items) {
      expectPropertiesHaveBeenRemoved<PrivateSpecQuizItemScale>(quizItem, ["feedbackMessages"])
    }
    expectNoCanariesInOutput(publicSpec)
  })

  it("Generating with a checkbox doesn't add illegal properties", async () => {
    const publicSpec = await generatePublicSpec(generatePrivateSpecWithOneCheckboxQuizItem())

    expectPropertiesHaveBeenRemoved<PrivateSpecQuiz>(publicSpec, ["feedbackMessages"])
    for (const quizItem of publicSpec.items) {
      expectPropertiesHaveBeenRemoved<PrivateSpecQuizItemCheckbox>(quizItem, ["feedbackMessages"])
    }
    expectNoCanariesInOutput(publicSpec)
  })

  it("Generating with a closed ended question doesn't add illegal properties", async () => {
    const publicSpec = await generatePublicSpec(
      generatePrivateSpecWithOneClosedEndedQuestionQuizItem(),
    )

    expectPropertiesHaveBeenRemoved<PrivateSpecQuiz>(publicSpec, ["feedbackMessages"])
    for (const quizItem of publicSpec.items) {
      expectPropertiesHaveBeenRemoved<PrivateSpecQuizItemClosedEndedQuestion>(quizItem, [
        "feedbackMessages",
        "gradingStrategy",
      ])
    }
    expectNoCanariesInOutput(publicSpec)
  })

  it("Generating with a matrix doesn't add illegal properties", async () => {
    const publicSpec = await generatePublicSpec(generatePrivateSpecWithOneMatrixQuizItem())

    expectPropertiesHaveBeenRemoved<PrivateSpecQuiz>(publicSpec, ["feedbackMessages"])
    for (const quizItem of publicSpec.items) {
      expectPropertiesHaveBeenRemoved<PrivateSpecQuizItemMatrix>(quizItem, [
        "feedbackMessages",
        "optionCells",
      ])
    }
    expectNoCanariesInOutput(publicSpec)
  })

  it("Generating with a timeline doesn't add illegal properties", async () => {
    const publicSpec = await generatePublicSpec(generatePrivateSpecWithOneTimelineQuizItem())

    expectPropertiesHaveBeenRemoved<PrivateSpecQuiz>(publicSpec, ["feedbackMessages"])
    for (const quizItem of publicSpec.items) {
      expectPropertiesHaveBeenRemoved<PrivateSpecQuizItemTimeline>(quizItem, ["feedbackMessages"])
      for (const timelineItem of (quizItem as PublicSpecQuizItemTimeline).timelineItems) {
        expectPropertiesHaveBeenRemoved<{ correctEventId: string; correctEventName: string }>(
          timelineItem,
          ["correctEventId", "correctEventName"],
        )
      }
    }
    expectNoCanariesInOutput(publicSpec)
  })

  it("Generating with a choose n doesn't add illegal properties", async () => {
    const publicSpec = await generatePublicSpec(generatePrivateSpecWithOneChooseNQuizItem())

    expectPropertiesHaveBeenRemoved<PrivateSpecQuiz>(publicSpec, ["feedbackMessages"])
    for (const quizItem of publicSpec.items) {
      expectPropertiesHaveBeenRemoved<PrivateSpecQuizItemChooseN>(quizItem, ["feedbackMessages"])
      for (const option of (quizItem as PublicSpecQuizItemChooseN).options) {
        expectPropertiesHaveBeenRemoved<QuizItemOption>(option, ["correct", "feedbackMessages"])
      }
    }
    expectNoCanariesInOutput(publicSpec)
  })

  it("Generating with a multiple choice dropdown doesn't add illegal properties", async () => {
    const publicSpec = await generatePublicSpec(
      generatePrivateSpecWithOneMultipleChoiceDropdownQuizItem(),
    )

    expectPropertiesHaveBeenRemoved<PrivateSpecQuiz>(publicSpec, ["feedbackMessages"])
    for (const quizItem of publicSpec.items) {
      expectPropertiesHaveBeenRemoved<PrivateSpecQuizItemMultiplechoiceDropdown>(quizItem, [
        "feedbackMessages",
      ])
      for (const option of (quizItem as PublicSpecQuizItemMultiplechoiceDropdown).options) {
        expectPropertiesHaveBeenRemoved<QuizItemOption>(option, ["correct", "feedbackMessages"])
      }
    }
    expectNoCanariesInOutput(publicSpec)
  })
})
