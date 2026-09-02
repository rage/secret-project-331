"use client"

import React from "react"

import { computeLabel, UserDisplay } from "@/components/UserDisplay"

import { useStudentsContext } from "../StudentsContext"

/** Avatar, gap, padding and border of the pill, none of which text measurement can see. */
export const STUDENT_PILL_CHROME_PX = 50

interface StudentIdentityRow {
  user_id: string
  first_name?: string | null | undefined
  last_name?: string | null | undefined
  email?: string | null | undefined
}

/** The pill's text, from the same rule the badge itself uses, for off-DOM width measurement. */
export const studentPillText = (row: StudentIdentityRow): string =>
  computeLabel(
    { firstName: row.first_name, lastName: row.last_name, email: row.email },
    row.user_id,
  ).displayText

export interface StudentPillCellProps {
  userId: string
  firstName?: string | null | undefined
  lastName?: string | null | undefined
  email?: string | null | undefined
}

/**
 * Students-tab student cell: the UserDisplay pill fed from row data (`courseId` comes from context),
 * so the popover's details load only on open instead of one fetch per row.
 */
export const StudentPillCell: React.FC<StudentPillCellProps> = ({
  userId,
  firstName,
  lastName,
  email,
}) => {
  const { courseId } = useStudentsContext()
  return (
    <UserDisplay
      userId={userId}
      courseId={courseId}
      prefetchedIdentity={{ firstName, lastName, email }}
    />
  )
}
