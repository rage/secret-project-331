import { render, screen } from "@testing-library/react"
import { vi } from "vitest"

import { AnswerSummary, buildSummary, resolveLine2Label } from "../AnswerSummary"
import type { SummaryInput } from "../AnswerSummary"

vi.mock("../../../ParsedText", () => ({
  __esModule: true,
  default: ({ text, addDotToEnd }: { text: string; addDotToEnd?: boolean }) => (
    <span>{addDotToEnd ? `${text}.` : text}</span>
  ),
}))

const o = (id: string) => ({ id, text: id })
const chosen = (id: string, correct: boolean | null) => ({ ...o(id), correct })

const summarize = (input: Partial<SummaryInput>) =>
  buildSummary({
    chosen: [],
    unselectedCorrect: [],
    incorrect: [],
    line2Label: "also-correct",
    ...input,
  }).map((l) => [l.labelKey, l.options.map((x) => x.id)])

// react-i18next is mocked in src/test/setup.ts, so t() returns the translation key.
describe("resolveLine2Label", () => {
  it("single: also correct when the chosen option was correct, else the correct list", () => {
    expect(resolveLine2Label({ mode: "single", chosenCorrect: 1, totalCorrect: 2 })).toBe(
      "also-correct",
    )
    expect(resolveLine2Label({ mode: "single", chosenCorrect: 0, totalCorrect: 2 })).toBe(
      "correct-options",
    )
  })

  it("multi with a required-option policy always says missed", () => {
    for (const chosenCorrect of [0, 1, 2]) {
      expect(resolveLine2Label({ mode: "multi", chosenCorrect, totalCorrect: 3 })).toBe("missed")
    }
  })

  it("multi, some-correct-none-incorrect: also correct with a correct choice, else correct options", () => {
    const base = { mode: "multi", lenient: true, totalCorrect: 3 } as const
    expect(resolveLine2Label({ ...base, chosenCorrect: 1 })).toBe("also-correct")
    expect(resolveLine2Label({ ...base, chosenCorrect: 0 })).toBe("correct-options")
  })

  it("choose-n: also correct from min(n, totalCorrect) correct choices, else missed", () => {
    const base = { mode: "choose-n", n: 2, totalCorrect: 3 } as const
    expect(resolveLine2Label({ ...base, chosenCorrect: 2 })).toBe("also-correct")
    expect(resolveLine2Label({ ...base, chosenCorrect: 1 })).toBe("missed")
    expect(resolveLine2Label({ ...base, chosenCorrect: 0 })).toBe("missed")
    expect(resolveLine2Label({ mode: "choose-n", n: 3, chosenCorrect: 1, totalCorrect: 1 })).toBe(
      "also-correct",
    )
  })
})

describe("buildSummary", () => {
  it("single, correct chosen: all three lines", () => {
    expect(
      summarize({
        chosen: [chosen("A", true)],
        unselectedCorrect: [o("B")],
        incorrect: [o("C"), o("D")],
      }),
    ).toEqual([
      ["answer-summary-you-chose", ["A"]],
      ["answer-summary-also-correct", ["B"]],
      ["answer-summary-incorrect-options", ["C", "D"]],
    ])
  })

  it("single, correct chosen and no other correct: line 2 is omitted", () => {
    expect(summarize({ chosen: [chosen("A", true)], incorrect: [o("C")] }).map(([k]) => k)).toEqual(
      ["answer-summary-you-chose", "answer-summary-incorrect-options"],
    )
  })

  it("single, wrong chosen: correct options line", () => {
    expect(
      summarize({
        chosen: [chosen("C", false)],
        unselectedCorrect: [o("B")],
        incorrect: [o("C"), o("D")],
        line2Label: "correct-options",
      }),
    ).toEqual([
      ["answer-summary-you-chose", ["C"]],
      ["answer-summary-correct-options", ["B"]],
      ["answer-summary-incorrect-options", ["C", "D"]],
    ])
  })

  it("nothing chosen: line 1 is omitted", () => {
    expect(
      summarize({
        unselectedCorrect: [o("B")],
        incorrect: [o("C")],
        line2Label: "correct-options",
      }).map(([k]) => k),
    ).toEqual(["answer-summary-correct-options", "answer-summary-incorrect-options"])
  })

  it("multi default: missed line", () => {
    expect(
      summarize({
        chosen: [chosen("A", true), chosen("C", false)],
        unselectedCorrect: [o("B")],
        incorrect: [o("C")],
        line2Label: "missed",
      }),
    ).toEqual([
      ["answer-summary-you-chose", ["A", "C"]],
      ["answer-summary-missed", ["B"]],
      ["answer-summary-incorrect-options", ["C"]],
    ])
  })

  it("all chosen correctly with no wrong options: line 1 only", () => {
    expect(summarize({ chosen: [chosen("A", true), chosen("B", true)] })).toEqual([
      ["answer-summary-you-chose", ["A", "B"]],
    ])
  })

  it("no correct options in the key: no line 2, line 3 lists every option", () => {
    expect(summarize({ chosen: [chosen("A", false)], incorrect: [o("A"), o("B")] })).toEqual([
      ["answer-summary-you-chose", ["A"]],
      ["answer-summary-incorrect-options", ["A", "B"]],
    ])
  })

  it("all options correct: no line 3", () => {
    expect(
      summarize({ chosen: [chosen("A", true)], unselectedCorrect: [o("B")] }).map(([k]) => k),
    ).toEqual(["answer-summary-you-chose", "answer-summary-also-correct"])
  })

  it("returns no lines when everything is empty", () => {
    expect(summarize({})).toEqual([])
  })

  it("marks a verdict only where the key says", () => {
    const lines = buildSummary({
      chosen: [chosen("A", true), chosen("X", null)],
      unselectedCorrect: [],
      incorrect: [],
      line2Label: "also-correct",
    })
    expect(lines[0]!.options.map((x) => x.verdict)).toEqual([true, false])
  })
})

describe("AnswerSummary", () => {
  it("renders nothing without lines", () => {
    const { container } = render(<AnswerSummary lines={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders a labelled group with one paragraph per line, separators and closing dots", () => {
    render(
      <AnswerSummary
        lines={buildSummary({
          chosen: [chosen("A", true), chosen("C", false)],
          unselectedCorrect: [o("B"), o("D")],
          incorrect: [{ id: "E", text: "Rich", rich: true }],
          line2Label: "missed",
        })}
      />,
    )
    const group = screen.getByRole("group", { name: "answer-summary" })
    const paragraphs = Array.from(group.querySelectorAll("p")).map((p) => p.textContent)
    expect(paragraphs).toEqual([
      "answer-summary-you-chose A answer-summary-verdict-correctanswer-summary-list-separatorC answer-summary-verdict-incorrect.",
      "answer-summary-missed Banswer-summary-list-separatorD.",
      "answer-summary-incorrect-options Rich.",
    ])
  })

  it("does not double a closing dot and emits no headings", () => {
    render(
      <AnswerSummary
        lines={buildSummary({
          chosen: [],
          unselectedCorrect: [o("Done!")],
          incorrect: [],
          line2Label: "correct-options",
        })}
      />,
    )
    expect(screen.getByText(/Done!/).closest("p")!.textContent).toBe(
      "answer-summary-correct-options Done!",
    )
    expect(screen.queryAllByRole("heading")).toHaveLength(0)
  })

  it("drops a trailing period before the separator and the verdict", () => {
    render(
      <AnswerSummary
        lines={buildSummary({
          chosen: [chosen("Picked.", true)],
          unselectedCorrect: [o("First."), o("Last.")],
          incorrect: [],
          line2Label: "missed",
        })}
      />,
    )
    const group = screen.getByRole("group", { name: "answer-summary" })
    const paragraphs = Array.from(group.querySelectorAll("p")).map((p) => p.textContent)
    expect(paragraphs).toEqual([
      "answer-summary-you-chose Picked answer-summary-verdict-correct.",
      "answer-summary-missed Firstanswer-summary-list-separatorLast.",
    ])
  })
})
