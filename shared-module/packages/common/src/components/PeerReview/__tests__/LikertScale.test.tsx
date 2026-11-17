"use client"

import { render, screen } from "@testing-library/react"
import React from "react"

import { baseTheme } from "../../../styles"
import { contrastRatio as contrast } from "../../../utils/color"
import LikertScale from "../LikertScale"

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
jest.mock("../../../img/likert/agree.svg", () => () => null)
jest.mock("../../../img/likert/disagree.svg", () => () => null)
jest.mock("../../../img/likert/neutral.svg", () => () => null)
jest.mock("../../../img/likert/stronglyAgree.svg", () => () => null)
jest.mock("../../../img/likert/stronglyDisagree.svg", () => () => null)

const stops = () => screen.getAllByRole("radio").filter((r) => r.tabIndex === 0)

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

  test("only one radio is a tab stop", () => {
    const { rerender } = render(
      <LikertScale
        question="Q"
        answerRequired={false}
        selectedOption={null}
        setSelectedOption={() => {}}
      />,
    )
    expect(stops()).toHaveLength(1)
    expect(stops()[0]).toBe(screen.getAllByRole("radio")[0])
    rerender(
      <LikertScale
        question="Q"
        answerRequired={false}
        selectedOption={3}
        setSelectedOption={() => {}}
      />,
    )
    expect(stops()).toEqual([screen.getAllByRole("radio")[2]])
  })

  test("unselected focus outline has at least 3:1 contrast on the option background", () => {
    expect(contrast(baseTheme.colors.green[500], "#f9f9f9")).toBeGreaterThanOrEqual(3)
  })
})
