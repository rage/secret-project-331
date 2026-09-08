"use client"

import "@testing-library/jest-dom"
import { fireEvent, render, screen } from "@testing-library/react"

import RegisterCompletion from "../RegisterCompletion"

// t is mocked in tests/setup-jest.js to return the key verbatim.
const renderPage = () =>
  render(
    <RegisterCompletion
      email="teacher@example.com"
      courseName="Automatic Completions"
      ectsCredits={5}
      registrationFormUrl="/completion-registration/module-1/redirect"
    />,
  )

describe("RegisterCompletion", () => {
  it("names the task first and the course under it, so the page says what it is for", () => {
    renderPage()

    expect(
      screen.getByRole("heading", { level: 1, name: "register-completion" }),
    ).toBeInTheDocument()
    expect(screen.getByText("label-course-with-name")).toBeInTheDocument()
    expect(screen.getByText("label-credits-with-amount")).toBeInTheDocument()
  })

  it("asks the student type as a yes/no choice that is still a radio group", () => {
    renderPage()

    expect(screen.getAllByRole("radio")).toHaveLength(2)
    expect(screen.getByRole("radio", { name: "yes" })).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "no" })).toBeInTheDocument()
  })

  it("holds back the instructions until the student has answered", () => {
    renderPage()

    expect(screen.queryByText("teacher@example.com")).not.toBeInTheDocument()
    expect(
      screen.queryByText("changed-email-since-completing-course-disclosure-title"),
    ).not.toBeInTheDocument()
  })

  it("sends a University of Helsinki student to Sisu", () => {
    renderPage()

    fireEvent.click(screen.getByRole("radio", { name: "yes" }))

    expect(screen.getByText("teacher@example.com")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "go-to-sisu" })).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "to-the-registration-form" })).not.toBeInTheDocument()
  })

  it("sends everyone else to the Open University form", () => {
    renderPage()

    fireEvent.click(screen.getByRole("radio", { name: "no" }))

    expect(screen.getByRole("link", { name: "to-the-registration-form" })).toHaveAttribute(
      "href",
      "/completion-registration/module-1/redirect",
    )
    expect(screen.queryByRole("link", { name: "go-to-sisu" })).not.toBeInTheDocument()
  })

  it("offers the changed-address note once the student has an answer to act on", () => {
    renderPage()

    fireEvent.click(screen.getByRole("radio", { name: "no" }))

    expect(
      screen.getByText("changed-email-since-completing-course-disclosure-title"),
    ).toBeInTheDocument()
  })
})
