import { vi } from "vitest"
import { fireEvent, render, screen, within } from "@testing-library/react"

import type { UserItemAnswerTimeline } from "../../../../../../types/quizTypes/answer"
import type { PublicSpecQuizItemTimeline } from "../../../../../../types/quizTypes/publicSpec"
import Timeline from "../Timeline"

// Override the global identity i18n mock so interpolation values (e.g. the year) are visible.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options
        ? `${key} ${Object.entries(options)
            .map(([k, v]) => `${k}=${String(v)}`)
            .join(" ")}`
        : key,
    i18n: { changeLanguage: () => Promise.resolve() },
  }),
}))

const baseItem: PublicSpecQuizItemTimeline = {
  type: "timeline",
  id: "timeline-1",
  order: 0,
  timelineItems: [
    { itemId: "item-1984", year: "1984" },
    { itemId: "item-1991", year: "1991" },
  ],
  events: [
    { eventId: "event-a", name: "Event A" },
    { eventId: "event-b", name: "Event B" },
  ],
}

const renderTimeline = (answer: UserItemAnswerTimeline | null = null) => {
  const setQuizItemAnswerState = vi.fn()
  const utils = render(
    <Timeline
      quizDirection="column"
      quizItem={baseItem}
      quizItemAnswerState={answer}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      user_information={{} as any}
      setQuizItemAnswerState={setQuizItemAnswerState}
    />,
  )
  return { ...utils, setQuizItemAnswerState }
}

describe("Timeline accessibility", () => {
  it("labels each select with its year (WCAG 1.3.1)", () => {
    renderTimeline()
    expect(screen.getByLabelText("1984").tagName).toBe("SELECT")
    expect(screen.getByLabelText("1991").tagName).toBe("SELECT")
  })

  it("stores the choice when an event is selected", () => {
    const { setQuizItemAnswerState } = renderTimeline()
    fireEvent.change(screen.getByLabelText("1984"), { target: { value: "event-a" } })
    expect(setQuizItemAnswerState).toHaveBeenCalledWith(
      expect.objectContaining({
        timelineChoices: [{ timelineItemId: "item-1984", chosenEventId: "event-a" }],
      }),
    )
  })

  it("gives each remove button an accessible name that includes the year (WCAG 1.3.1)", () => {
    renderTimeline({
      type: "timeline",
      quizItemId: "timeline-1",
      valid: false,
      timelineChoices: [
        { timelineItemId: "item-1984", chosenEventId: "event-a" },
        { timelineItemId: "item-1991", chosenEventId: "event-b" },
      ],
    })
    expect(screen.getByRole("button", { name: /year=1984/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /year=1991/ })).toBeInTheDocument()
  })

  it("announces duplicate answers through a persistent live region", () => {
    renderTimeline({
      type: "timeline",
      quizItemId: "timeline-1",
      valid: false,
      timelineChoices: [
        { timelineItemId: "item-1984", chosenEventId: "event-a" },
        { timelineItemId: "item-1991", chosenEventId: "event-a" },
      ],
    })
    const status = screen.getByRole("status")
    expect(status).toHaveAttribute("aria-live", "polite")
    expect(within(status).getByText(/timeline-duplicate-answer-error/)).toBeInTheDocument()
  })

  it("keeps the live region present but empty when there are no duplicates", () => {
    renderTimeline({
      type: "timeline",
      quizItemId: "timeline-1",
      valid: true,
      timelineChoices: [
        { timelineItemId: "item-1984", chosenEventId: "event-a" },
        { timelineItemId: "item-1991", chosenEventId: "event-b" },
      ],
    })
    const status = screen.getByRole("status")
    expect(status).toBeEmptyDOMElement()
  })

  it("removes the chosen answer when the remove button is pressed", () => {
    const { setQuizItemAnswerState } = renderTimeline({
      type: "timeline",
      quizItemId: "timeline-1",
      valid: false,
      timelineChoices: [{ timelineItemId: "item-1984", chosenEventId: "event-a" }],
    })
    fireEvent.click(screen.getByRole("button", { name: /year=1984/ }))
    expect(setQuizItemAnswerState).toHaveBeenCalledWith(
      expect.objectContaining({ timelineChoices: [] }),
    )
  })
})
