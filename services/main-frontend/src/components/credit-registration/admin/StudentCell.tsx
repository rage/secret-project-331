"use client"

import React from "react"

import { formatUserName } from "@/hooks/useUserDetails"
import { Link } from "@/shared-module/components"

import { LINK_QUIET } from "../constants"
import { EmailAddress } from "../EmailAddress"
import { noteCss, stackedCellCss } from "../styles"

/** `Table.columns[].minWidth` for the `label-student` column, decided once for every table that has one. */
export const STUDENT_COLUMN_MIN_WIDTH = "12rem"

interface Props {
  row: { first_name?: string | null; last_name?: string | null; email?: string | null }
  /** Links the name to the registration; a caller without one row per registration omits it. */
  href?: string
}

/** A table cell's "who": the student's name over their email address. */
const StudentCell: React.FC<Props> = ({ row, href }) => (
  <span className={stackedCellCss}>
    {href ? (
      <Link href={href} appearance={LINK_QUIET} prefetch={false}>
        {formatUserName(row)}
      </Link>
    ) : (
      <span>{formatUserName(row)}</span>
    )}
    {row.email && (
      <span className={noteCss}>
        <EmailAddress address={row.email} />
      </span>
    )}
  </span>
)

export default StudentCell
