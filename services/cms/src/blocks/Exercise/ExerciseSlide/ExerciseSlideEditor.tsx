import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { InnerBlocks } from "@wordpress/block-editor"
import { BlockEditProps, TemplateArray } from "@wordpress/blocks"
import React, { useContext } from "react"
import { useTranslation } from "react-i18next"

import { EditorContentDispatch } from "../../../contexts/EditorContentContext"
import { gutenbergControlsHidden } from "../../../styles/EditorStyles"

import Button from "@/shared-module/common/components/Button"
import { primaryFont, typography } from "@/shared-module/common/styles"

const ALLOWED_NESTED_BLOCKS = ["moocfi/exercise-task"]
const INNER_BLOCKS_TEMPLATE: TemplateArray = [["moocfi/exercise-task", {}]]

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
        {t("slide-title", { number: attributes.order_number + 1 })}
      </div>
      <div className={gutenbergControlsHidden}>
        <InnerBlocks
          allowedBlocks={ALLOWED_NESTED_BLOCKS}
          template={INNER_BLOCKS_TEMPLATE}
          templateLock={false}
        />
      </div>
      <div>
        <Button variant="secondary" size="medium" onClick={handleAddNewTask}>
          {t("add-task")}
        </Button>
      </div>
    </ExerciseSlideEditorCard>
  )
}

export default ExerciseSlideEditor
