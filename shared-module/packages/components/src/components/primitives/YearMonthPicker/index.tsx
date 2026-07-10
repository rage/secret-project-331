"use client"

import { cx } from "@emotion/css"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useLocale } from "react-aria"

import { CalendarNavButton } from "../DatePickerCalendar/CalendarNavButton"
import { ChevronIcon } from "../DatePickerCalendar/ChevronIcon"
import { ChooserGridSection } from "../DatePickerCalendar/ChooserGridSection"
import {
  leftDirection,
  monthIdPrefix,
  nextYearLabel,
  nextYearsLabel,
  pickMonthTitle,
  pickYearTitle,
  previousYearLabel,
  previousYearsLabel,
  rightDirection,
  yearIdPrefix,
} from "../DatePickerCalendar/datePickerCalendarConstants"
import {
  calendarNavButtonCss,
  chooserPagerCss,
  chooserPanelCss,
  chooserTitleCss,
  inlinePickerHeaderCss,
  monthYearLinkCss,
  pickerRootCss,
} from "../DatePickerCalendar/datePickerCalendarStyles"
import { getYearPageStart } from "../DatePickerCalendar/datePickerCalendarTimeUtils"

export type YearMonthPickerView = "month" | "year"

export type YearMonthPickerProps = {
  initialView?: YearMonthPickerView
  selectedYear: number | null
  selectedMonth: number | null
  minYear?: number
  minMonth?: number
  maxYear?: number
  maxMonth?: number
  isDisabled?: boolean
  isReadOnly?: boolean
  locale?: string
  onSelect: (year: number, month: number) => void
  onCancel?: () => void
  className?: string
}

const MONTHS_IN_YEAR = 12
const YEAR_PAGE_SIZE = 12
// oxlint-disable-next-line i18next/no-literal-string
const monthView = "month" as const
// oxlint-disable-next-line i18next/no-literal-string
const yearView = "year" as const

export function YearMonthPicker({
  initialView = monthView,
  selectedYear,
  selectedMonth,
  minYear,
  minMonth,
  maxYear,
  maxMonth,
  isDisabled = false,
  isReadOnly = false,
  locale: localeProp,
  onSelect,
  onCancel,
  className,
}: YearMonthPickerProps) {
  const { locale: localeFromAria } = useLocale()
  const locale = localeProp ?? localeFromAria
  const currentYear = new Date().getFullYear()
  const [view, setView] = useState<YearMonthPickerView>(initialView)
  const [draftYear, setDraftYear] = useState(selectedYear ?? currentYear)
  const [yearPageStart, setYearPageStart] = useState(getYearPageStart(selectedYear ?? currentYear))

  useEffect(() => {
    setView(initialView)
  }, [initialView])

  useEffect(() => {
    const nextYear = selectedYear ?? currentYear
    setDraftYear(nextYear)
    setYearPageStart(getYearPageStart(nextYear))
  }, [currentYear, selectedYear])

  const monthFormatter = useMemo(
    () =>
      // oxlint-disable-next-line i18next/no-literal-string
      new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }),
    [locale],
  )
  const resolvedMinYear = minYear ?? Number.NEGATIVE_INFINITY
  const resolvedMaxYear = maxYear ?? Number.POSITIVE_INFINITY
  const isInteractive = !(isDisabled || isReadOnly)

  const isMonthDisabled = useCallback(
    (year: number, month: number) => {
      if (year < resolvedMinYear || year > resolvedMaxYear) {
        return true
      }
      if (minYear != null && minMonth != null && year === minYear && month < minMonth) {
        return true
      }
      if (maxYear != null && maxMonth != null && year === maxYear && month > maxMonth) {
        return true
      }
      return false
    },
    [maxMonth, maxYear, minMonth, minYear, resolvedMaxYear, resolvedMinYear],
  )

  const monthOptions = useMemo(
    () =>
      Array.from({ length: MONTHS_IN_YEAR }, (_, index) => {
        const month = index + 1
        const date = new Date(Date.UTC(draftYear, index, 1))
        return {
          id: `${monthIdPrefix}${draftYear}-${month}`,
          isSelected: selectedYear === draftYear && selectedMonth === month,
          label: monthFormatter.format(date),
          isDisabled: isMonthDisabled(draftYear, month),
          onSelect: () => {
            if (!isInteractive || isMonthDisabled(draftYear, month)) {
              return
            }
            onSelect(draftYear, month)
          },
        }
      }),
    [
      draftYear,
      isInteractive,
      isMonthDisabled,
      monthFormatter,
      onSelect,
      selectedMonth,
      selectedYear,
    ],
  )

  const yearOptions = useMemo(
    () =>
      Array.from({ length: YEAR_PAGE_SIZE }, (_, index) => {
        const year = yearPageStart + index
        return {
          id: `${yearIdPrefix}${year}`,
          isSelected: year === selectedYear,
          label: String(year),
          isDisabled: year < resolvedMinYear || year > resolvedMaxYear,
          onSelect: () => {
            if (!isInteractive || year < resolvedMinYear || year > resolvedMaxYear) {
              return
            }
            setDraftYear(year)
            setYearPageStart(getYearPageStart(year))
            setView(monthView)
          },
        }
      }),
    [isInteractive, resolvedMaxYear, resolvedMinYear, selectedYear, yearPageStart],
  )

  if (view === "year") {
    return (
      <div className={cx(pickerRootCss, chooserPanelCss, className)}>
        <div className={inlinePickerHeaderCss}>
          <button
            aria-label={pickMonthTitle}
            className={calendarNavButtonCss}
            disabled={!isInteractive}
            type="button"
            onClick={() => {
              if (!isInteractive) {
                return
              }
              if (onCancel) {
                onCancel()
                return
              }
              setView(monthView)
            }}
          >
            <ChevronIcon direction={leftDirection} />
          </button>
          <div className={chooserTitleCss}>{pickYearTitle}</div>
          <div className={chooserPagerCss}>
            <CalendarNavButton
              direction={leftDirection}
              isDisabled={!isInteractive}
              label={previousYearsLabel}
              onPress={() => setYearPageStart((current) => current - YEAR_PAGE_SIZE)}
            />
            <CalendarNavButton
              direction={rightDirection}
              isDisabled={!isInteractive}
              label={nextYearsLabel}
              onPress={() => setYearPageStart((current) => current + YEAR_PAGE_SIZE)}
            />
          </div>
        </div>
        <ChooserGridSection isDisabled={!isInteractive} options={yearOptions} />
      </div>
    )
  }

  return (
    <div className={cx(pickerRootCss, chooserPanelCss, className)}>
      <div className={inlinePickerHeaderCss}>
        <CalendarNavButton
          direction={leftDirection}
          isDisabled={!isInteractive}
          label={previousYearLabel}
          onPress={() => setDraftYear((year) => year - 1)}
        />
        <button
          aria-label={pickYearTitle}
          className={monthYearLinkCss}
          disabled={!isInteractive}
          type="button"
          onClick={() => setView(yearView)}
        >
          {draftYear}
        </button>
        <CalendarNavButton
          direction={rightDirection}
          isDisabled={!isInteractive}
          label={nextYearLabel}
          onPress={() => setDraftYear((year) => year + 1)}
        />
      </div>
      <div className={chooserTitleCss}>{pickMonthTitle}</div>
      <ChooserGridSection isDisabled={!isInteractive} options={monthOptions} />
    </div>
  )
}
