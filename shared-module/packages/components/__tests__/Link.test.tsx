"use client"

import { fireEvent, screen } from "@testing-library/react"

import { Link } from "../src/components/Link"

import { pressEnter, renderUi } from "./testUtils"

jest.mock("next/link")

type Variant = "primary" | "secondary" | "tertiary"
type Size = "sm" | "md" | "lg"

describe("Link", () => {
  test("renders a normal anchor link by default", () => {
    renderUi(<Link href="/settings">Settings</Link>)

    const link = screen.getByRole("link", { name: "Settings" })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute("href", "/settings")
  })

  test("styledAsButton renders button-like structure with icon", () => {
    renderUi(
      <Link
        href="/checkout"
        styledAsButton
        icon={<span data-testid="icon">→</span>}
        iconPosition="end"
      >
        Continue
      </Link>,
    )

    const link = screen.getByRole("link", { name: "Continue" })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute("href", "/checkout")
    expect(screen.getByTestId("icon")).toBeInTheDocument()
  })

  test("loading state sets aria-busy, disabled reason, and preserves tab focus", () => {
    renderUi(
      <Link href="/billing" styledAsButton isLoading loadingLabel="Loading billing page">
        Billing
      </Link>,
    )

    const link = screen.getByRole("link", { name: "Billing" })

    expect(link).toHaveAttribute("aria-busy", "true")
    expect(link).toHaveAttribute("data-disabled-reason", "loading")
    expect(link).toHaveAttribute("tabindex", "0")

    const describedBy = link.getAttribute("aria-describedby")
    expect(typeof describedBy).toBe("string")
    expect(describedBy && describedBy.length > 0).toBe(true)

    const loadingText = screen.getByText("Loading billing page")
    const loadingId = loadingText.getAttribute("id")
    expect(typeof loadingId).toBe("string")
    expect(loadingId && describedBy ? describedBy.split(" ").includes(loadingId) : false).toBe(true)
  })

  test("merges user aria-describedby with loading reason", () => {
    renderUi(
      <>
        <div id="hint">Hint</div>
        <Link
          href="/billing"
          styledAsButton
          aria-describedby="hint"
          isLoading
          loadingLabel="Loading billing page"
        >
          Billing
        </Link>
      </>,
    )

    const link = screen.getByRole("link", { name: "Billing" })

    const describedBy = link.getAttribute("aria-describedby")
    expect(typeof describedBy).toBe("string")
    expect(describedBy && describedBy.split(" ").includes("hint")).toBe(true)

    const loadingText = screen.getByText("Loading billing page")
    const loadingId = loadingText.getAttribute("id")
    expect(typeof loadingId).toBe("string")
    expect(loadingId && describedBy ? describedBy.split(" ").includes(loadingId) : false).toBe(true)
  })

  test("disabled link sets aria-disabled and prevents onPress", () => {
    const onPress = jest.fn()

    renderUi(
      <Link href="/settings" isDisabled onPress={onPress}>
        Settings
      </Link>,
    )

    const link = screen.getByRole("link", { name: "Settings" })

    expect(link).toHaveAttribute("aria-disabled", "true")
    expect(link).toHaveAttribute("data-disabled-reason", "disabled")
    expect(link).toHaveAttribute("tabindex", "0")

    fireEvent.click(link)
    expect(onPress).toHaveBeenCalledTimes(0)
  })

  test("enabled link fires onPress on click", () => {
    const onPress = jest.fn()

    renderUi(
      <Link href="/settings" onPress={onPress}>
        Settings
      </Link>,
    )

    fireEvent.click(screen.getByRole("link", { name: "Settings" }))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  test("keyboard: Enter triggers onPress (enabled link)", () => {
    const onPress = jest.fn()

    renderUi(
      <Link href="/settings" onPress={onPress}>
        Settings
      </Link>,
    )

    const link = screen.getByRole("link", { name: "Settings" })
    pressEnter(link)

    expect(onPress).toHaveBeenCalledTimes(1)
  })

  test("keyboard: Enter does not trigger onPress when disabled", () => {
    const onPress = jest.fn()

    renderUi(
      <Link href="/settings" isDisabled onPress={onPress}>
        Settings
      </Link>,
    )

    const link = screen.getByRole("link", { name: "Settings" })
    pressEnter(link)

    expect(onPress).toHaveBeenCalledTimes(0)
  })

  test("data-pressed toggles during pointer press when styledAsButton", () => {
    renderUi(
      <Link href="/checkout" styledAsButton>
        Continue
      </Link>,
    )

    const link = screen.getByRole("link", { name: "Continue" })

    expect(link).toHaveAttribute("data-pressed", "false")

    fireEvent.keyDown(link, { key: "Enter" })
    expect(link).toHaveAttribute("data-pressed", "true")

    fireEvent.keyUp(link, { key: "Enter" })
    expect(link).toHaveAttribute("data-pressed", "false")
  })
})

describe("Link variants and sizes", () => {
  const variants: Variant[] = ["primary", "secondary", "tertiary"]
  const sizes: Size[] = ["sm", "md", "lg"]

  test("plain link does not receive button styles", () => {
    renderUi(<Link href="/settings">Settings</Link>)
    const link = screen.getByRole("link", { name: "Settings" })
    expect(link).toBeInTheDocument()
    expect(link.getAttribute("class")).toBeNull()
  })

  test.each(variants)("styledAsButton variant renders with styles: %s", (variant) => {
    renderUi(
      <Link href="/x" styledAsButton variant={variant} size="md">
        Go
      </Link>,
    )
    const link = screen.getByRole("link", { name: "Go" })
    expect(link).toBeInTheDocument()
    expect(link.getAttribute("class")).toBeTruthy()
  })

  test.each(sizes)("styledAsButton size renders with styles: %s", (size) => {
    renderUi(
      <Link href="/x" styledAsButton variant="primary" size={size}>
        Go
      </Link>,
    )
    const link = screen.getByRole("link", { name: "Go" })
    expect(link).toBeInTheDocument()
    expect(link.getAttribute("class")).toBeTruthy()
  })
})
