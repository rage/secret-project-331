"use client"

import { useQuery } from "@tanstack/react-query"
import { render } from "@testing-library/react"

import CourseVisitorsByCountry from "../CourseVisitorsByCountry"

/**
 * Lightweight regression guard for the **data dimension** of this chart: it captures the option object
 * the component hands to echarts and asserts the data -> series mapping is non-empty for a healthy
 * query. It does NOT render a real chart (echarts draws to <canvas>, which jsdom can't measure) and it
 * cannot catch the layout/width-collapse class of bug — that one is guarded by the full-width
 * `wrapperCss` contract in AnimatedQueryFrame. This test would fail if a future backend-shape change
 * made the aggregation produce an empty series.
 */
const mockEchartsOptions = jest.fn()

jest.mock("../../../Echarts", () => ({
  __esModule: true,
  default: (props: { options: unknown }) => {
    mockEchartsOptions(props.options)
    return null
  },
}))

// StatsHeader pulls in the DebugModal (Monaco) and CourseStatsPage pulls the whole stats page; neither
// is under test, so stub them to keep this unit light and focused on the chart-option mapping.
jest.mock("../../../StatsHeader", () => ({ __esModule: true, default: () => null }))
jest.mock("../../../CourseStatsPage", () => ({ __esModule: true, InstructionBox: () => null }))

jest.mock("@/generated/api/@tanstack/react-query.generated", () => ({
  getCoursePageVisitDatumSummaryByCountriesOptions: () => ({
    queryKey: ["test-countries"],
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

type CountryRow = { country: string | null; num_visitors: number; visit_date: string }

const successQuery = (data: CountryRow[]) => ({
  data,
  error: null,
  isError: false,
  isFetching: false,
  isPending: false,
})

beforeEach(() => {
  mockEchartsOptions.mockClear()
  mockedUseQuery.mockReset()
})

describe("CourseVisitorsByCountry", () => {
  it("maps aggregated country data into a non-empty bar series", () => {
    mockedUseQuery.mockReturnValue(
      successQuery([
        { country: "fi", num_visitors: 10, visit_date: "2022-01-01" },
        { country: "se", num_visitors: 5, visit_date: "2022-01-02" },
        { country: "fi", num_visitors: 2, visit_date: "2022-01-03" },
      ]),
    )

    render(<CourseVisitorsByCountry courseId="course-1" />)

    expect(mockEchartsOptions).toHaveBeenCalled()
    const options = mockEchartsOptions.mock.lastCall?.[0] as {
      series: { type: string; data: number[] }[]
      yAxis: { data: string[] }
    }
    // fi totals 10 + 2 = 12, se totals 5 -> two categories, summed per country.
    expect(options.series[0].type).toBe("bar")
    expect(options.series[0].data).toHaveLength(2)
    expect(options.series[0].data).toEqual(expect.arrayContaining([12, 5]))
    expect(options.yAxis.data).toHaveLength(2)
  })

  it("shows the no-data fallback instead of a chart for an empty result", () => {
    mockedUseQuery.mockReturnValue(successQuery([]))

    render(<CourseVisitorsByCountry courseId="course-1" />)

    expect(mockEchartsOptions).not.toHaveBeenCalled()
  })
})
