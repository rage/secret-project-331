"use client"

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { useBlockProps } from "@wordpress/block-editor"
import React, { useContext, useRef } from "react"

import { primaryFont, typography } from "@/shared-module/common/styles"
import { Button } from "@/shared-module/components"
import RegisteredInnerBlocks from "@/utils/Gutenberg/RegisteredInnerBlocks"
import type { BlockEditProps } from "@/utils/Gutenberg/types"
import { useTranslation } from "@/utils/useCmsTranslation"

import { EditorContentDispatch } from "../../../contexts/EditorContentContext"
import { gutenbergControlsHidden } from "../../../styles/EditorStyles"

const EDIT_TASK_SELECTOR = "[data-exercise-task-edit]"
const OBSERVE_TIMEOUT_MS = 3000

const ExerciseSlideEditorCard = styled.div`
  padding: 2rem 2rem;
  margin-bottom: 2rem;
`

export interface ExerciseSlideAttributes {
  id: string
  order_number: number
}

const ExerciseSlideEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<ExerciseSlideAttributes>>
> = ({ attributes, clientId }) => {
  const dispatch = useContext(EditorContentDispatch)

  const { t } = useTranslation()
  const blockProps = useBlockProps()

  const containerRef = useRef<HTMLDivElement>(null)

  const handleAddNewTask = () => {
    const container = containerRef.current
    const countEditButtons = () => container?.querySelectorAll(EDIT_TASK_SELECTOR).length ?? 0
    const before = countEditButtons()
    dispatch({ type: "addExerciseTask", payload: { clientId } })
    if (!container) {
      return
    }
    // The new task renders after the editor state round-trips, so wait for its Edit button.
    const observer = new MutationObserver(() => {
      const buttons = container.querySelectorAll<HTMLElement>(EDIT_TASK_SELECTOR)
      if (buttons.length > before) {
        buttons[buttons.length - 1]?.focus()
        observer.disconnect()
      }
    })
    observer.observe(container, { childList: true, subtree: true })
    window.setTimeout(() => observer.disconnect(), OBSERVE_TIMEOUT_MS)
  }

  return (
    <div {...blockProps}>
      <ExerciseSlideEditorCard id={attributes.id} ref={containerRef}>
        <div
          className={css`
            font-family: ${primaryFont};
            font-size: ${typography.h5};
            margin-bottom: 1.5rem;
          `}
        >
          {t("slide-title", { number: attributes.order_number + 1 })}
        </div>
        <div className={gutenbergControlsHidden}>
          <RegisteredInnerBlocks />
        </div>
        <div>
          <Button variant="secondary" size="medium" onClick={handleAddNewTask}>
            {t("add-task")}
          </Button>
        </div>
      </ExerciseSlideEditorCard>
    </div>
  )
}

export default ExerciseSlideEditor
