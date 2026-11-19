"use client"

import { css, cx } from "@emotion/css"
import { omit } from "lodash"
import React from "react"
import { useTranslation } from "react-i18next"

import { baseTheme } from "@/shared-module/common/styles"

import { ITEM_FIELD_LABEL_KEYS, labelKeyOf, VALUE_LABEL_KEYS } from "./proposalLabels"

const emptyStyle = css`
  color: ${baseTheme.colors.gray[500]};
  font-style: italic;
`

const textStyle = css`
  white-space: pre-wrap;
`

const listStyle = css`
  margin: 0;
  padding-left: 1.25rem;
`

const changeStyle = css`
  margin: 0 0 0.75rem;

  &:last-child {
    margin-bottom: 0;
  }
`

const changeLabelStyle = css`
  margin: 0 0 0.25rem;
  font-weight: 600;
`

const versionsStyle = css`
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 0.25rem 0.75rem;
  margin: 0;
`

const versionTermStyle = css`
  color: ${baseTheme.colors.gray[600]};
`

const versionValueStyle = css`
  margin: 0;
`

const proposedValueStyle = css`
  font-weight: 500;
`

/** Shows an empty value as such instead of as nothing. */
const EmptyValue: React.FC = () => {
  const { t } = useTranslation()
  return <span className={emptyStyle}>{t("course-plans-assistant-value-empty")}</span>
}

/** Plain text from a proposal, keeping its line breaks; empty text shows as empty. */
export const TextValue: React.FC<{ text: string | null | undefined }> = ({ text }) =>
  text && text.trim() !== "" ? <span className={textStyle}>{text}</span> : <EmptyValue />

/**
 * A workspace value from the plan's stored JSON: lists as lists, and list items such as chapters
 * or workload activities with their fields named the way the forms name them.
 */
export const JsonValue: React.FC<{ value: unknown }> = ({ value }) => {
  const { t } = useTranslation()
  if (value === null || value === undefined || value === "") {
    return <EmptyValue />
  }
  if (typeof value === "boolean") {
    return <span>{value ? t("yes") : t("no")}</span>
  }
  if (typeof value === "string") {
    const labelKey = labelKeyOf(VALUE_LABEL_KEYS, value)
    return labelKey ? <span>{t(labelKey)}</span> : <TextValue text={value} />
  }
  if (typeof value === "number") {
    return <span>{value}</span>
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <EmptyValue />
    }
    return (
      <ul className={listStyle}>
        {value.map((item, index) => (
          // Proposed items may have no id yet, and the list is never reordered in place.
          // oxlint-disable-next-line react/no-array-index-key
          <li key={index}>
            <JsonValue value={item} />
          </li>
        ))}
      </ul>
    )
  }
  if (typeof value === "object") {
    const item = value as Record<string, unknown>
    const title = item.title
    // oxlint-disable-next-line i18next/no-literal-string -- field names, never rendered
    const entries = Object.entries(omit(item, ["id", "title"]))
    return (
      <>
        {typeof title === "string" && <TextValue text={title} />}
        {entries.length > 0 && (
          <ul className={listStyle}>
            {entries.map(([key, fieldValue]) => {
              const labelKey = labelKeyOf(ITEM_FIELD_LABEL_KEYS, key)
              return (
                <li key={key}>
                  {labelKey ? t(labelKey) : key}: <JsonValue value={fieldValue} />
                </li>
              )
            })}
          </ul>
        )}
      </>
    )
  }
  return <span>{String(value)}</span>
}

/** One changed field: its name, then its value now and as proposed. */
export const ProposedChange: React.FC<{
  label: string
  current: React.ReactNode
  proposed: React.ReactNode
}> = ({ label, current, proposed }) => {
  const { t } = useTranslation()
  return (
    <div className={changeStyle}>
      <p className={changeLabelStyle}>{label}</p>
      <dl className={versionsStyle}>
        <dt className={versionTermStyle}>{t("course-plans-assistant-current")}</dt>
        <dd className={versionValueStyle}>{current}</dd>
        <dt className={versionTermStyle}>{t("course-plans-assistant-proposed")}</dt>
        <dd className={cx(versionValueStyle, proposedValueStyle)}>{proposed}</dd>
      </dl>
    </div>
  )
}
