"use client"

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { CheckCircle, ClockTime } from "@vectopus/atlas-icons-react"
import { hoursToSeconds, secondsToHours, secondsToMinutes } from "date-fns"
import React from "react"
import { Trans, useTranslation } from "react-i18next"

import HideTextInSystemTests from "@/shared-module/common/components/system-tests/HideTextInSystemTests"
import { baseTheme } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

const SHORT = "short"

const TimerContainer = styled.div`
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 2px 8px ${baseTheme.colors.clear[300]};

  ${respondToOrLarger.sm} {
    flex-direction: row;
    flex-wrap: nowrap;
  }
`

const InfoBoxLightGreenMedium = styled.div`
  align-items: center;
  background-color: ${baseTheme.colors.green[100]};
  color: ${baseTheme.colors.green[700]};
  display: flex;
  flex: 2;
  flex-direction: column;
  justify-content: center;
  padding: 0.5rem;
  text-align: center;
  text-transform: uppercase;

  ${respondToOrLarger.sm} {
    flex-direction: row;
    text-align: left;
  }
`

const InfoBoxDarkGreenSmall = styled.div`
  padding: 0.75rem 1rem;
  flex: 1;
  background-color: ${baseTheme.colors.green[700]};
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  font-weight: 700;
`

export interface ExamTimerProps {
  endsAt: Date
  /** Define to override how time is displayed. */
  hour12?: boolean
  maxScore?: number
  startedAt: Date
  secondsLeft: number
}

const ExamTimer: React.FC<React.PropsWithChildren<ExamTimerProps>> = ({
  endsAt,
  hour12,
  maxScore,
  secondsLeft,
  startedAt,
}) => {
  const { t } = useTranslation()

  const timeFormatOptions: Intl.DateTimeFormatOptions = { hour12, timeStyle: SHORT }
  const formatedStartedAt = startedAt.toLocaleTimeString(undefined, timeFormatOptions)
  const formatedEndsAt = endsAt.toLocaleTimeString(undefined, timeFormatOptions)

  return (
    <TimerContainer>
      {maxScore && (
        <InfoBoxLightGreenMedium>
          <CheckCircle
            className={css`
              color: ${baseTheme.colors.green[200]};
              margin-right: 0.5rem;
            `}
          />
          <div>
            <Trans t={t} i18nKey="max-score-n-marks">
              Max score:{" "}
              <div
                className={css`
                  color: ${baseTheme.colors.green[100]};
                  text-transform: lowercase;
                `}
              >
                {maxScore} marks
              </div>
            </Trans>
          </div>
        </InfoBoxLightGreenMedium>
      )}
      <InfoBoxLightGreenMedium>
        <ClockTime
          className={css`
            margin: 0.5rem;
          `}
        />
        <div>
          <HideTextInSystemTests
            text={t("started-at-time", { time: formatedStartedAt })}
            testPlaceholder={t("started-at-time", { time: "XX:XX PM" })}
          />
        </div>
      </InfoBoxLightGreenMedium>
      <InfoBoxLightGreenMedium>
        <HideTextInSystemTests
          text={t("ends-at-time", { time: formatedEndsAt })}
          testPlaceholder={t("ends-at-time", { time: "XX:XX PM" })}
        />
      </InfoBoxLightGreenMedium>
      <InfoBoxDarkGreenSmall>
        <HideTextInSystemTests
          text={formatTimeLeft(secondsLeft)}
          testPlaceholder={formatTimeLeft(135)}
        />
      </InfoBoxDarkGreenSmall>
    </TimerContainer>
  )
}

export default ExamTimer

/** Display as hours:minutes left, e.g. 1:03 or 120:59 */
function formatTimeLeft(secondsLeft: number) {
  if (secondsLeft <= 0) {
    return "0:00"
  }

  const hoursLeft = secondsToHours(secondsLeft)
  const minutesLeft = secondsToMinutes(secondsLeft - hoursToSeconds(hoursLeft))
  const padding = minutesLeft < 10 ? "0" : ""
  return `${hoursLeft}:${padding}${minutesLeft}`
}
