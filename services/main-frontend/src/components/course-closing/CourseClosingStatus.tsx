"use client"

import { css } from "@emotion/css"
import { isValid, parseISO } from "date-fns"
import React from "react"
import { useDateFormatter } from "react-aria"
import { Trans } from "react-i18next"

import { RelativeTime } from "@/shared-module/components"

const statusStyles = css`
  margin: 0;
`

/** No `hourCycle`, so the clock follows the locale like the date-time fields do. */
const DATE_TIME_FORMAT = { dateStyle: "medium", timeStyle: "short" } as const

interface CourseClosingStatusProps {
  /** ISO timestamp, or a `datetime-local` value (read in browser local time). */
  closedAt: string | null | undefined
}

/** One-line summary of whether the course is open or closed, and what students see. */
const CourseClosingStatus: React.FC<CourseClosingStatusProps> = ({ closedAt }) => {
  const dateFormatter = useDateFormatter(DATE_TIME_FORMAT)
  if (!closedAt) {
    return null
  }
  const date = parseISO(closedAt)
  if (!isValid(date)) {
    return null
  }
  const formattedDate = dateFormatter.format(date)

  if (date.getTime() > Date.now()) {
    return (
      <p className={statusStyles} data-testid="course-closing-status">
        <Trans
          i18nKey="course-closing-status-open"
          values={{ date: formattedDate }}
          components={{ relative: <RelativeTime at={date.toISOString()} absoluteTime="title" /> }}
        />
      </p>
    )
  }
  return (
    <p className={statusStyles} data-testid="course-closing-status">
      <Trans i18nKey="course-closing-status-closed" values={{ date: formattedDate }} />
    </p>
  )
}

export default CourseClosingStatus
