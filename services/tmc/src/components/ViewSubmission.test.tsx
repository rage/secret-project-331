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
