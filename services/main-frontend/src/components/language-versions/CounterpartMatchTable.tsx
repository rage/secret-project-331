"use client"

import { css } from "@emotion/css"
import React from "react"
import type { Control } from "react-hook-form"
import { useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"

import type { LanguageVersionCourse, SuggestionSureness } from "@/generated/api/types.generated"
import useLanguageName from "@/shared-module/common/hooks/useLanguageName"
import { Badge, Button, Select, Table, TONE } from "@/shared-module/components"

import { ALIGN_END } from "./constants"
import {
  isRowAccepted,
  type MatchCounterpart,
  type MatchFields,
  type MatchRow,
  NO_COUNTERPART,
  rowChangesLinks,
} from "./matchRows"
import { hintCss, mutedCss, SurenessBadge } from "./shared"

// An AI pick overruled the position heuristic, so it is the one to check first.
const SURENESS_ORDER: SuggestionSureness[] = ["ai_suggestion", "unsure", "likely", "very_sure"]

function rowSureness(row: MatchRow): MatchCounterpart | null {
  // An AI "no counterpart" has no suggested id but is still a suggestion.
  const pending = row.counterparts.filter(
    (counterpart) =>
      !counterpart.isLinked &&
      counterpart.sureness &&
      (counterpart.suggestedId !== null || counterpart.sureness === "ai_suggestion"),
  )
  pending.sort(
    (a, b) =>
      SURENESS_ORDER.indexOf(a.sureness ?? "unsure") -
      SURENESS_ORDER.indexOf(b.sureness ?? "unsure"),
  )
  return pending[0] ?? null
}

const selectCellCss = css`
  min-width: 12rem;
`

interface RowActionsProps {
  row: MatchRow
  control: Control<MatchFields>
  onAccept: (rowId: string) => void
}

/** "Linked", "Accepted" or an Accept button; watches only its own row's fields. */
const RowActions: React.FC<RowActionsProps> = ({ row, control, onAccept }) => {
  const { t } = useTranslation()
  const picks = useWatch({ control, name: `picks.${row.id}` })
  const isAccepted = useWatch({ control, name: `accepted.${row.id}` })
  if (!rowChangesLinks(row, picks)) {
    return row.counterparts.some((counterpart) => counterpart.isLinked) ? (
      <Badge size="compact" tone={TONE.SUCCESS}>
        {t("language-versions-linked")}
      </Badge>
    ) : null
  }
  return isRowAccepted(row, picks, isAccepted) ? (
    <Badge size="compact" tone={TONE.SUCCESS}>
      {t("language-versions-accepted")}
    </Badge>
  ) : (
    <Button variant="secondary" size="small" onPress={() => onAccept(row.id)}>
      {t("language-versions-accept")}
    </Button>
  )
}

interface Props {
  caption: string
  referenceCourse: LanguageVersionCourse
  courses: LanguageVersionCourse[]
  rows: MatchRow[]
  control: Control<MatchFields>
  onAccept: (rowId: string) => void
  emptyState: React.ReactNode
}

/**
 * Rows of the reference course with a counterpart picker per other course, how sure each
 * suggestion is, and an Accept button. Used by the link fixer and the step-by-step linking.
 */
const CounterpartMatchTable: React.FC<Props> = ({
  caption,
  referenceCourse,
  courses,
  rows,
  control,
  onAccept,
  emptyState,
}) => {
  const { t } = useTranslation()
  const languageName = useLanguageName()

  return (
    <Table
      caption={caption}
      rows={rows}
      rowKey={(row) => row.id}
      emptyState={emptyState}
      overflowCue
      {...(rows.some((row) => row.group)
        ? {
            rowGroup: (row: MatchRow) => row.group ?? { key: "", label: "" },
          }
        : {})}
      columns={[
        {
          header: languageName(referenceCourse.language_code),
          cell: (row) => row.label,
          minWidth: "12rem",
        },
        ...courses.map((course) => ({
          header: languageName(course.language_code),
          minWidth: "14rem",
          cell: (row: MatchRow) => {
            const counterpart = row.counterparts.find((item) => item.courseId === course.id)
            if (!counterpart) {
              return null
            }
            const options = [
              ...counterpart.options.map((option) => ({ value: option.id, label: option.label })),
              { value: NO_COUNTERPART, label: t("language-versions-no-counterpart-option") },
            ]
            return (
              <div className={selectCellCss}>
                <Select
                  name={`picks.${row.id}.${course.id}`}
                  control={control}
                  label={languageName(course.language_code)}
                  options={options}
                />
                {counterpart.hint && <span className={hintCss}>{counterpart.hint}</span>}
              </div>
            )
          },
        })),
        {
          header: t("language-versions-how-sure"),
          nowrap: true,
          cell: (row) => {
            const least = rowSureness(row)
            if (least?.sureness) {
              return <SurenessBadge sureness={least.sureness} reason={least.reason} />
            }
            if (!row.counterparts.some((counterpart) => counterpart.suggestedId !== null)) {
              return <span className={hintCss}>{t("language-versions-no-suggestion")}</span>
            }
            return null
          },
        },
        {
          header: <span className={mutedCss}>{t("language-versions-column-actions")}</span>,
          align: ALIGN_END,
          nowrap: true,
          cell: (row) => <RowActions row={row} control={control} onAccept={onAccept} />,
        },
      ]}
    />
  )
}

export default CounterpartMatchTable
