import type { useCalendarState } from "@react-stately/calendar"
import type { AriaDialogProps, CalendarProps, DateValue, TimeValue } from "react-aria"

export type SupportedHourCycle = "h11" | "h12" | "h23" | "h24"

export type DayPeriod = "am" | "pm"

export type CalendarPickerView = "calendar" | "month" | "year"

export type DatePickerTimeSelectorProps = {
  granularity: "hour" | "minute"
  hourCycle?: 12 | 24
  isDisabled?: boolean
  isReadOnly?: boolean
  minuteStep: number
  value: TimeValue | null
  onChange: (value: TimeValue) => void
}

export type ChooserGridOption = {
  id: string
  isSelected: boolean
  label: string
  onSelect: () => void
}

export type DatePickerCalendarProps = {
  calendarProps: CalendarProps<DateValue>
  canClear: boolean
  dialogProps: AriaDialogProps
  onClear: () => void
  onSelectNextWeek?: (value: ReturnType<typeof useCalendarState>["visibleRange"]["start"]) => void
  onSelectNow?: () => void
  onSelectToday: (value: ReturnType<typeof useCalendarState>["visibleRange"]["start"]) => void
  onSelectTomorrow?: (value: ReturnType<typeof useCalendarState>["visibleRange"]["start"]) => void
  timeSelectorProps?: DatePickerTimeSelectorProps
}
