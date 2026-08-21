import { describe, expect, it } from "vitest"

import type { RepositoryExercise } from "@/util/exerciseServiceApi"
import type { AnswerExerciseState, PrivateSpec, PublicSpec } from "@/util/stateInterfaces"

import { currentStateMessage } from "./useIframeProtocol"

const REPOSITORY_EXERCISE: RepositoryExercise = {
  id: "e48717c3-fd7d-41e9-a2e5-36ce06fcd943",
  repository_id: "4d24291f-dd61-43cc-83e2-4707a7278425",
  part: "part01",
  name: "ex01",
  repository_url: "https://github.com/testmycode/tmc-testcourse",
  checksum: [1, 2, 3, 4],
  download_url: "http://files.example/template.tar.zst",
}

const PRIVATE_SPEC: PrivateSpec = { type: "browser", repository_exercise: REPOSITORY_EXERCISE }

const PUBLIC_SPEC: PublicSpec = {
  type: "browser",
  archive_name: "part01-ex01.tar.zst",
  stub_download_url: "http://files.example/stub.tar.zst",
  student_file_paths: [],
  checksum: "abc",
}

const answerState = (uploadedArchiveId: string | null): AnswerExerciseState => ({
  view_type: "answer-exercise",
  public_spec: PUBLIC_SPEC,
  editor_files: [{ filepath: "src/main.py", contents: "print(1)" }],
  uploaded_archive_id: uploadedArchiveId,
  previous_submission: null,
})

describe("currentStateMessage", () => {
  it("reports an answer as the single archive it consists of, with no data of its own", () => {
    expect(currentStateMessage(answerState("6b1c1f5e-08a1-4d0e-9f2b-3b6dd2f1c001"))).toEqual({
      message: "current-state",
      data: null,
      files: ["6b1c1f5e-08a1-4d0e-9f2b-3b6dd2f1c001"],
      valid: true,
    })
  })

  // Nothing to submit until the edited files have been packed and stored.
  it("reports an answer with no uploaded archive as invalid", () => {
    expect(currentStateMessage(answerState(null))).toEqual({
      message: "current-state",
      data: null,
      valid: false,
    })
  })

  it("reports the exercise editor's private spec", () => {
    expect(
      currentStateMessage({
        view_type: "exercise-editor",
        exercise_task_id: "8a0a5d4c-5f0f-4d0e-9f2b-3b6dd2f1c002",
        repository_exercises: null,
        private_spec: PRIVATE_SPEC,
      }),
    ).toEqual({ message: "current-state", data: { private_spec: PRIVATE_SPEC }, valid: true })
  })

  it("reports nothing for an exercise editor without a private spec", () => {
    expect(
      currentStateMessage({
        view_type: "exercise-editor",
        exercise_task_id: "8a0a5d4c-5f0f-4d0e-9f2b-3b6dd2f1c002",
        repository_exercises: null,
        private_spec: null,
      }),
    ).toBeNull()
  })

  it("reports nothing while viewing a submission, which is not an answer being written", () => {
    expect(
      currentStateMessage({
        view_type: "view-submission",
        exercise_task_id: "8a0a5d4c-5f0f-4d0e-9f2b-3b6dd2f1c002",
        grading: null,
        submitted_files: [],
        submitted_archive_url: null,
        public_spec: PUBLIC_SPEC,
        model_solution_spec: null,
      }),
    ).toBeNull()
  })
})
