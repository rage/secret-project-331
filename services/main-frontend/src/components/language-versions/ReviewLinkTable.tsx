"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import type { LanguageVersionCourse } from "@/generated/api/types.generated"
import useLanguageName from "@/shared-module/common/hooks/useLanguageName"
import { Disclosure, Table, type TableRowGroup } from "@/shared-module/components"

import {
  isRowAccepted,
  type MatchFields,
  type MatchRow,
  NO_COUNTERPART,
  rowChangesLinks,
} from "./matchRows"
import { mutedCss } from "./shared"

interface Props {
  title: string
  referenceCourse: LanguageVersionCourse
  courses: LanguageVersionCourse[]
  rows: MatchRow[]
  fields: MatchFields
  rowGroup: (row: MatchRow) => TableRowGroup
}

/** The accepted rows whose links change, as they will be saved, for a last check before applying. */
const ReviewLinkTable: React.FC<Props> = ({
  title,
  referenceCourse,
  courses,
  rows,
  fields,
  rowGroup,
}) => {
  const { t } = useTranslation()
  const languageName = useLanguageName()
  const changedRows = rows.filter(
    (row) =>
      isRowAccepted(row, fields.picks[row.id], fields.accepted[row.id]) &&
      rowChangesLinks(row, fields.picks[row.id]),
  )
  if (changedRows.length === 0) {
    return null
  }
  const pickedLabel = (row: MatchRow, courseId: string) => {
    const pick = fields.picks[row.id]?.[courseId] ?? NO_COUNTERPART
    const counterpart = row.counterparts.find((candidate) => candidate.courseId === courseId)
    const label = counterpart?.options.find((option) => option.id === pick)?.label
    return pick === NO_COUNTERPART || label === undefined ? (
      <span className={mutedCss}>{t("language-versions-no-counterpart-option")}</span>
    ) : (
      label
    )
  }
  return (
    <Disclosure title={title} summary={changedRows.length}>
      <Table
        caption={title}
        rows={changedRows}
        rowKey={(row) => row.id}
        rowGroup={rowGroup}
        columns={[
          {
            header: languageName(referenceCourse.language_code),
            cell: (row) => row.label,
          },
          ...courses.map((course) => ({
            header: languageName(course.language_code),
            cell: (row: MatchRow) => pickedLabel(row, course.id),
          })),
        ]}
      />
    </Disclosure>
  )
}

export default ReviewLinkTable
