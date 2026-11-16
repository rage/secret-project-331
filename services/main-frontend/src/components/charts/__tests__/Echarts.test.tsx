"use client"

import { render, screen } from "@testing-library/react"

import Echarts from "../Echarts"

jest.mock("@/shared-module/common/utils/dynamicImport", () => ({
  __esModule: true,
  default: () => (props: { option: { aria?: unknown } }) => (
    <div data-testid="chart" data-aria={JSON.stringify(props.option.aria)} />
  ),
}))

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, o?: { title: string }) => (o ? `${key}:${o.title}` : key),
  }),
}))

describe("Echarts", () => {
  it("enables the ECharts aria summary and names it from the label", () => {
    render(<Echarts options={{}} label="Daily visitors" />)
    const aria = JSON.parse(screen.getByTestId("chart").dataset.aria as string)
    expect(aria.enabled).toBe(true)
    expect(aria.label.general.withoutTitle).toBe("chart-label:Daily visitors")
  })
})
