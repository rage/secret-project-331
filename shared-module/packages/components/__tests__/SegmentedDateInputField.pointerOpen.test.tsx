"use client"

import "@testing-library/jest-dom"
import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useForm } from "react-hook-form"

import { DateField } from "../src/components/DateField"
import { DateTimeLocalField } from "../src/components/DateTimeLocalField"
import { TimeField } from "../src/components/TimeField"
import "../tests/test-i18n"

type FieldKind = "date" | "datetime" | "time"

interface HarnessProps {
  kind: FieldKind
  isDisabled?: boolean
  isReadOnly?: boolean
}

const defaultValues: Record<FieldKind, string> = {
  date: "2026-10-15",
  datetime: "2026-10-15T22:07",
  time: "22:07",
}

function Harness({ kind, isDisabled, isReadOnly }: HarnessProps) {
  const { control } = useForm<{ value: string }>({
    defaultValues: { value: defaultValues[kind] },
  })
  const common = {
    name: "value" as const,
    control,
    label: "When",
    "data-testid": "field",
    ...(isDisabled === undefined ? {} : { isDisabled }),
    ...(isReadOnly === undefined ? {} : { isReadOnly }),
  }
  return (
    <>
      <button type="button">before</button>
      {kind === "date" ? <DateField {...common} /> : null}
      {kind === "datetime" ? <DateTimeLocalField {...common} /> : null}
      {kind === "time" ? <TimeField {...common} /> : null}
    </>
  )
}

const kinds: FieldKind[] = ["date", "datetime", "time"]

const segments = () => within(screen.getByTestId("field")).getAllByRole("spinbutton")

const firstSegment = (): HTMLElement => {
  const [segment] = segments()
  if (!segment) {
    throw new Error("the field has no segments")
  }
  return segment
}

const controlSurface = (): HTMLElement => {
  const surface = screen.getByTestId("field").closest<HTMLElement>("[data-field-control]")
  if (!surface) {
    throw new Error("the field has no control surface")
  }
  return surface
}

describe.each(kinds)("%s field opens its picker on pointer press", (kind) => {
  test("a click on a segment opens the picker and moves focus into it", async () => {
    const user = userEvent.setup()
    render(<Harness kind={kind} />)

    await user.click(firstSegment())

    const dialog = screen.getByRole("dialog")
    expect(dialog).toContainElement(document.activeElement as HTMLElement)
  })

  // The floating label is `pointer-events: none`, so a click on it lands on the control surface.
  test("a click on the control surface outside the segments opens the picker", async () => {
    const user = userEvent.setup()
    render(<Harness kind={kind} />)

    await user.click(controlSurface())

    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })

  test("keyboard focus does not open the picker, and typing still edits the segments", async () => {
    const user = userEvent.setup()
    render(<Harness kind={kind} />)
    const before = screen.getByTestId("field-value").getAttribute("value")

    await user.click(screen.getByRole("button", { name: "before" }))
    await user.tab()

    expect(firstSegment()).toHaveFocus()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    await user.keyboard("{ArrowUp}")

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.getByTestId("field-value")).not.toHaveValue(before ?? "")
  })

  test("Escape closes the picker and returns focus to the field", async () => {
    const user = userEvent.setup()
    render(<Harness kind={kind} />)
    const segment = firstSegment()

    await user.click(segment)
    await user.keyboard("{Escape}")

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    await waitFor(() => expect(segment).toHaveFocus())
  })

  test("Enter on the trigger still opens the picker", async () => {
    const user = userEvent.setup()
    render(<Harness kind={kind} />)

    act(() => screen.getByTestId("field-trigger").focus())
    await user.keyboard("{Enter}")

    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })

  test("a click on the trigger opens exactly one picker, and a second click closes it", async () => {
    const user = userEvent.setup()
    render(<Harness kind={kind} />)
    const trigger = screen.getByTestId("field-trigger")

    await user.click(trigger)

    expect(screen.getAllByRole("dialog")).toHaveLength(1)

    await user.click(trigger)

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  test.each([{ isDisabled: true }, { isReadOnly: true }])(
    "a click does not open the picker when %o",
    async (state) => {
      const user = userEvent.setup()
      render(<Harness kind={kind} {...state} />)

      await user.click(firstSegment())
      await user.click(controlSurface())

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    },
  )
})

describe("time field picker", () => {
  test("Alt+ArrowDown on a segment opens it", async () => {
    const user = userEvent.setup()
    render(<Harness kind="time" />)

    act(() => firstSegment().focus())
    await user.keyboard("{Alt>}{ArrowDown}{/Alt}")

    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })

  test("a stepper in the picker commits the time", async () => {
    const user = userEvent.setup()
    render(<Harness kind="time" />)

    await user.click(firstSegment())
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Increase hour" }),
    )

    expect(screen.getByTestId("field-value")).toHaveValue("23:07")
  })
})
