"use client"

import { screen } from "@testing-library/react"

import { RelativeTime } from "../src/components/RelativeTime"
import { renderUi } from "./testUtils"

describe("RelativeTime", () => {
  test("renders the placeholder for an absent timestamp", () => {
    renderUi(<RelativeTime at={null} />)
    expect(screen.getByText("—")).toBeInTheDocument()
  })

  test("date mode prints a year with no time of day", () => {
    renderUi(<RelativeTime at="2024-03-05T09:51:00Z" absoluteTime="date" />)
    const text = screen.getByText(/2024/)
    expect(text.textContent).not.toMatch(/:/)
  })

  test("duration mode prints the elapsed span as its largest unit", () => {
    const twentySixDaysAgo = new Date(Date.now() - (26 * 86400 + 3600) * 1000).toISOString()
    renderUi(<RelativeTime at={twentySixDaysAgo} absoluteTime="duration" />)
    expect(screen.getByText("26 d")).toBeInTheDocument()
  })

  test("duration mode combines hours and minutes below a day", () => {
    const threeHoursTwelveMinutesAgo = new Date(
      Date.now() - (3 * 3600 + 12 * 60) * 1000,
    ).toISOString()
    renderUi(<RelativeTime at={threeHoursTwelveMinutesAgo} absoluteTime="duration" />)
    expect(screen.getByText("3 h 12 m")).toBeInTheDocument()
  })

  test("duration mode keeps the full date reachable via title", () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86400 * 1000).toISOString()
    renderUi(<RelativeTime at={twoDaysAgo} absoluteTime="duration" />)
    const element = screen.getByText("2 d")
    expect(element).toHaveAttribute("title")
    expect(element.getAttribute("title")).not.toBe("")
  })
})
