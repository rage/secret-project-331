import { css } from "@emotion/css"
import { CheckCircle } from "@vectopus/atlas-icons-react"
import React, { useEffect, useId, useRef, useState } from "react"
import { ToggleButton, ToggleButtonGroup } from "react-aria-components"
import { useTranslation } from "react-i18next"

import { UserItemAnswerChooseN } from "../../../../../types/quizTypes/answer"
import { PublicSpecQuizItemChooseN } from "../../../../../types/quizTypes/publicSpec"

import {
  QUIZ_TITLE_STYLE,
  TWO_DIMENSIONAL_BUTTON_SELECTED,
  TWO_DIMENSIONAL_BUTTON_STYLES,
} from "./AnswerQuizStyles"

import { QuizItemComponentProps } from "."

import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const ChooseN: React.FunctionComponent<
  React.PropsWithChildren<QuizItemComponentProps<PublicSpecQuizItemChooseN, UserItemAnswerChooseN>>
> = ({ quizItem, quizItemAnswerState, setQuizItemAnswerState }) => {
  const { t } = useTranslation()
  const groupId = useId()

  const selectedIds = quizItemAnswerState?.selectedOptionIds ?? []
  const selectedCount = selectedIds.length
  const limit = quizItem.n
  const atLimit = selectedCount >= limit

  const [announcement, setAnnouncement] = useState<string>("")
  const lastAnnouncedRef = useRef<string>("")

  useEffect(() => {
    setAnnouncement("")
    lastAnnouncedRef.current = ""
  }, [quizItem.id])

  const announce = (msg: string) => {
    if (lastAnnouncedRef.current === msg) {
      setAnnouncement("")
      requestAnimationFrame(() => setAnnouncement(msg))
    } else {
      setAnnouncement(msg)
    }
    lastAnnouncedRef.current = msg
  }

  const handleSelectionChange = (keys: Set<React.Key>) => {
    const nextSelectedIds = Array.from(keys).filter((k): k is string => typeof k === "string")

    if (nextSelectedIds.length > limit) {
      announce(t("choose-n-limit-reached", { count: limit }))
      return
    }

    setQuizItemAnswerState({
      quizItemId: quizItem.id,
      type: "choose-n",
      selectedOptionIds: nextSelectedIds,
      valid: nextSelectedIds.length === limit,
    })

    if (announcement) {
      setAnnouncement("")
    }
  }

  // eslint-disable-next-line i18next/no-literal-string
  const statusId = `${groupId}-status`
  // eslint-disable-next-line i18next/no-literal-string
  const hintId = `${groupId}-hint`
  // eslint-disable-next-line i18next/no-literal-string
  const liveId = `${groupId}-live`

  return (
    <div
      className={css`
        display: flex;
        flex: 1;
        flex-direction: column;
        ${respondToOrLarger.md} {
          flex-direction: row;
        }
      `}
    >
      <h2
        className={css`
          display: flex;
          ${QUIZ_TITLE_STYLE}
        `}
      >
        {quizItem.title || quizItem.body}
      </h2>

      <div>
        <ToggleButtonGroup
          // eslint-disable-next-line i18next/no-literal-string
          selectionMode="multiple"
          selectedKeys={new Set(selectedIds)}
          onSelectionChange={handleSelectionChange}
          aria-label={quizItem.title || quizItem.body || undefined}
          aria-describedby={`${statusId} ${hintId} ${liveId}`}
          className={css`
            display: flex;
            flex-wrap: wrap;
          `}
        >
          {quizItem.options.map((o) => {
            const isSelected = selectedIds.includes(o.id)
            const visuallyMuted = atLimit && !isSelected

            return (
              <ToggleButton
                key={o.id}
                id={o.id}
                className={css`
                  ${TWO_DIMENSIONAL_BUTTON_STYLES}
                  ${isSelected && TWO_DIMENSIONAL_BUTTON_SELECTED}

                  /* “Looks disabled” but stays interactive */
                  ${visuallyMuted &&
                  css`
                    opacity: 0.65;
                    cursor: not-allowed;
                  `}
                `}
              >
                <span
                  className={css`
                    flex: 1;
                    text-align: center;
                  `}
                >
                  {o.title || o.body}
                </span>
                {isSelected && (
                  <span
                    className={css`
                      position: absolute;
                      right: 0.875rem;
                      top: 50%;
                      transform: translateY(-50%);
                      display: flex;
                      align-items: center;
                      width: 1.25rem;
                      height: 1.25rem;
                    `}
                  >
                    <CheckCircle size={20} />
                  </span>
                )}
              </ToggleButton>
            )
          })}
        </ToggleButtonGroup>

        {/* Always-visible, de-emphasized status (not aria-live) */}
        <div
          className={css`
            margin-top: 0.75rem;
            font-size: 0.875rem;
            color: #4a4a4a;
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            ${respondToOrLarger.md} {
              flex-direction: row;
              align-items: center;
              flex-wrap: nowrap;
              gap: 0.5rem;
            }
          `}
        >
          <span
            id={statusId}
            className={css`
              ${respondToOrLarger.md} {
                white-space: nowrap;
              }
            `}
          >
            {selectedCount} / {limit} {t("choose-n-chosen")}
          </span>
          {atLimit && selectedCount === limit && (
            <span
              id={hintId}
              className={css`
                ${respondToOrLarger.md} {
                  white-space: nowrap;
                }
              `}
            >
              {t("choose-n-at-limit-hint")}
            </span>
          )}
        </div>

        {/* Persistent live region for invalid action feedback */}
        <div
          id={liveId}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className={css`
            margin-top: 1rem;
          `}
        >
          {announcement ? (
            <div
              className={css`
                padding: 0.875rem;
                border-radius: 0.5rem;
                background-color: #fff4e6;
                border: 2px solid #cc7a00;
                color: #b83900;
                font-size: 1rem;
                line-height: 1.5;
              `}
            >
              {announcement}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default withErrorBoundary(ChooseN)
