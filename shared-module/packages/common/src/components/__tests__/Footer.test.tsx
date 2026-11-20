"use client"

import { render, screen } from "@testing-library/react"
import React from "react"

import Footer from "../Footer"

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }),
}))
jest.mock("../../img/moocfiTextLogo.svg", () => () => null)
jest.mock("../../img/UHBrandLogo.svg", () => () => null)

describe("Footer", () => {
  test("has no h1; the about heading is level 2", () => {
    render(<Footer />)
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull()
    expect(screen.getByRole("heading", { level: 2, name: "about" })).toBeInTheDocument()
  })
})
