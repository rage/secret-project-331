"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import type { CreditRegistrationNote } from "@/generated/api/types.generated"

import { CREDIT_REGISTRATION_NS } from "../constants"
import { noteCss, stackedCellCss } from "../styles"
import { formatZonedTimestamp } from "../ZonedTimestamp"
import { actorName } from "./actorName"

const noteTextCss = css`
  color: var(--color-gray-700);
  white-space: pre-line;
  overflow-wrap: anywhere;
`

/** The notes left on a registration, newest first: who wrote each and when, then the note. */
const RegistrationNoteLines: React.FC<{ notes: CreditRegistrationNote[] }> = ({ notes }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  if (notes.length === 0) {
    return null
  }
  return (
    <span className={stackedCellCss}>
      {notes.map((note) => (
        <span key={`${note.created_at}-${note.written_by_user_id}`} className={noteCss}>
          {t("credit-registration-admin-note-by", {
            name: actorName(t, {
              firstName: note.written_by_first_name,
              lastName: note.written_by_last_name,
              email: note.written_by_email,
            }),
            time: formatZonedTimestamp(new Date(note.created_at)),
          })}{" "}
          <span className={noteTextCss}>{note.note}</span>
        </span>
      ))}
    </span>
  )
}

export default RegistrationNoteLines
