"use client"

import { useQuery } from "@tanstack/react-query"
import { render } from "@testing-library/react"

import { successQuery } from "../../__testHelpers__/queryResultFixtures"
import CourseSubmissionsByDay from "../CourseSubmissionsByDay"

/**
 * Captures the option object handed to echarts and asserts the per-year heatmap series mapping.
 * Does not render a real chart (echarts needs <canvas>, which jsdom can't measure) and can't catch
 * the width-collapse bug — that's guarded by `wrapperCss` in AnimatedQueryFrame.
 */
const mockEchartsOptions = jest.fn()

jest.mock("../../../Echarts", () => ({
  __esModule: true,
  default: (props: { options: unknown }) => {
    mockEchartsOptions(props.options)
    return null
  },
}))

jest.mock("../../../StatsHeader", () => ({ __esModule: true, default: () => null }))
jest.mock("../../../CourseStatsPage", () => ({ __esModule: true, InstructionBox: () => null }))

jest.mock("@/generated/api/@tanstack/react-query.generated", () => ({
  getCourseDailySubmissionCountsOptions: () => ({
    queryKey: ["test-daily-submissions"],
    queryFn: jest.fn(),
  }),
}))

jest.mock("@tanstack/react-query", () => ({
  ...jest.requireActual("@tanstack/react-query"),
  useQuery: jest.fn(),
}))

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

const mockedUseQuery = useQuery as jest.Mock

beforeEach(() => {
  mockEchartsOptions.mockClear()
  mockedUseQuery.mockReset()
})

describe("CourseSubmissionsByDay", () => {
  it("maps daily counts into per-year heatmap series", () => {
    mockedUseQuery.mockReturnValue(
      successQuery([
        { date: "2022-03-02", count: 5 },
        { date: "2022-04-26", count: 3 },
        { date: "2023-01-01", count: 7 },
      ]),
    )

    render(<CourseSubmissionsByDay courseId="course-1" />)

    expect(mockEchartsOptions).toHaveBeenCalled()
    const options = mockEchartsOptions.mock.lastCall?.[0] as {
      series: { type: string; data: [string, number][] }[]
    }
    // Grouped by year -> one heatmap series per year (2022, 2023).
    expect(options.series).toHaveLength(2)
    expect(options.series[0]?.type).toBe("heatmap")
    const allPoints = options.series.flatMap((s) => s.data)
    expect(allPoints).toHaveLength(3)
    expect(allPoints).toEqual(
      expect.arrayContaining([
        ["2022-03-02", 5],
        ["2023-01-01", 7],
      ]),
    )
  })

  it("shows the no-data fallback instead of a chart for an empty result", () => {
    mockedUseQuery.mockReturnValue(successQuery([]))

    render(<CourseSubmissionsByDay courseId="course-1" />)

    expect(mockEchartsOptions).not.toHaveBeenCalled()
  })
})
