"use client"

import { css } from "@emotion/css"
import { addMilliseconds } from "date-fns"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import useTime from "@/hooks/course-material/useTime"
import { baseTheme, primaryFont } from "@/shared-module/common/styles"

import useClockSkew from "./useClockSkew"

const MINUTE_MS = 60_000
/* oxlint-disable i18next/no-literal-string */
const useFormatters = (timeZone: string, language: string) =>
  useMemo(
    () => ({
      date: new Intl.DateTimeFormat("en", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }),
      dateTime: new Intl.DateTimeFormat(language, {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
      time: new Intl.DateTimeFormat(language, {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    }),
    [timeZone, language],
  )
/* oxlint-enable i18next/no-literal-string */

const formatUtcOffset = (now: Date): string => {
  const totalMinutes = -now.getTimezoneOffset()
  const sign = totalMinutes >= 0 ? "+" : "-"
  const absoluteMinutes = Math.abs(totalMinutes)
  const hours = String(Math.floor(absoluteMinutes / 60)).padStart(2, "0")
  const minutes = String(absoluteMinutes % 60).padStart(2, "0")
  return `UTC${sign}${hours}:${minutes}`
}

const severityStyles = (isSevere: boolean) => css`
  background: ${
    isSevere
      ? `linear-gradient(140deg, ${baseTheme.colors.red[100]}, ${baseTheme.colors.clear[100]})`
      : `linear-gradient(140deg, ${baseTheme.colors.yellow[100]}, ${baseTheme.colors.clear[100]})`
  };
  border: 1px solid ${isSevere ? baseTheme.colors.red[300] : baseTheme.colors.yellow[300]};
  border-left: 10px solid ${isSevere ? baseTheme.colors.red[600] : baseTheme.colors.yellow[600]};
  border-radius: 10px;
  padding: 1rem 1.15rem;
  margin-bottom: 1rem;
  box-shadow: 0 6px 20px ${baseTheme.colors.clear[300]};
  color: ${baseTheme.colors.gray[700]};
  font-family: ${primaryFont};
`

const cardContentClass = css`
  display: grid;
  gap: 0.65rem;
`

const headingClass = css`
  font-size: clamp(1.05rem, 2.8vw, 1.32rem);
  font-weight: 700;
  line-height: 1.25;
  margin: 0;
`

const bodyClass = css`
  margin: 0;
  line-height: 1.5;
`

const detailsContainerClass = css`
  display: grid;
  gap: 0.5rem;
`

const detailsClass = css`
  display: grid;
  gap: 0.45rem;
`

const detailRowClass = css`
  margin: 0;
  line-height: 1.45;
  padding: 0.55rem 0.65rem;
  border: 1px solid ${baseTheme.colors.clear[300]};
  border-radius: 6px;
  background: ${baseTheme.colors.clear[50]};
`

const highlightedDetailRowClass = (isSevere: boolean) => css`
  border-color: ${isSevere ? baseTheme.colors.red[300] : baseTheme.colors.yellow[400]};
  background: ${isSevere ? baseTheme.colors.red[75] : baseTheme.colors.yellow[75]};
  color: ${baseTheme.colors.gray[700]};
  font-weight: 600;
`

const labelClass = (isSevere: boolean) => css`
  display: inline-block;
  text-transform: uppercase;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: ${baseTheme.colors.clear[50]};
  background: ${isSevere ? baseTheme.colors.red[700] : baseTheme.colors.yellow[500]};
  border-radius: 999px;
  padding: 0.25rem 0.7rem;
`

const SIGNIFICANT_SKEW_MS = 2 * MINUTE_MS

const ExamClockSkewWarning: React.FC = () => {
  const estimate = useClockSkew()
  // Without a significant skew there is nothing to show, so no clock is subscribed to.
  if (!estimate || Math.abs(estimate.finalOffsetMs) < SIGNIFICANT_SKEW_MS) {
    return null
  }
  return <ClockSkewWarningCard offsetMs={estimate.finalOffsetMs} />
}

const ClockSkewWarningCard: React.FC<{ offsetMs: number }> = ({ offsetMs }) => {
  const { t, i18n } = useTranslation()
  const now = useTime()
  const resolvedTimezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, [])
  const timezoneForFormatting = resolvedTimezone || "UTC"
  const formatters = useFormatters(timezoneForFormatting, i18n.language)

  const absOffsetMs = Math.abs(offsetMs)
  const isSevere = absOffsetMs >= 60 * MINUTE_MS
  const showDetailedInformation = absOffsetMs > 15 * MINUTE_MS
  const roundedDifferenceMinutes = Math.round(absOffsetMs / MINUTE_MS)
  const hours = Math.floor(roundedDifferenceMinutes / 60)
  const minutes = roundedDifferenceMinutes % 60
  const difference =
    hours > 0 && minutes > 0
      ? t("exam-clock-warning-duration-hours-minutes", { hours, minutes })
      : hours > 0
        ? t("exam-clock-warning-duration-hours-only", { count: hours })
        : t("exam-clock-warning-duration-minutes-only", { count: minutes })
  const isFast = offsetMs < 0

  const displayedTimezone = resolvedTimezone || t("exam-clock-warning-timezone-unknown")
  const timezoneOffset = formatUtcOffset(now)

  const deviceNowMs = now.getTime()
  const correctNowMs = addMilliseconds(now, offsetMs).getTime()
  const datesMatch = formatters.date.format(correctNowMs) === formatters.date.format(deviceNowMs)
  const timeFormatter = datesMatch ? formatters.time : formatters.dateTime
  const correctTime = timeFormatter.format(correctNowMs)
  const deviceTime = timeFormatter.format(deviceNowMs)

  return (
    <section className={severityStyles(isSevere)} data-testid="exam-clock-skew-warning">
      <div className={cardContentClass}>
        <div className={labelClass(isSevere)}>{t("exam-clock-warning-label")}</div>
        <h2 className={headingClass}>
          {t(isFast ? "exam-clock-warning-title-fast" : "exam-clock-warning-title-slow", {
            difference,
          })}
        </h2>
        <p className={bodyClass}>
          {showDetailedInformation
            ? t("exam-clock-warning-summary-detailed")
            : t("exam-clock-warning-summary-mild")}
        </p>

        {showDetailedInformation ? (
          <div className={detailsContainerClass}>
            <div className={detailsClass}>
              <p className={detailRowClass}>
                {t("exam-clock-warning-timezone", {
                  timezone: displayedTimezone,
                  offset: timezoneOffset,
                })}
              </p>
              <p className={detailRowClass}>
                {t("exam-clock-warning-correct-time", { time: correctTime })}
              </p>
              <p className={detailRowClass}>
                {t("exam-clock-warning-device-time", { time: deviceTime })}
              </p>
              <p className={`${detailRowClass} ${highlightedDetailRowClass(isSevere)}`}>
                {t(
                  isFast
                    ? "exam-clock-warning-difference-fast"
                    : "exam-clock-warning-difference-slow",
                  { difference },
                )}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}

export default ExamClockSkewWarning
