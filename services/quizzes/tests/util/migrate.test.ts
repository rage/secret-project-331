/* eslint-disable i18next/no-literal-string */

import { migrateQuiz } from "../../src/util/migrate"

describe("private spec migration", () => {
  test("migrates success and failure messages from old quizzes", () => {
    const quiz = {
      ...OLD_QUIZ_SNAPSHOT,
      items: OLD_QUIZ_SNAPSHOT.items.map((x) => ({
        ...x,
        options: x.options.map((y) => ({ ...y })),
      })),
    }
    const migrated = migrateQuiz(quiz)
    expect(
      migrated.items[0].options.find((x) => x.order === 0)?.messageAfterSubmissionWhenSelected,
    ).toBe("This is a success message for correct option that should be migrated.")
    expect(
      migrated.items[0].options.find((x) => x.order === 1)?.messageAfterSubmissionWhenSelected,
    ).toBe("This is failure message for incorrect option that should be migrated.")
  })

  test("removes old success and failure messages from spec", () => {
    const quiz = {
      ...OLD_QUIZ_SNAPSHOT,
      items: OLD_QUIZ_SNAPSHOT.items.map((x) => ({
        ...x,
        options: x.options.map((y) => ({ ...y })),
      })),
    }
    const migrated = migrateQuiz(quiz)
    expect(migrated.items[0].options.length).toBe(2)
    migrated.items[0].options.forEach((x) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((x as any).successMessage).toBeUndefined()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((x as any).failureMessage).toBeUndefined()
    })
  })

  test("doesn't overwrite migrated field", () => {
    const quiz = {
      ...OLD_QUIZ_SNAPSHOT,
      items: OLD_QUIZ_SNAPSHOT.items.map((x) => ({
        ...x,
        options: x.options.map((y) => ({
          ...y,
          // This field should retain if defined
          messageAfterSubmissionWhenSelected: "Already migrated value",
        })),
      })),
    }
    const migrated = migrateQuiz(quiz)
    expect(migrated.items[0].options.length).toBe(2)
    migrated.items[0].options.forEach((x) => {
      expect(x.messageAfterSubmissionWhenSelected).toBe("Already migrated value")
    })
  })
})

const OLD_QUIZ_SNAPSHOT = {
  autoConfirm: false,
  autoReject: false,
  awardPointsEvenIfWrong: false,
  body: "",
  courseId: "123cd5a9-c6b6-44f8-8afc-132a0c41dbd0",
  createdAt: new Date(2022, 5, 30),
  deadline: null,
  excludedFromScore: false,
  grantPointsPolicy: "grant_only_when_answer_fully_correct",
  id: "123cd5a9-c6b6-44f8-8afc-132a0c41dbd0",
  open: new Date(2022, 5, 30),
  part: 1,
  points: 1,
  section: 1,
  submitMessage: "Submit message",
  title: "Title of quiz",
  tries: 3,
  triesLimited: true,
  updatedAt: new Date(2022, 5, 30),
  items: [
    {
      allAnswersCorrect: true,
      body: "",
      createdAt: new Date(2022, 5, 30),
      direction: "row",
      failureMessage: "Failure message",
      feedbackDisplayPolicy: "DisplayFeedbackOnAllOptions",
      formatRegex: null,
      id: "123cd5a9-c6b6-44f8-8afc-132a0c41dbd0",
      maxLabel: null,
      maxValue: null,
      maxWords: null,
      minLabel: null,
      minValue: null,
      minWords: null,
      multi: false,
      optionCells: null,
      order: 1,
      quizId: "123cd5a9-c6b6-44f8-8afc-132a0c41dbd0",
      sharedOptionFeedbackMessage: null,
      successMessage: "Success message",
      timelineItems: null,
      title: "",
      type: "multiple-choice",
      updatedAt: new Date(2022, 5, 30),
      usesSharedOptionFeedbackMessage: false,
      validityRegex: null,
      options: [
        {
          body: "",
          correct: true,
          createdAt: new Date(2022, 5, 30),
          id: "123cd5a9-c6b6-44f8-8afc-132a0c41dbd0",
          successMessage: "This is a success message for correct option that should be migrated.",
          failureMessage: "This is a failure message that is no longer wanted.",
          order: 0,
          title: "Correct option",
          updatedAt: new Date(2022, 5, 30),
          quizItemId: "123cd5a9-c6b6-44f8-8afc-132a0c41dbd0",
        },
        {
          body: "",
          correct: false,
          createdAt: new Date(2022, 5, 30),
          id: "123cd5a9-c6b6-44f8-8afc-132a0c41dbd0",
          successMessage: "This is a success message that is no longer wanted",
          failureMessage: "This is failure message for incorrect option that should be migrated.",
          order: 1,
          title: "Incorrect option",
          updatedAt: new Date(2022, 5, 30),
          quizItemId: "123cd5a9-c6b6-44f8-8afc-132a0c41dbd0",
        },
      ],
    },
  ],
}
