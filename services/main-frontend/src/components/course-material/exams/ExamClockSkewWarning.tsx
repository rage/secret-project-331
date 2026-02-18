"use client"

import { css } from "@emotion/css"
import React, { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import useTime from "@/hooks/course-material/useTime"
import { fetchCurrentServerTime } from "@/services/course-material/backend"
import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
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
  const serverMs = Date.parse(serverTime)

  if (Number.isNaN(serverMs)) {
    return null
  }

  const rttMs = Math.max(0, t1 - t0)
  const estimatedServerAtReceiveMs = serverMs + rttMs / 2
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
  margin-bottom: 1.25rem;
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

const noteClass = css`
  margin: 0;
  line-height: 1.45;
  padding: 0.6rem 0.7rem;
  border-radius: 6px;
  background: ${baseTheme.colors.clear[100]};
  border: 1px solid ${baseTheme.colors.clear[300]};
`

const metaClass = css`
  margin: 0;
  color: ${baseTheme.colors.gray[600]};
  font-size: 0.95rem;
  line-height: 1.4;
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
    const difference = t("exam-clock-warning-duration", { hours, minutes })
    const direction =
      estimate.finalOffsetMs >= 0
        ? t("exam-clock-warning-direction-behind")
        : t("exam-clock-warning-direction-ahead")

    const resolvedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const timezoneForFormatting = resolvedTimezone || "UTC"
    const displayedTimezone = resolvedTimezone || t("exam-clock-warning-timezone-unknown")
    const timezoneOffset = formatUtcOffset(now)

    const deviceNowMs = now.getTime()
    const correctNowMs = deviceNowMs + estimate.finalOffsetMs
    const correctTime = formatDateTimeInTimezone(correctNowMs, timezoneForFormatting, i18n.language)
    const deviceTime = formatDateTimeInTimezone(deviceNowMs, timezoneForFormatting, i18n.language)

    return (
      <BreakFromCentered sidebar={false}>
        <section className={severityStyles(isSevere)} data-testid="exam-clock-skew-warning">
          <div className={cardContentClass}>
            <div className={labelClass(isSevere)}>{t("exam-clock-warning-label")}</div>
            <h2 className={headingClass}>
              {isSevere ? t("exam-clock-warning-title-severe") : t("exam-clock-warning-title")}
            </h2>
            <p className={bodyClass}>
              {showDetailedInformation
                ? t("exam-clock-warning-summary-detailed", { difference })
                : t("exam-clock-warning-summary-mild", { difference })}
            </p>

            {showDetailedInformation ? (
              <div className={detailsContainerClass}>
                <p className={noteClass}>{t("exam-clock-warning-rtt-note")}</p>
                <div className={detailsClass}>
                  <p className={detailRowClass}>
                    {t("exam-clock-warning-timezone", {
                      timezone: displayedTimezone,
                      offset: timezoneOffset,
                    })}
                  </p>
                  <p className={detailRowClass}>
                    {t("exam-clock-warning-correct-time", {
                      timezone: displayedTimezone,
                      time: correctTime,
                    })}
                  </p>
                  <p className={detailRowClass}>
                    {t("exam-clock-warning-device-time", {
                      timezone: displayedTimezone,
                      time: deviceTime,
                    })}
                  </p>
                  <p className={`${detailRowClass} ${highlightedDetailRowClass(isSevere)}`}>
                    {t("exam-clock-warning-difference", { difference, direction })}
                  </p>
                </div>
                <p className={metaClass}>
                  {t("exam-clock-warning-sampling", {
                    samples: estimate.sampleCount,
                    rtt: Math.round(estimate.bestRttMs),
                  })}
                </p>
              </div>
            ) : (
              <p className={noteClass}>
                {t("exam-clock-warning-rtt-note-short", {
                  samples: estimate.sampleCount,
                  rtt: Math.round(estimate.bestRttMs),
                })}
              </p>
            )}
          </div>
        </section>
      </BreakFromCentered>
    )
  }, [estimate, i18n.language, now, t])

  return renderedWarning
}

export default ExamClockSkewWarning
