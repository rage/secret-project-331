import type {
  AnswerFile,
  ExerciseTaskSubmission,
} from "@/generated/course-material-api/types.generated"

import { reviewerAnswerFields, reviewerDownloadFileName } from "../reviewerAnswer"

const ESSAY: AnswerFile = {
  id: "11111111-0000-4000-8000-000000000000",
  url: "https://files.example/claimed/one?download_claim=first",
  name: "kaisa-virtanen-essay.pdf",
  mime: "application/pdf",
  order_number: 0,
  size_bytes: 12,
}
const SOURCES: AnswerFile = {
  id: "22222222-0000-4000-8000-000000000000",
  url: "https://files.example/claimed/two?download_claim=second",
  name: "kaisa-virtanen-sources.txt",
  mime: "text/plain",
  order_number: 1,
  size_bytes: 34,
}

const submissionWithFiles = (files: AnswerFile[]): ExerciseTaskSubmission => ({
  id: "33333333-0000-4000-8000-000000000000",
  answer_kind: "file",
  created_at: "2026-09-11T00:00:00Z",
  updated_at: "2026-09-11T00:00:00Z",
  exercise_slide_id: "44444444-0000-4000-8000-000000000000",
  exercise_slide_submission_id: "55555555-0000-4000-8000-000000000000",
  exercise_task_id: "66666666-0000-4000-8000-000000000000",
  data_json: { display_names: ["essay", "sources"] },
  data_files: files,
})

describe("reviewerAnswerFields", () => {
  test("numbers the files in the order they were graded, keeping their URLs", () => {
    const fields = reviewerAnswerFields(submissionWithFiles([ESSAY, SOURCES]))

    expect(fields.user_answer_files).toEqual([
      { id: ESSAY.id, url: ESSAY.url, name: "file-1", mime: ESSAY.mime, size_bytes: 12 },
      { id: SOURCES.id, url: SOURCES.url, name: "file-2", mime: SOURCES.mime, size_bytes: 34 },
    ])
  })

  test("leaves an answer without files alone", () => {
    expect(reviewerAnswerFields(null)).toEqual({ user_answer: null })
  })
})

describe("reviewerDownloadFileName", () => {
  test("names a download after the position the reviewer sees it at", () => {
    const files = reviewerAnswerFields(submissionWithFiles([ESSAY, SOURCES])).user_answer_files

    expect(reviewerDownloadFileName(files, SOURCES.url)).toBe("file-2")
  })

  test("falls back to a bare name for a file the answer does not list", () => {
    const files = reviewerAnswerFields(submissionWithFiles([ESSAY])).user_answer_files

    expect(reviewerDownloadFileName(files, "https://files.example/elsewhere")).toBe("file")
    expect(reviewerDownloadFileName(undefined, ESSAY.url)).toBe("file")
  })
})
