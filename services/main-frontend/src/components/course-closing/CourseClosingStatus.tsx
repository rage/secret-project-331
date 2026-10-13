"use client"

import { css } from "@emotion/css"
import { format, isValid, parseISO } from "date-fns"
import React from "react"
import { Trans } from "react-i18next"

import { RelativeTime } from "@/shared-module/components"

const statusStyles = css`
  margin: 0;
`

interface CourseClosingStatusProps {
  /** ISO timestamp, or a `datetime-local` value (read in browser local time). */
  closedAt: string | null | undefined
}

/** One-line summary of whether the course is open or closed, and what students see. */
const CourseClosingStatus: React.FC<CourseClosingStatusProps> = ({ closedAt }) => {
  if (!closedAt) {
    return null
  }
  const date = parseISO(closedAt)
  if (!isValid(date)) {
    return null
  }
  // oxlint-disable-next-line i18next/no-literal-string
  const formattedDate = format(date, "yyyy-MM-dd HH:mm")

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
