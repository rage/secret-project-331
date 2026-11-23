"use client"

import { css, cx } from "@emotion/css"
import { announce } from "@react-aria/live-announcer"
import React, { useEffect, useId, useState } from "react"
import { useTranslation } from "react-i18next"

import { baseTheme } from "@/shared-module/common/styles"
import { announceAfterFocus } from "@/shared-module/common/utils/announceAfterFocus"

/** An already-localized reason the exercise cannot be submitted yet. */
export interface SubmissionBlocker {
  message: string
  /** Scrolls to and focuses what causes the blocker; makes the message a button. */
  show?: () => void
}

export interface ExerciseSubmitButtonProps {
  isPending: boolean
  /** Empty means submittable. A blocked submit shows the first blocker that has `show`. */
  blockers: SubmissionBlocker[]
  onSubmit: () => void
  buttonClassName?: string
}

const blockerListStyles = css`
  margin-bottom: 0.5rem;
  /* Muted grey tuned to sit just above WCAG AA (4.5:1) on the exercise card's #f2f2f2 background:
     4.66:1 here (5.2:1 on white). gray[400] would fall to ~3.8:1, so this is as light as the text
     can go while staying accessible. */
  color: #666d79;
  font-size: 0.875rem;
  line-height: 140%;
  text-align: center;

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  button {
    all: unset;
    cursor: pointer;
    text-decoration: underline;

    &:focus-visible {
      outline: 2px solid currentColor;
      outline-offset: 2px;
    }
  }
`

const blockerListEmphasizedStyles = css`
  color: ${baseTheme.colors.red[700]};
  font-weight: 500;
`

const showBlocker = (blocker: SubmissionBlocker, message: string) => {
  blocker.show?.()
  announceAfterFocus(message)
}

// Uses aria-disabled instead of disabled so the button stays focusable for screen readers, and shows
// the reasons it is disabled right next to it so the student understands why it is greyed out.
const ExerciseSubmitButton: React.FC<ExerciseSubmitButtonProps> = ({
  isPending,
  blockers,
  onSubmit,
  buttonClassName,
}) => {
  const { t } = useTranslation()
  const hintId = useId()
  const [emphasizeReasons, setEmphasizeReasons] = useState(false)

  const hasBlockers = blockers.length > 0
  const blocked = isPending || hasBlockers

  // Drop the emphasis once the exercise becomes submittable again.
  useEffect(() => {
    if (!hasBlockers) {
      setEmphasizeReasons(false)
    }
  }, [hasBlockers])

  return (
    <>
      {hasBlockers && (
        <div
          id={hintId}
          className={cx(blockerListStyles, emphasizeReasons && blockerListEmphasizedStyles)}
        >
          <ul>
            {blockers.map((blocker) => (
              <li key={blocker.message}>
                {blocker.show ? (
                  <button type="button" onClick={() => showBlocker(blocker, blocker.message)}>
                    {blocker.message}
                  </button>
                ) : (
                  blocker.message
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <button
        className={buttonClassName}
        aria-disabled={blocked}
        aria-describedby={hasBlockers ? hintId : undefined}
        onClick={() => {
          if (blocked) {
            if (hasBlockers) {
              setEmphasizeReasons(true)
              // Spoken only after a blocked Submit; the visible list changes silently while answering.
              const message = blockers.map((blocker) => blocker.message).join(" ")
              const showableBlocker = blockers.find((blocker) => blocker.show)
              if (showableBlocker) {
                showBlocker(showableBlocker, message)
              } else {
                // oxlint-disable-next-line i18next/no-literal-string -- ARIA politeness level, not user copy
                announce(message, "polite")
              }
            }
            return
          }
          onSubmit()
        }}
      >
        {t("submit-button")}
      </button>
    </>
  )
}

export default ExerciseSubmitButton
