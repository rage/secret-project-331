"use client"

import { render, screen } from "@testing-library/react"
import React from "react"

import { baseTheme } from "../../../styles"
import LikertScale from "../LikertScale"

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
jest.mock("../../../img/likert/agree.svg", () => () => null)
jest.mock("../../../img/likert/disagree.svg", () => () => null)
jest.mock("../../../img/likert/neutral.svg", () => () => null)
jest.mock("../../../img/likert/stronglyAgree.svg", () => () => null)
jest.mock("../../../img/likert/stronglyDisagree.svg", () => () => null)

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}

describe("LikertScale", () => {
  test("radiogroup is named by its question", () => {
    render(
      <>
        <LikertScale
          question="First question"
          answerRequired
          selectedOption={null}
          setSelectedOption={() => {}}
        />
        <LikertScale
          question="Second question"
          answerRequired={false}
          selectedOption={null}
          setSelectedOption={() => {}}
        />
      </>,
    )
    expect(screen.getByRole("radiogroup", { name: /^First question/ })).toBeInTheDocument()
    expect(screen.getByRole("radiogroup", { name: "Second question" })).toBeInTheDocument()
  })

  test("unselected focus outline has at least 3:1 contrast on the option background", () => {
    expect(contrast(baseTheme.colors.green[500], "#f9f9f9")).toBeGreaterThanOrEqual(3)
  })
})
