"use client"

import "@testing-library/jest-dom"
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"

import { INCLUDE_THIS_HEADING_IN_HEADINGS_NAVIGATION_CLASS } from "@/shared-module/common/utils/constants"

import { barFillWidth, DONUT, donutFill } from "../chartGeometry"
import ProgressCard, { type ProgressCardProps } from "../ProgressCard"
import type { ProgressMeasure } from "../progressText"

// Resolves the real English strings, so assertions read as the user would.
jest.mock("react-i18next", () => {
  const en: Record<string, string> = jest.requireActual(
    "@/shared-module/common/locales/en/main-frontend.json",
  )
  const t = (key: string, options: Record<string, string | number> = {}) => {
    const count = options.count
    const pluralKey =
      typeof count === "number" ? `${key}_${new Intl.PluralRules("en").select(count)}` : null
    const template = (pluralKey && en[pluralKey]) ?? en[key] ?? key
    return template.replaceAll(/\{\{(\w+)\}\}/g, (_match, name: string) => String(options[name]))
  }
  return {
    useTranslation: () => ({
      t,
      i18n: { language: "en", changeLanguage: () => Promise.resolve() },
    }),
  }
})

const cssText = () =>
  [...document.styleSheets]
    .flatMap((sheet) => [...sheet.cssRules].map((rule) => rule.cssText))
    .join("\n")

const measure = (given: number | null, max: number | null, required: number | null) => ({
  given,
  max,
  required,
})

const moduleCard = (
  points: ProgressMeasure,
  exercises: ProgressMeasure,
  overrides: Partial<Extract<ProgressCardProps, { variant: "module" }>> = {},
) => (
  <ProgressCard
    variant="module"
    headingLevel={3}
    moduleName="Basics"
    requiresExam={false}
    automaticCompletion
    pointsBreakdown={null}
    points={points}
    exercises={exercises}
    {...overrides}
  />
)

const screenshotCase = () => moduleCard(measure(132, 216, 130), measure(53, 72, 61))

const fixtures: [string, React.ReactElement][] = [
  ["screenshot case", screenshotCase()],
  ["both met", moduleCard(measure(200, 216, 130), measure(70, 72, 61))],
  ["both unmet", moduleCard(measure(40, 216, 130), measure(12, 72, 61))],
  ["no requirements", moduleCard(measure(132, 216, null), measure(53, 72, null))],
  ["max 0 and null", moduleCard(measure(0, 0, null), measure(3, null, null))],
  ["fractional points", moduleCard(measure(131.5, 216.5, 131.5), measure(53, 72, 61))],
  ["given above max", moduleCard(measure(230, 216, 130), measure(80, 72, 61))],
  [
    "chapter",
    <ProgressCard
      key="chapter"
      variant="chapter"
      title="Chapter progress"
      headingLevel={3}
      points={measure(18, 30, null)}
      exercises={measure(7, 10, null)}
    />,
  ],
  ["exam, unmet", moduleCard(measure(132, 216, 130), measure(53, 72, 61), { requiresExam: true })],
  [
    "exam, all met",
    moduleCard(measure(200, 216, 130), measure(70, 72, 61), { requiresExam: true }),
  ],
  [
    "manual completion",
    moduleCard(measure(132, 216, null), measure(53, 72, null), { automaticCompletion: false }),
  ],
]

// jsdom has no PointerEvent, so react-aria reads the mouse; it opens tooltips on hover only once a
// press has set the interaction modality to pointer.
const hoverWithPointer = (element: HTMLElement) => {
  fireEvent.mouseDown(document.body)
  fireEvent.mouseUp(document.body)
  fireEvent.mouseEnter(element)
}

// A Tab keypress sets keyboard modality, which is what makes react-aria treat the focus as visible.
const focusWithKeyboard = (element: HTMLElement) => {
  fireEvent.keyDown(document.body, { key: "Tab" })
  act(() => element.focus())
}

describe("progress charts", () => {
  it("names each chart by its heading and keeps the value text short", () => {
    render(screenshotCase())
    const points = screen.getByRole("progressbar", { name: "Points" })
    expect(points).toHaveAttribute("aria-valuetext", "132 of 216 points")
    expect(screen.getByRole("progressbar", { name: "Exercises attempted" })).toHaveAttribute(
      "aria-valuetext",
      "53 of 72 exercises",
    )
  })

  it("states the requirement in the key strip, with a pause instead of a separator glyph", () => {
    const { container } = render(screenshotCase())
    const keys = container.querySelectorAll("p")
    expect(keys[0]).toHaveTextContent("132 / 216 points, Required: 130")
    expect(keys[1]).toHaveTextContent("53 / 72 exercises, Required: 61")
    expect(container).not.toHaveTextContent("·")
  })

  it("clamps aria-valuenow but keeps the real number in the text", () => {
    render(moduleCard(measure(230, 216, 130), measure(80, 72, 61)))
    const points = screen.getByRole("progressbar", { name: "Points" })
    expect(points).toHaveAttribute("aria-valuenow", "216")
    expect(points).toHaveAttribute("aria-valuetext", "230 of 216 points")
  })

  it("draws no tick or requirement text without a threshold", () => {
    const { container } = render(moduleCard(measure(132, 216, null), measure(53, 72, null)))
    expect(screen.queryByText(/Required/)).not.toBeInTheDocument()
    expect(container.querySelector("[data-part=notch]")).toBeNull()
    expect(container.querySelector("[data-part=tick]")).toBeNull()
  })

  it("uses the exam wording for the requirement", () => {
    render(moduleCard(measure(132, 216, 130), measure(53, 72, 61), { requiresExam: true }))
    expect(screen.getByText("Required for exam: 130")).toBeInTheDocument()
    expect(screen.queryByText("Required: 130")).not.toBeInTheDocument()
  })

  it("hides a chart without a positive maximum and still states the value", () => {
    render(moduleCard(measure(0, 0, null), measure(3, null, null)))
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
    expect(screen.getByText("0 points")).toBeInTheDocument()
    expect(screen.getByText("3 exercises")).toBeInTheDocument()
  })

  it("uses singular nouns for a count of one", () => {
    render(moduleCard(measure(1, 1, null), measure(0, 1, null)))
    expect(screen.getByText("1 / 1 point")).toBeInTheDocument()
    expect(screen.getByText("0 / 1 exercise")).toBeInTheDocument()
  })

  it("formats fractional points", () => {
    render(moduleCard(measure(131.5, 216.5, 131.5), measure(53, 72, 61)))
    expect(screen.getByRole("progressbar", { name: "Points" })).toHaveAttribute(
      "aria-valuetext",
      "131.5 of 216.5 points",
    )
  })

  it("isolates numbers from surrounding bidirectional text", () => {
    const { container } = render(screenshotCase())
    expect(container.querySelectorAll("bdi").length).toBeGreaterThanOrEqual(6)
  })

  it.each(fixtures)("renders %s with one tab stop per chart", (_name, card) => {
    const { container } = render(card)
    const charts = screen.queryAllByRole("progressbar")
    expect(container.querySelectorAll("[tabindex='0']")).toHaveLength(charts.length)
  })
})

describe("completion requirements", () => {
  const met = measure(132, 216, 130)
  const unmet = measure(53, 72, 61)
  const none = measure(53, 72, null)

  it("lists one item per threshold, labelled after its number", () => {
    render(moduleCard(met, unmet))
    const items = within(screen.getByRole("list")).getAllByRole("listitem")
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent("130 Points")
    expect(items[1]).toHaveTextContent("61 Exercises attempted")
  })

  it("names its region with the module, so several modules stay distinct", () => {
    render(moduleCard(met, unmet))
    expect(
      screen.getByRole("region", { name: "Completion requirements, Basics" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Completion requirements" })).toBeInTheDocument()
  })

  it("introduces two requirements and one requirement differently", () => {
    const { rerender } = render(moduleCard(met, unmet))
    expect(screen.getByText("Meet all of these to complete the course.")).toBeInTheDocument()
    rerender(moduleCard(met, none))
    expect(screen.getByText("Meet this to complete the course.")).toBeInTheDocument()
    expect(screen.getAllByRole("listitem")).toHaveLength(1)
  })

  it("uses exam headings and intros for exam courses", () => {
    const { rerender } = render(moduleCard(met, unmet, { requiresExam: true }))
    expect(screen.getByRole("region", { name: "Exam requirements, Basics" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Exam requirements" })).toBeInTheDocument()
    expect(screen.getByText("Meet all of these to take the exam.")).toBeInTheDocument()
    rerender(moduleCard(met, none, { requiresExam: true }))
    expect(screen.getByText("Meet this to take the exam.")).toBeInTheDocument()
  })

  it("marks a met item with a hidden check and 'met' text, and an unmet item with neither", () => {
    render(moduleCard(met, unmet))
    const [pointsItem, exercisesItem] = screen.getAllByRole("listitem") as [
      HTMLElement,
      HTMLElement,
    ]
    expect(pointsItem).toHaveTextContent("130 Points, Requirement met")
    expect(exercisesItem).not.toHaveTextContent(/met/i)
    const check = pointsItem.querySelector("svg")
    expect(check).toHaveAttribute("aria-hidden", "true")
    expect(check?.parentElement).toHaveTextContent("Points")
  })

  it("says the exam completes the course while a requirement is unmet, in plain reading order", () => {
    render(moduleCard(met, unmet, { requiresExam: true }))
    const note = screen.getByText("You complete the course by passing the exam.")
    expect(note.closest("[aria-live],[role=status],[role=alert]")).toBeNull()
  })

  it("says the exam can be taken once every requirement is met", () => {
    render(moduleCard(met, measure(70, 72, 61), { requiresExam: true }))
    expect(
      screen.getByText("You can now take the exam. Passing it completes the course."),
    ).toBeInTheDocument()
  })

  it("has no exam wording for other courses", () => {
    render(moduleCard(met, unmet))
    expect(screen.queryByText(/exam/i)).not.toBeInTheDocument()
  })

  it("replaces the list with the teacher note for manual completion", () => {
    render(moduleCard(met, unmet, { automaticCompletion: false }))
    expect(screen.queryByRole("list")).not.toBeInTheDocument()
    expect(screen.getByText("Graded by your teacher")).toBeInTheDocument()
  })

  it("is left out for automatic completion without thresholds or an exam", () => {
    render(moduleCard(none, none))
    expect(screen.queryByRole("region")).not.toBeInTheDocument()
  })

  it("names the exam alone when an exam is the only requirement", () => {
    render(moduleCard(none, none, { requiresExam: true }))
    expect(screen.getByRole("heading", { name: "Exam requirements" })).toBeInTheDocument()
    expect(screen.getByText("You complete the course by passing the exam.")).toBeInTheDocument()
    expect(screen.queryByRole("list")).not.toBeInTheDocument()
  })

  it("treats a threshold of 0 as none", () => {
    const { container } = render(moduleCard(measure(132, 216, 0), measure(53, 72, 0)))
    expect(screen.queryByRole("region")).not.toBeInTheDocument()
    expect(screen.queryByText(/Required/)).not.toBeInTheDocument()
    expect(container.querySelector("[data-part=notch]")).toBeNull()
    expect(container.querySelector("[data-part=tick]")).toBeNull()
  })

  it("lists a threshold above the maximum but draws no marker for it", () => {
    const { container } = render(moduleCard(measure(132, 216, 300), measure(53, 72, 80)))
    expect(screen.getByText("Required: 300")).toBeInTheDocument()
    expect(screen.getByText("Required: 80")).toBeInTheDocument()
    expect(screen.getAllByRole("listitem")).toHaveLength(2)
    expect(container.querySelector("[data-part=notch]")).toBeNull()
    expect(container.querySelector("[data-part=tick]")).toBeNull()
  })

  it("judges a fractional score as the backend does, by its whole points", () => {
    render(moduleCard(measure(129.99, 216, 130), measure(61, 72, 61)))
    const [pointsItem, exercisesItem] = screen.getAllByRole("listitem") as [
      HTMLElement,
      HTMLElement,
    ]
    expect(pointsItem).not.toHaveTextContent(/met/i)
    expect(exercisesItem).toHaveTextContent("Requirement met")
  })

  it("lists the module's first section heading in the heading navigation", () => {
    render(screenshotCase())
    expect(screen.getByRole("heading", { name: "Points" })).toHaveClass(
      INCLUDE_THIS_HEADING_IN_HEADINGS_NAVIGATION_CLASS,
    )
    expect(screen.getByRole("heading", { name: "Exercises attempted" })).not.toHaveClass(
      INCLUDE_THIS_HEADING_IN_HEADINGS_NAVIGATION_CLASS,
    )
  })

  it("is left out of the chapter view", () => {
    render(
      <ProgressCard
        variant="chapter"
        title="Chapter progress"
        headingLevel={3}
        points={met}
        exercises={unmet}
      />,
    )
    expect(screen.getByRole("heading", { level: 2, name: "Chapter progress" })).toHaveClass(
      INCLUDE_THIS_HEADING_IN_HEADINGS_NAVIGATION_CLASS,
    )
    expect(screen.getByRole("heading", { level: 3, name: "Points" })).not.toHaveClass(
      INCLUDE_THIS_HEADING_IN_HEADINGS_NAVIGATION_CLASS,
    )
    expect(screen.queryByRole("list")).not.toBeInTheDocument()
    expect(screen.queryByText(/requirements/i)).not.toBeInTheDocument()
  })
})

const findTooltip = () => screen.findByRole("tooltip")

describe("chart tooltips", () => {
  it("opens on hover with the chart's facts and describes the chart", async () => {
    render(screenshotCase())
    const points = screen.getByRole("progressbar", { name: "Points" })
    hoverWithPointer(points)
    const tooltip = await findTooltip()
    expect(tooltip).toHaveTextContent("Your points: 132")
    expect(tooltip).toHaveTextContent("Required for completion: 130")
    expect(tooltip).toHaveTextContent("Maximum: 216")
    expect(points).toHaveAttribute("aria-describedby", tooltip.id)
  })

  it("opens on keyboard focus of the chart itself", async () => {
    render(screenshotCase())
    const exercises = screen.getByRole("progressbar", { name: "Exercises attempted" })
    focusWithKeyboard(exercises)
    const tooltip = await findTooltip()
    expect(tooltip).toHaveTextContent("Exercises attempted: 53")
    expect(tooltip).toHaveTextContent("Required for completion: 61")
    expect(tooltip).toHaveTextContent("Total: 72")
  })

  it("closes on Escape and keeps focus on the chart", async () => {
    render(screenshotCase())
    const points = screen.getByRole("progressbar", { name: "Points" })
    focusWithKeyboard(points)
    await findTooltip()
    fireEvent.keyDown(points, { key: "Escape" })
    await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull())
    expect(points).toHaveFocus()
  })

  it("uses the exam wording for the requirement", async () => {
    render(moduleCard(measure(132, 216, 130), measure(53, 72, 61), { requiresExam: true }))
    hoverWithPointer(screen.getByRole("progressbar", { name: "Points" }))
    const tooltip = await findTooltip()
    expect(tooltip).toHaveTextContent("Required for exam: 130")
    expect(tooltip).not.toHaveTextContent("Required for completion")
  })

  it("omits the requirement line without a threshold", async () => {
    render(moduleCard(measure(132, 216, null), measure(53, 72, null)))
    hoverWithPointer(screen.getByRole("progressbar", { name: "Points" }))
    expect(await findTooltip()).not.toHaveTextContent(/Required/)
  })

  it("closes after the pointer leaves the chart", async () => {
    render(screenshotCase())
    const points = screen.getByRole("progressbar", { name: "Points" })
    hoverWithPointer(points)
    await findTooltip()
    fireEvent.mouseLeave(points)
    await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull(), { timeout: 2000 })
  })
})

const toUnits = (ratio: number) => ratio * 100

describe("donut fill end near the notch", () => {
  const notchRatio = 130 / 216
  const capRatio = DONUT.capRadius / DONUT.circumference
  const casingRatio = DONUT.casingWidth / 2 / DONUT.circumference
  const gapRatio = DONUT.notchGap / DONUT.circumference

  it("ends flush on the notch when met by less than half a cap", () => {
    for (const given of [130, 131, 132]) {
      const fill = donutFill(given / 216, notchRatio)
      expect(fill?.end).toBe("flush")
      expect(fill?.arcEnd).toBeCloseTo(toUnits(notchRatio), 6)
    }
  })

  it("centres a round cap on the notch when met by up to a cap", () => {
    for (const given of [133, 134]) {
      const fill = donutFill(given / 216, notchRatio)
      expect(fill?.end).toBe("round")
      expect(fill?.arcEnd).toBeCloseTo(toUnits(notchRatio), 6)
    }
  })

  it("stops an unmet fill a clear gap before the casing", () => {
    for (const given of [129, 129.9]) {
      const fill = donutFill(given / 216, notchRatio)
      expect(fill?.end).toBe("round")
      const tip = (fill?.arcEnd ?? 0) + toUnits(capRatio)
      expect(tip).toBeCloseTo(toUnits(notchRatio - casingRatio - gapRatio), 6)
    }
  })

  it("leaves fills away from the notch where they are", () => {
    const fill = donutFill(100 / 216, notchRatio)
    expect(fill?.end).toBe("round")
    expect((fill?.arcEnd ?? 0) + toUnits(capRatio)).toBeCloseTo(toUnits(100 / 216), 6)
  })

  it("never lands between the three states", () => {
    for (let given = 120; given <= 140; given += 0.25) {
      const fill = donutFill(given / 216, notchRatio)
      const tip =
        (fill?.arcEnd ?? 0) + (fill?.end === "round" ? toUnits(capRatio) : 0) - toUnits(notchRatio)
      const isFlush = fill?.end === "flush" && Math.abs(tip) < 1e-9
      const isCapPast = fill?.end === "round" && tip >= toUnits(capRatio) - 1e-9
      const isClearBelow = tip <= -toUnits(casingRatio + gapRatio) + 1e-9
      expect(isFlush || isCapPast || isClearBelow).toBe(true)
    }
  })

  it("closes a full ring without caps", () => {
    const { container } = render(moduleCard(measure(230, 216, 130), measure(53, 72, 61)))
    expect(container.querySelector("[data-part=fill-start-cap]")).toBeNull()
    expect(container.querySelector("[data-part=fill-end-cap]")).toBeNull()
  })

  it("draws no end cap for a flush end", () => {
    const { container } = render(moduleCard(measure(130, 216, 130), measure(53, 72, 61)))
    expect(container.querySelector("[data-part=fill-start-cap]")).not.toBeNull()
    expect(container.querySelector("[data-part=fill-end-cap]")).toBeNull()
  })
})

describe("exercises bar fill near the tick", () => {
  it("centres a met fill's round end on the tick at least, in pixels", () => {
    expect(barFillWidth(61 / 72, 61 / 72)).toMatch(
      /^max\(.*calc\(.*% \+ var\(--bar-height\) \/ 2\)\)$/,
    )
  })

  it("keeps an unmet fill a clear gap before the tick, in pixels", () => {
    expect(barFillWidth(60 / 72, 61 / 72)).toMatch(/^min\(.*calc\(.*% - 6px\)\)$/)
  })

  it("is the plain ratio without a tick", () => {
    expect(barFillWidth(0.5, null)).toBe("50%")
  })
})

describe("right-to-left", () => {
  it("positions the bar tick with a logical offset, so it mirrors with the fill", () => {
    const { container } = render(
      <div dir="rtl">{moduleCard(measure(132, 216, 130), measure(53, 72, 61))}</div>,
    )
    const tick = container.querySelector<HTMLElement>("[data-part=tick]")
    const tickClass = [...(tick?.classList ?? [])].join("|")
    expect(cssText()).toMatch(
      new RegExp(`\\.(${tickClass}) \\{[^}]*inset-inline-start: ${(61 / 72) * 100}%`),
    )
  })

  it("mirrors the donut ring and keeps its label readable", () => {
    const { container } = render(
      <div dir="rtl">{moduleCard(measure(132, 216, 130), measure(53, 72, 61))}</div>,
    )
    const ring = container.querySelector("svg > g")
    const label = container.querySelector("svg text")
    const rtlRule = (element: Element | null) =>
      [...(element?.classList ?? [])].some((name) =>
        new RegExp(`\\.${name}:dir\\(rtl\\) \\{[^}]*transform: scaleX\\(-1\\)`).test(cssText()),
      )
    expect(rtlRule(ring)).toBe(true)
    expect(rtlRule(label)).toBe(true)
  })
})

describe("server rendering", () => {
  it("hydrates every fixture without warnings", () => {
    const errors = jest.spyOn(console, "error").mockImplementation(() => {})
    const markup = (
      <>
        {fixtures.map(([name, card]) => (
          <div key={name}>{card}</div>
        ))}
      </>
    )
    const container = document.createElement("div")
    document.body.append(container)
    container.innerHTML = renderToString(markup)
    let root: ReturnType<typeof hydrateRoot> | undefined
    act(() => {
      root = hydrateRoot(container, markup)
    })
    expect(errors).not.toHaveBeenCalled()
    errors.mockRestore()
    act(() => root?.unmount())
    container.remove()
  })

  it("animates with CSS alone, turned off under reduced motion", () => {
    render(screenshotCase())
    expect(cssText()).toMatch(/@media \(prefers-reduced-motion: reduce\) \{[^}]*animation: none/)
  })
})
