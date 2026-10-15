"use client"

import { cx } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { formatUserName } from "@/hooks/useUserDetails"
import { Link } from "@/shared-module/components"

import { CREDIT_REGISTRATION_NS, LINK_QUIET } from "../constants"
import { EmailAddress } from "../EmailAddress"
import { breakAnywhereCss, noteCss, stackedCellCss } from "../styles"

/** `Table.columns[].minWidth` for the `label-student` column, decided once for every table that has one. */
export const STUDENT_COLUMN_MIN_WIDTH = "12rem"

interface Props {
  row: { first_name?: string | null; last_name?: string | null; email?: string | null }
  /** Links the name to the registration; a caller without one row per registration omits it. */
  href?: string
}

/** A table cell's "who": the student's name over their email address. */
const StudentCell: React.FC<Props> = ({ row, href }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  // A nameless account still needs link text, or its row has nothing to open it by.
  const name = formatUserName(row) || t("missing-name")
  return (
    <span className={cx(stackedCellCss, breakAnywhereCss)}>
      {href ? (
        <Link href={href} appearance={LINK_QUIET} prefetch={false}>
          {name}
        </Link>
      ) : (
        <span>{name}</span>
      )}
      {row.email && (
        <span className={noteCss}>
          <EmailAddress address={row.email} />
        </span>
      )}
    </span>
  )
}

export default StudentCell
