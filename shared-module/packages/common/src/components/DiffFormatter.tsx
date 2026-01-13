"use client"

import { css } from "@emotion/css"
import { useId } from "react"
import { useTranslation } from "react-i18next"

/**
 * Matches the diff object from the diff npm package. Reimplemented here so that we don't have to depend on diff in shared-module
 */
interface DiffChange {
  count?: number | undefined
  value: string
  added?: boolean | undefined
  removed?: boolean | undefined
}

interface DiffFormatterProps {
  changes: DiffChange[]
  dontShowAdded?: boolean
  dontShowRemoved?: boolean
}

/**
 * Formats the diff object from the diff npm package. Remember to wrap this inside a container like a div or a p.
 */
const DiffFormatter: React.FC<React.PropsWithChildren<DiffFormatterProps>> = ({
  changes,
  dontShowAdded,
  dontShowRemoved,
}) => {
  const { t } = useTranslation()
  const id = useId()

  return (
    <>
      {changes.map((change, n) => {
        if (change.added) {
          if (dontShowAdded) {
            return null
          }
          return (
            <mark
              key={id + JSON.stringify(change) + n}
              role="note"
              aria-label={t("added-text")}
              className={css`
                background-color: #abf2bc;
                padding: 2px;
              `}
            >
              {change.value}
            </mark>
          )
        } else if (change.removed) {
          if (dontShowRemoved) {
            return null
          }
          return (
            <mark
              key={id + JSON.stringify(change) + n}
              role="note"
              aria-label={t("removed-text")}
              className={css`
                background-color: #ffc1c0;
                padding: 2px;
              `}
            >
              {change.value}
            </mark>
          )
        } else {
          return <span key={id + JSON.stringify(change) + n}>{change.value}</span>
        }
      })}
    </>
  )
}

export default DiffFormatter
