"use client"

import { render, screen } from "@testing-library/react"
import React from "react"

import NextSectionLink from "../NextSectionLink"

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: React.ComponentProps<"a">) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { title?: string }) =>
      options?.title ? `${key}:${options.title}` : key,
  }),
}))
jest.mock("../../img/arrow.svg", () => () => null)
jest.mock("../../img/backarrow.svg", () => () => null)
jest.mock("../../img/up-arrow.svg", () => () => null)

const base = {
  title: "Next",
  subtitle: "Sub",
  nextTitle: "Runestones",
  url: "/next",
  currentPageRead: false,
  onPageReadChange: async () => {},
  isUpdatingPageReadStatus: false,
}

describe("NextSectionLink", () => {
  test("names the previous page when a title is given", () => {
    render(<NextSectionLink {...base} previous="/prev" previousTitle="Chapter front page" />)
    expect(
      screen.getByRole("link", { name: "previous-page-named:Chapter front page" }),
    ).toHaveAttribute("href", "/prev")
  })

  test("falls back to the generic label", () => {
    render(<NextSectionLink {...base} previous="/prev" />)
    expect(screen.getByRole("link", { name: "previous-page" })).toBeInTheDocument()
  })
})
