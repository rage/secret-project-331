import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { TextField } from "@material-ui/core"
import { InnerBlocks } from "@wordpress/block-editor"
import { BlockEditProps } from "@wordpress/blocks"
import { useTranslation } from "react-i18next"

import { normalWidthCenteredComponentStyles } from "../../shared-module/styles/componentStyles"

import { ExerciseAttributes } from "."

const ALLOWED_NESTED_BLOCKS = ["moocfi/exercise-task"]

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
  setAttributes,
}) => {
  const { t } = useTranslation()
  return (
    <ExerciseEditorCard id={attributes.id}>
      <div className={normalWidthCenteredComponentStyles}>
        <div
          className={css`
            font-size: 18pt;
            font-weight: normal;
            margin-bottom: 1.5rem;
          `}
        >
          {t("exercise-title")}
        </div>
        <TextField
          fullWidth
          variant="outlined"
          placeholder={t("exercise-name")}
          value={attributes.name}
          onChange={(e) => setAttributes({ name: e.target.value })}
          className={css`
            margin-bottom: 1rem !important;
          `}
        />
      </div>
      <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} />
    </ExerciseEditorCard>
  )
}

export default ExerciseEditor
