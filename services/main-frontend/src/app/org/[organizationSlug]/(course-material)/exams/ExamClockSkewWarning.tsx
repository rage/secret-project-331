"use client"

import { css } from "@emotion/css"
import { addMilliseconds, differenceInMilliseconds, parseISO } from "date-fns"
import React, { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import useTime from "@/hooks/course-material/useTime"
import { fetchCurrentServerTime } from "@/services/course-material/backend"
import { baseTheme, primaryFont } from "@/shared-module/common/styles"

const MINUTE_MS = 60_000
const SAMPLE_COUNT = 7

interface ClockSkewSample {
  offsetMs: number
  rttMs: number
}

interface ClockSkewEstimate {
  finalOffsetMs: number
  sampleCount: number
  bestRttMs: number
}

const sampleClockOffset = async (): Promise<ClockSkewSample | null> => {
  const t0 = Date.now()
  const serverTime = await fetchCurrentServerTime()
  const t1 = Date.now()
  const serverDate = parseISO(serverTime)
  const serverMs = serverDate.getTime()

  if (Number.isNaN(serverMs)) {
    return null
  }

  const rttMs = Math.max(0, differenceInMilliseconds(t1, t0))
  const estimatedServerAtReceiveMs = addMilliseconds(serverDate, rttMs / 2).getTime()
  const offsetMs = estimatedServerAtReceiveMs - t1

  return {
    offsetMs,
    rttMs,
  }
}

const chooseEstimateFromSamples = (samples: ClockSkewSample[]): ClockSkewEstimate | null => {
  if (samples.length === 0) {
    return null
  }

  const bestSample = samples.reduce((best, sample) => (sample.rttMs < best.rttMs ? sample : best))

  return {
    finalOffsetMs: bestSample.offsetMs,
    sampleCount: samples.length,
    bestRttMs: bestSample.rttMs,
  }
}

/* eslint-disable i18next/no-literal-string */
const getDateStringInTimezone = (ms: number, tz: string): string =>
  new Intl.DateTimeFormat("en", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms))
/* eslint-enable i18next/no-literal-string */

const formatDateTimeInTimezone = (
  timestampMs: number,
  timeZone: string,
  language: string,
): string => {
  return new Intl.DateTimeFormat(language, {
    timeZone,
    // eslint-disable-next-line i18next/no-literal-string
    year: "numeric",
    // eslint-disable-next-line i18next/no-literal-string
    month: "2-digit",
    // eslint-disable-next-line i18next/no-literal-string
    day: "2-digit",
    // eslint-disable-next-line i18next/no-literal-string
    hour: "2-digit",
    // eslint-disable-next-line i18next/no-literal-string
    minute: "2-digit",
    // eslint-disable-next-line i18next/no-literal-string
    second: "2-digit",
  }).format(new Date(timestampMs))
}

const formatTimeInTimezone = (timestampMs: number, timeZone: string, language: string): string => {
  return new Intl.DateTimeFormat(language, {
    timeZone,
    // eslint-disable-next-line i18next/no-literal-string
    hour: "2-digit",
    // eslint-disable-next-line i18next/no-literal-string
    minute: "2-digit",
    // eslint-disable-next-line i18next/no-literal-string
    second: "2-digit",
  }).format(new Date(timestampMs))
}

const formatUtcOffset = (now: Date): string => {
  const totalMinutes = -now.getTimezoneOffset()
  const sign = totalMinutes >= 0 ? "+" : "-"
  const absoluteMinutes = Math.abs(totalMinutes)
  const hours = String(Math.floor(absoluteMinutes / 60)).padStart(2, "0")
  const minutes = String(absoluteMinutes % 60).padStart(2, "0")
  return `UTC${sign}${hours}:${minutes}`
}

const severityStyles = (isSevere: boolean) => css`
  background: ${isSevere
    ? `linear-gradient(140deg, ${baseTheme.colors.red[100]}, ${baseTheme.colors.clear[100]})`
    : `linear-gradient(140deg, ${baseTheme.colors.yellow[100]}, ${baseTheme.colors.clear[100]})`};
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

const ExamClockSkewWarning: React.FC = () => {
  const { t, i18n } = useTranslation()
  const now = useTime()
  const [estimate, setEstimate] = useState<ClockSkewEstimate | null>(null)

  useEffect(() => {
    let cancelled = false

    const runSampling = async () => {
      const samples: ClockSkewSample[] = []

      for (let i = 0; i < SAMPLE_COUNT; i += 1) {
        try {
          const sample = await sampleClockOffset()
          if (sample) {
            samples.push(sample)
          }
        } catch {
          // Ignore individual sample failures and use the rest.
        }
      }

      if (cancelled) {
        return
      }

      setEstimate(chooseEstimateFromSamples(samples))
    }

    void runSampling()

    return () => {
      cancelled = true
    }
  }, [])

  const renderedWarning = useMemo(() => {
    if (!estimate) {
      return null
    }

    const absOffsetMs = Math.abs(estimate.finalOffsetMs)
    if (absOffsetMs < 2 * MINUTE_MS) {
      return null
    }

    const isSevere = absOffsetMs >= 60 * MINUTE_MS
    const showDetailedInformation = absOffsetMs > 15 * MINUTE_MS
    const roundedDifferenceMinutes = Math.round(absOffsetMs / MINUTE_MS)
    const hours = Math.floor(roundedDifferenceMinutes / 60)
    const minutes = roundedDifferenceMinutes % 60
    const difference =
      hours > 0 && minutes > 0
        ? t("exam-clock-warning-duration-hours-minutes", { hours, minutes })
        : hours > 0
          ? t("exam-clock-warning-duration-hours-only", { hours })
          : t("exam-clock-warning-duration-minutes-only", { minutes })
    const isFast = estimate.finalOffsetMs < 0

    const resolvedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const timezoneForFormatting = resolvedTimezone || "UTC"
    const displayedTimezone = resolvedTimezone || t("exam-clock-warning-timezone-unknown")
    const timezoneOffset = formatUtcOffset(now)

    const deviceNowMs = now.getTime()
    const correctNowMs = addMilliseconds(now, estimate.finalOffsetMs).getTime()
    const datesMatch =
      getDateStringInTimezone(correctNowMs, timezoneForFormatting) ===
      getDateStringInTimezone(deviceNowMs, timezoneForFormatting)
    const formatTime = datesMatch ? formatTimeInTimezone : formatDateTimeInTimezone
    const correctTime = formatTime(correctNowMs, timezoneForFormatting, i18n.language)
    const deviceTime = formatTime(deviceNowMs, timezoneForFormatting, i18n.language)

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
  }, [estimate, i18n.language, now, t])

  return renderedWarning
}

export default ExamClockSkewWarning
