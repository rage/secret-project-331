"use client"

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { useBlockProps } from "@wordpress/block-editor"
import React, { useContext } from "react"

import { primaryFont, typography } from "@/shared-module/common/styles"
import { Button } from "@/shared-module/components"
import RegisteredInnerBlocks from "@/utils/Gutenberg/RegisteredInnerBlocks"
import type { BlockEditProps } from "@/utils/Gutenberg/types"
import { useTranslation } from "@/utils/useCmsTranslation"

import { EditorContentDispatch } from "../../../contexts/EditorContentContext"
import { gutenbergControlsHidden } from "../../../styles/EditorStyles"

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

  const handleAddNewTask = () => {
    dispatch({ type: "addExerciseTask", payload: { clientId } })
  }

  return (
    <div {...blockProps}>
      <ExerciseSlideEditorCard id={attributes.id}>
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
