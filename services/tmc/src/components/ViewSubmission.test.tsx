import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import type { ViewSubmissionState } from "@/util/stateInterfaces"

import ModelSolution from "./ModelSolution"
import ViewSubmission from "./ViewSubmission"

const PYTHON = "def sum(a, b):\n    return a + b\n"

function viewSubmissionState(overrides: Partial<ViewSubmissionState> = {}): ViewSubmissionState {
  return {
    view_type: "view-submission",
    exercise_task_id: "task",
    grading: null,
    submitted_files: [
      { filepath: "src/arithfuncs.py", contents: PYTHON },
      { filepath: "test/test_arithfuncs.py", contents: "import unittest\n" },
    ],
    submitted_archive_url: "http://files.example/submission.tar.zst",
    public_spec: {
      type: "editor",
      archive_name: "python3_simple.tar.zst",
      stub_download_url: "http://files.example/stub.tar.zst",
      student_file_paths: ["src/arithfuncs.py"],
      checksum: "abc",
    },
    model_solution_spec: null,
    model_solution_files: [],
    ...overrides,
  }
}

describe("<ViewSubmission />", () => {
  it("shows the student's files preformatted, so indentation survives", () => {
    render(<ViewSubmission state={viewSubmissionState()} />)
    const code = screen.getByText((_, element) => element?.tagName === "CODE")
    expect(code.closest("pre")).not.toBeNull()
    expect(code.textContent).toBe(PYTHON)
    expect(screen.queryByText("test/test_arithfuncs.py")).toBeNull()
  })

  it("shows every file when the spec names no student files", () => {
    const state = viewSubmissionState({
      submitted_files: [
        { filepath: "src/Main.java", contents: "class Main {}\n" },
        { filepath: "notes.txt", contents: "hi\n" },
      ],
    })
    render(
      <ViewSubmission
        state={{ ...state, public_spec: { ...state.public_spec, student_file_paths: [] } }}
      />,
    )
    expect(screen.getByText("src/Main.java")).toBeInTheDocument()
    expect(screen.getByText("notes.txt")).toBeInTheDocument()
  })
})

const GRADING = {
  grading_progress: "FullyGraded" as const,
  score_given: 1,
  score_maximum: 2,
  feedback_text: "The code style check failed, so no points were given",
  feedback_json: {
    status: "TESTS_FAILED",
    testResults: [
      { name: "TestSum.test_adds", successful: true, points: ["1.1"], message: "", exception: [] },
      {
        name: "TestSum.test_negative",
        successful: false,
        points: ["1.2"],
        message: "expected -1",
        exception: ["Traceback line one", "AssertionError"],
      },
    ],
    logs: { stdout: "building…", stderr: "" },
    feedback_key: "style_check_failed",
    validations: {
      strategy: "FAIL",
      validation_errors: {
        "src/Main.java": [{ line: 3, column: 7, message: "Missing semicolon", source_name: "x" }],
      },
    },
  },
}

describe("<ViewSubmission /> grading", () => {
  it("shows each test's result with its message and exception", () => {
    render(<ViewSubmission state={viewSubmissionState({ grading: GRADING })} />)
    expect(screen.getByText(/TestSum.test_adds/)).toBeInTheDocument()
    expect(screen.getByText(/TestSum.test_negative/)).toBeInTheDocument()
    expect(screen.getByText(/expected -1/)).toHaveTextContent("AssertionError")
  })

  it("shows the style check errors, the run logs and the message for the feedback key", () => {
    render(<ViewSubmission state={viewSubmissionState({ grading: GRADING })} />)
    expect(screen.getByText("src/Main.java")).toBeInTheDocument()
    expect(screen.getByText("3:7 Missing semicolon")).toBeInTheDocument()
    expect(screen.getByText(/building…/)).toBeInTheDocument()
    expect(screen.getByText("feedback-style-check-failed")).toBeInTheDocument()
  })

  it("falls back to the English feedback text when the grading has no feedback key", () => {
    render(
      <ViewSubmission
        state={viewSubmissionState({
          grading: { ...GRADING, feedback_text: "Test timed out", feedback_json: null },
        })}
      />,
    )
    expect(screen.getByText("Test timed out")).toBeInTheDocument()
  })

  it("shows nothing extra for an ungraded submission", () => {
    render(<ViewSubmission state={viewSubmissionState()} />)
    expect(screen.queryByText("test-results")).toBeNull()
  })
})

describe("<ModelSolution />", () => {
  it("shows nothing until the solution is revealed", () => {
    const { container } = render(<ModelSolution state={viewSubmissionState()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("shows the revealed solution's student files and a link to its archive", () => {
    const solutionUrl = "http://files.example/solution.tar.zst"
    render(
      <ModelSolution
        state={viewSubmissionState({
          model_solution_spec: { type: "editor", solution_download_url: solutionUrl },
          model_solution_files: [
            { filepath: "src/arithfuncs.py", contents: PYTHON },
            { filepath: "tmc/utils.py", contents: "" },
          ],
        })}
      />,
    )
    expect(screen.getByRole("heading", { name: "model-solution" })).toBeInTheDocument()
    expect(screen.getByText("src/arithfuncs.py")).toBeInTheDocument()
    expect(screen.queryByText("tmc/utils.py")).toBeNull()
    expect(screen.getByRole("link", { name: "download-button" })).toHaveAttribute(
      "href",
      solutionUrl,
    )
  })
})
