import {
  parseTimeInputFromUser,
  resolveDayPeriodLabels,
} from "../src/components/primitives/DatePickerCalendar/datePickerCalendarTimeUtils"

describe("datePickerCalendarTimeUtils", () => {
  test("parses localized 24-hour input that uses a dot separator", () => {
    const parsed = parseTimeInputFromUser("9.30", {
      hour12: false,
      locale: "fi-FI",
      dayPeriodLabels: resolveDayPeriodLabels("fi-FI"),
    })

    expect(parsed?.hour).toBe(9)
    expect(parsed?.minute).toBe(30)
    expect(parsed?.second).toBe(0)
  })

  test("parses locale-specific day period markers", () => {
    const locale = "fi-FI"
    const dayPeriodLabels = resolveDayPeriodLabels(locale)
    const parsed = parseTimeInputFromUser(`9.30 ${dayPeriodLabels.pm}`, {
      hour12: true,
      locale,
      dayPeriodLabels,
    })

    expect(parsed?.hour).toBe(21)
    expect(parsed?.minute).toBe(30)
    expect(parsed?.second).toBe(0)
  })
})
