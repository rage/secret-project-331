import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { InnerBlocks } from "@wordpress/block-editor"
import { BlockEditProps } from "@wordpress/blocks"
import React, { useContext } from "react"
import { useTranslation } from "react-i18next"

import { EditorContentDispatch } from "../../contexts/EditorContentContext"
import Button from "../../shared-module/components/Button"
import { primaryFont, typography } from "../../shared-module/styles"
import { normalWidthCenteredComponentStyles } from "../../shared-module/styles/componentStyles"
import { gutenbergControlsHidden } from "../../styles/EditorStyles"

const ALLOWED_NESTED_BLOCKS = ["moocfi/exercise-task"]

const ExerciseSlideEditorCard = styled.div`
  padding: 2rem 0;
  margin-bottom: 2rem;
`

export interface ExerciseSlideAttributes {
  id: string
  order_number: number
}

const ExerciseSlideEditor: React.FC<BlockEditProps<ExerciseSlideAttributes>> = ({
  attributes,
  clientId,
}) => {
  const dispatch = useContext(EditorContentDispatch)

  const { t } = useTranslation()

  const handleAddNewTask = () => {
    dispatch({ type: "addExerciseTask", payload: { clientId } })
  }

  return (
    <ExerciseSlideEditorCard id={attributes.id}>
      <div
        className={css`
          font-family: ${primaryFont};
          font-size: ${typography.h5};
          margin-bottom: 1.5rem;
        `}
      >
        {t("slide-title", { number: attributes.order_number })}
      </div>
      <div className={gutenbergControlsHidden}>
        <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} />
      </div>
      <div className={normalWidthCenteredComponentStyles}>
        <Button variant="secondary" size="medium" onClick={handleAddNewTask}>
          {t("add-task")}
        </Button>
      </div>
    </ExerciseSlideEditorCard>
  )
}

export default ExerciseSlideEditor
