/* eslint-disable i18next/no-literal-string */
import migratePublicSpecQuiz from "../../../src/util/migration/publicSpecQuiz"

import { expectPublicSpecMetadataToMatch } from "./testUtils"
import { comparePublicSpecQuizItem } from "./utils/comparison"
import { generateMultipleChoicePublicSpecQuiz, packToPublicSpecQuiz } from "./utils/generation"

describe("public spec migration of quizzes", () => {
  test("correctly migrates multiple-choice exercises", () => {
    const multipleChoiceItem = generateMultipleChoicePublicSpecQuiz(10, 5, 0)
    const oldPublicQuiz = packToPublicSpecQuiz([multipleChoiceItem])
    const migratedPublicQuiz = migratePublicSpecQuiz(oldPublicQuiz)
    const migratedMultipleChoiceItem = migratedPublicQuiz.items[0]

    expectPublicSpecMetadataToMatch(oldPublicQuiz, migratedPublicQuiz)
    comparePublicSpecQuizItem(migratedMultipleChoiceItem, multipleChoiceItem)
  })
})
