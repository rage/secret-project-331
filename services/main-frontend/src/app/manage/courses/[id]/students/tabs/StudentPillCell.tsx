"use client"

import React from "react"

import { UserDisplay } from "@/components/UserDisplay"

import { useStudentsContext } from "../StudentsContext"

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
