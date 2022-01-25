import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { InnerBlocks } from "@wordpress/block-editor"
import { BlockEditProps } from "@wordpress/blocks"
import { useContext } from "react"
import { useTranslation } from "react-i18next"

import { EditorContentDispatch } from "../../contexts/EditorContentContext"
import Button from "../../shared-module/components/Button"
import TextField from "../../shared-module/components/InputFields/TextField"
import { primaryFont, typography } from "../../shared-module/styles"
import {
  cmsNormalWidthCenteredComponentStyles,
  gutenbergControlsHidden,
} from "../../styles/EditorStyles"

import { ExerciseAttributes } from "."

const ALLOWED_NESTED_BLOCKS = ["moocfi/exercise-slide"]

const ExerciseEditorCard = styled.div`
  padding: 2rem 0;
  margin-top: 3rem;
  margin-bottom: 3rem;
  margin-left: 0;
  margin-right: 0;
  border-top: 1px solid #c0c0c0;
  border-bottom: 1px solid #c0c0c0;
`

const ExerciseEditor: React.FC<BlockEditProps<ExerciseAttributes>> = ({
  attributes,
  clientId,
  setAttributes,
}) => {
  const dispatch = useContext(EditorContentDispatch)

  const { t } = useTranslation()

  const handleAddNewSlide = () => {
    dispatch({ type: "addExerciseSlide", payload: { clientId } })
  }

  return (
    <ExerciseEditorCard id={attributes.id}>
      <div className={cmsNormalWidthCenteredComponentStyles}>
        <div
          className={css`
            font-family: ${primaryFont};
            font-size: ${typography.h4};
            margin-bottom: 1.5rem;
          `}
        >
          {t("exercise-title")}
        </div>
        <TextField
          label={t("exercise-name")}
          placeholder={t("exercise-name")}
          value={attributes.name}
          onChange={(value) => setAttributes({ name: value })}
          className={css`
            margin-bottom: 1rem !important;
          `}
        />
      </div>
      <div className={gutenbergControlsHidden}>
        <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} />
      </div>
      <div className={cmsNormalWidthCenteredComponentStyles}>
        <Button variant="primary" size="medium" onClick={handleAddNewSlide}>
          {t("add-slide")}
        </Button>
      </div>
    </ExerciseEditorCard>
  )
}

export default ExerciseEditor
