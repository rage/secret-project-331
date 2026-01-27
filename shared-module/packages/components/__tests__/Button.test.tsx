"use client"

import { fireEvent, screen } from "@testing-library/react"

import { Button } from "../src/components/Button"

import { pressEnter, pressSpace, renderUi } from "./testUtils"

type Variant = "primary" | "secondary" | "tertiary"
type Size = "sm" | "md" | "lg"

describe("Button", () => {
  test("renders label and icon", () => {
    renderUi(
      <Button icon={<span data-testid="icon">★</span>} iconPosition="start">
        Save
      </Button>,
    )

    const button = screen.getByRole("button", { name: "Save" })
    expect(button).toBeInTheDocument()
    expect(screen.getByTestId("icon")).toBeInTheDocument()
  })

  test("loading state disables button and exposes accessibility metadata", () => {
    renderUi(
      <Button isLoading loadingLabel="Saving changes">
        Save
      </Button>,
    )

    const button = screen.getByRole("button", { name: "Save" })

    expect(button).toBeDisabled()
    expect(button).toHaveAttribute("aria-busy", "true")
    expect(button).toHaveAttribute("data-disabled-reason", "loading")

    const describedBy = button.getAttribute("aria-describedby")
    expect(typeof describedBy).toBe("string")
    expect(describedBy && describedBy.length > 0).toBe(true)

    const loadingText = screen.getByText("Saving changes")
    const loadingId = loadingText.getAttribute("id")
    expect(typeof loadingId).toBe("string")
    expect(loadingId && describedBy ? describedBy.split(" ").includes(loadingId) : false).toBe(true)
  })

  test("merges user aria-describedby with loading reason", () => {
    renderUi(
      <>
        <div id="hint">Hint</div>
        <Button aria-describedby="hint" isLoading loadingLabel="Saving changes">
          Save
        </Button>
      </>,
    )

    const button = screen.getByRole("button", { name: "Save" })

    const describedBy = button.getAttribute("aria-describedby")
    expect(typeof describedBy).toBe("string")
    expect(describedBy && describedBy.split(" ").includes("hint")).toBe(true)

    const loadingText = screen.getByText("Saving changes")
    const loadingId = loadingText.getAttribute("id")
    expect(typeof loadingId).toBe("string")
    expect(loadingId && describedBy ? describedBy.split(" ").includes(loadingId) : false).toBe(true)
  })

  test("disabled (non-loading) state sets disabled reason correctly", () => {
    renderUi(<Button disabled>Save</Button>)

    const button = screen.getByRole("button", { name: "Save" })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute("data-disabled-reason", "disabled")
    expect(button).not.toHaveAttribute("aria-busy")
  })

  test("fires both onPress and onClick handlers", () => {
    const onPress = jest.fn()
    const onClick = jest.fn()

    renderUi(
      <Button onPress={onPress} onClick={onClick}>
        Save
      </Button>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Save" }))

    expect(onPress).toHaveBeenCalledTimes(1)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  test("keyboard: Enter triggers onPress", () => {
    const onPress = jest.fn()

    renderUi(<Button onPress={onPress}>Save</Button>)

    const button = screen.getByRole("button", { name: "Save" })
    pressEnter(button)

    expect(onPress).toHaveBeenCalledTimes(1)
  })

  test("keyboard: Space triggers onPress", () => {
    const onPress = jest.fn()

    renderUi(<Button onPress={onPress}>Save</Button>)

    const button = screen.getByRole("button", { name: "Save" })
    pressSpace(button)

    expect(onPress).toHaveBeenCalledTimes(1)
  })

  test("data-pressed reflects pointer press state", () => {
    renderUi(<Button>Save</Button>)
    const button = screen.getByRole("button", { name: "Save" })

    expect(button).toHaveAttribute("data-pressed", "false")

    fireEvent.keyDown(button, { key: " " })
    expect(button).toHaveAttribute("data-pressed", "true")

    fireEvent.keyUp(button, { key: " " })
    expect(button).toHaveAttribute("data-pressed", "false")
  })
})

describe("Button variants and sizes", () => {
  const variants: Variant[] = ["primary", "secondary", "tertiary"]
  const sizes: Size[] = ["sm", "md", "lg"]

  test.each(variants)("variant renders without crashing: %s", (variant) => {
    renderUi(
      <Button variant={variant} size="md">
        Label
      </Button>,
    )
    const button = screen.getByRole("button", { name: "Label" })
    expect(button).toBeInTheDocument()
    expect(button.getAttribute("class")).toBeTruthy()
  })

  test.each(sizes)("size renders without crashing: %s", (size) => {
    renderUi(
      <Button variant="primary" size={size}>
        Label
      </Button>,
    )
    const button = screen.getByRole("button", { name: "Label" })
    expect(button).toBeInTheDocument()
    expect(button.getAttribute("class")).toBeTruthy()
  })

  test("icon positions render in the correct order", () => {
    renderUi(
      <>
        <Button icon={<span data-testid="icon-start">★</span>} iconPosition="start">
          Label
        </Button>
        <Button icon={<span data-testid="icon-end">★</span>} iconPosition="end">
          Label
        </Button>
      </>,
    )

    const buttons = screen.getAllByRole("button", { name: "Label" })
    const startIcon = screen.getByTestId("icon-start")
    const endIcon = screen.getByTestId("icon-end")

    expect(buttons[0].firstChild).toContainElement(startIcon)
    expect(buttons[1].firstChild).toContainElement(endIcon)
  })
})
