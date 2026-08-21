import type { AnswerFileRef } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types"

import { assertNotNullOrUndefined } from "../nullability"
import {
  answerDataToAnswerExerciseFields,
  answerDataToCapturedAnswerFields,
  answerDataToViewSubmissionFields,
} from "../typeMappter"

const FIRST_FILE = {
  id: "11111111-0000-4000-8000-000000000000",
  url: "https://files.example/one",
  name: "one.txt",
  mime: "text/plain",
  size_bytes: 12,
}
const SECOND_FILE = {
  id: "22222222-0000-4000-8000-000000000000",
  url: "https://files.example/two",
  name: "two.txt",
  mime: "text/plain",
  size_bytes: 34,
}

const jsonAnswer = { kind: "json", data: { answer: "hello" } } as const
const fileAnswer = {
  kind: "file" as const,
  files: [FIRST_FILE, SECOND_FILE],
  metadata: { display_names: ["a", "b"] },
}

describe("answerDataToViewSubmissionFields", () => {
  test("a json answer yields its data and no files field", () => {
    const fields = answerDataToViewSubmissionFields(jsonAnswer)
    expect(fields).toEqual({ user_answer: { answer: "hello" } })
    expect("user_answer_files" in fields).toBe(false)
  })

  test("a file answer yields the files and its metadata as the answer", () => {
    expect(answerDataToViewSubmissionFields(fileAnswer)).toEqual({
      user_answer: { display_names: ["a", "b"] },
      user_answer_files: [FIRST_FILE, SECOND_FILE],
    })
  })

  test("keeps the host's file order rather than reordering", () => {
    const fields = answerDataToViewSubmissionFields({
      kind: "file",
      files: [SECOND_FILE, FIRST_FILE],
    })
    expect(fields.user_answer_files?.map((file) => file.id)).toEqual([
      SECOND_FILE.id,
      FIRST_FILE.id,
    ])
  })

  test("a file answer without metadata yields a null answer", () => {
    expect(answerDataToViewSubmissionFields({ kind: "file", files: [FIRST_FILE] })).toEqual({
      user_answer: null,
      user_answer_files: [FIRST_FILE],
    })
  })

  test("a missing answer yields a null answer and no files field", () => {
    expect(answerDataToViewSubmissionFields(null)).toEqual({ user_answer: null })
    expect(answerDataToViewSubmissionFields(undefined)).toEqual({ user_answer: null })
  })

  test("a file stored before sizes were recorded reports no size instead of zero", () => {
    const fields = answerDataToViewSubmissionFields({
      kind: "file",
      files: [{ ...FIRST_FILE, size_bytes: null }],
    })
    const files: AnswerFileRef[] = fields.user_answer_files ?? []
    const file = assertNotNullOrUndefined(files[0])
    expect(file.size_bytes).toBeUndefined()
    expect("size_bytes" in file).toBe(false)
  })
})

describe("answerDataToAnswerExerciseFields", () => {
  test("a json answer yields its data and no files field", () => {
    const fields = answerDataToAnswerExerciseFields(jsonAnswer)
    expect(fields).toEqual({ previous_submission: { answer: "hello" } })
    expect("previous_submission_files" in fields).toBe(false)
  })

  test("a file answer yields the files and its metadata as the answer", () => {
    expect(answerDataToAnswerExerciseFields(fileAnswer)).toEqual({
      previous_submission: { display_names: ["a", "b"] },
      previous_submission_files: [FIRST_FILE, SECOND_FILE],
    })
  })

  test("a missing answer yields a null answer and no files field", () => {
    expect(answerDataToAnswerExerciseFields(null)).toEqual({ previous_submission: null })
  })
})

describe("answerDataToCapturedAnswerFields", () => {
  test("a json answer yields its data and no files field", () => {
    const fields = answerDataToCapturedAnswerFields(jsonAnswer)
    expect(fields).toEqual({ data: { answer: "hello" } })
    expect("files" in fields).toBe(false)
  })

  test("a file answer yields the host file ids in order", () => {
    expect(answerDataToCapturedAnswerFields(fileAnswer)).toEqual({
      data: { display_names: ["a", "b"] },
      files: [FIRST_FILE.id, SECOND_FILE.id],
    })
  })

  test("a missing answer yields a null answer and no files field", () => {
    expect(answerDataToCapturedAnswerFields(undefined)).toEqual({ data: null })
  })
})
