import { css, cx } from "@emotion/css"
import styled from "@emotion/styled"
import { faCheckCircle, faClock } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { differenceInSeconds, hoursToSeconds, secondsToHours, secondsToMinutes } from "date-fns"
import React from "react"
import { Trans, useTranslation } from "react-i18next"

import useTime from "../../hooks/useTime"
import { baseTheme } from "../../shared-module/styles"
import { normalWidthCenteredComponentStyles } from "../../shared-module/styles/componentStyles"
import { respondToOrLarger } from "../../shared-module/styles/respond"

const SHORT = "short"

const InfoBoxLightGreenMedium = styled.div`
  align-items: center;
  background-color: ${baseTheme.colors.green[500]};
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
  padding: 0.5rem;
  flex: 1;
  background-color: ${baseTheme.colors.green[200]};
  display: flex;
  align-items: center;
  justify-content: center;
`

export interface ExamTimerProps {
  courseName?: string
  endsAt: Date
  /** Define to override how time is displayed. */
  hour12?: boolean
  maxScore: number
  startedAt: Date
}

const ExamTimer: React.FC<ExamTimerProps> = ({
  courseName,
  endsAt,
  hour12,
  maxScore,
  startedAt,
}) => {
  const now = useTime(5000)
  const { t } = useTranslation()

  const timeFormatOptions: Intl.DateTimeFormatOptions = { hour12, timeStyle: SHORT }
  const formatedStartedAt = startedAt.toLocaleTimeString(undefined, timeFormatOptions)
  const formatedEndsAt = endsAt.toLocaleTimeString(undefined, timeFormatOptions)

  return (
    <div
      className={cx(
        normalWidthCenteredComponentStyles,
        css`
          display: flex;
          flex-direction: row;
          flex-wrap: wrap;
        `,
      )}
    >
      {/* Not sure if we want to use this in the case that the name is very long. */}
      {courseName && (
        <InfoBoxLightGreenMedium>
          {t("course-title", { title: courseName })}
        </InfoBoxLightGreenMedium>
      )}
      <InfoBoxLightGreenMedium>
        <FontAwesomeIcon
          icon={faCheckCircle}
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
              {{ marks: maxScore }} marks
            </div>
          </Trans>
        </div>
      </InfoBoxLightGreenMedium>
      <InfoBoxLightGreenMedium>
        <FontAwesomeIcon
          icon={faClock}
          className={css`
            margin: 0.5rem;
          `}
        />
        <div>{t("started-at-time", { time: formatedStartedAt })}</div>
      </InfoBoxLightGreenMedium>
      <InfoBoxLightGreenMedium
        className={css`
          color: ${baseTheme.colors.green[100]};
        `}
      >
        {t("ends-at-time", { time: formatedEndsAt })}
      </InfoBoxLightGreenMedium>
      <InfoBoxDarkGreenSmall>{formatTimeLeft(now, endsAt)}</InfoBoxDarkGreenSmall>
    </div>
  )
}

export default ExamTimer

/** Display as hours:minutes left, e.g. 1:03 or 120:59 */
function formatTimeLeft(from: Date, to: Date) {
  const secondsLeft = differenceInSeconds(to, from)
  if (secondsLeft <= 0) {
    return "0:00"
  }

  const hoursLeft = secondsToHours(secondsLeft)
  const minutesLeft = secondsToMinutes(secondsLeft - hoursToSeconds(hoursLeft))
  const padding = minutesLeft < 10 ? "0" : ""
  return `${hoursLeft}:${padding}${minutesLeft}`
}
