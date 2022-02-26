import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { InnerBlocks } from "@wordpress/block-editor"
import { BlockEditProps } from "@wordpress/blocks"
import { useContext } from "react"
import { useTranslation } from "react-i18next"

import { EditorContentDispatch } from "../../contexts/EditorContentContext"
import Button from "../../shared-module/components/Button"
import BreakFromCentered from "../../shared-module/components/Centering/BreakFromCentered"
import Centered from "../../shared-module/components/Centering/Centered"
import CheckBox from "../../shared-module/components/InputFields/CheckBox"
import TextField from "../../shared-module/components/InputFields/TextField"
import { baseTheme, primaryFont, typography } from "../../shared-module/styles"
import { gutenbergControlsHidden } from "../../styles/EditorStyles"
import breakFromCenteredProps from "../../utils/breakfromCenteredProps"

import { ExerciseAttributes } from "."

const ALLOWED_NESTED_BLOCKS = ["moocfi/exercise-slide"]

const ExerciseEditorCard = styled.div`
  padding: 2rem 1rem;
  margin-top: 3rem;
  margin-bottom: 3rem;
  margin-left: 0;
  margin-right: 0;
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
    <BreakFromCentered {...breakFromCenteredProps}>
      <div
        className={css`
          background-color: ${baseTheme.colors.clear[100]};
        `}
      >
        <Centered variant="narrow">
          <ExerciseEditorCard id={attributes.id}>
            <div
              className={css`
                font-family: ${primaryFont};
                font-size: ${typography.h4};
                color: ${baseTheme.colors.grey[500]};
                font-weight: bold;
                margin-bottom: 1.5rem;
              `}
            >
              {t("exercise-title")}
            </div>
            <div
              className={css`
                background-color: white;
                border: 1px solid ${baseTheme.colors.clear[100]};
                border-radius: 2px;
                padding: 1rem 2rem;
              `}
            >
              <TextField
                label={t("exercise-name")}
                placeholder={t("exercise-name")}
                value={attributes.name}
                onChange={(value) => setAttributes({ name: value })}
                className={css`
                  margin-bottom: 1rem !important;
                `}
              />
              <TextField
                label={t("exercise-max-points")}
                placeholder={t("exercise-max-points")}
                value={attributes.score_maximum?.toString() ?? ""}
                type="number"
                onChange={(value) => {
                  const parsed = parseInt(value)
                  if (isNaN(parsed)) {
                    // empty
                    setAttributes({ score_maximum: undefined })
                    return
                  }
                  setAttributes({ score_maximum: parsed })
                }}
                className={css`
                  margin-bottom: 1rem !important;
                `}
              />
              <div
                className={css`
                  display: flex;
                  align-items: flex-end;
                  margin-bottom: 1rem;
                `}
              >
                <CheckBox
                  label={t("limit-number-of-attempts")}
                  checked={attributes.limit_number_of_attempts}
                  onChange={function (checked: boolean): void {
                    setAttributes({ limit_number_of_attempts: checked })
                  }}
                  className={css`
                    flex: 1;
                    padding-bottom: 0.6rem;
                  `}
                />
                <TextField
                  label={t("attempts-per-slide")}
                  placeholder={t("attempts-per-slide")}
                  value={attributes.max_attempts_per_slide?.toString() ?? ""}
                  disabled={!attributes.limit_number_of_attempts}
                  type="number"
                  onChange={(value) => {
                    const parsed = parseInt(value)
                    if (isNaN(parsed)) {
                      // empty
                      setAttributes({ max_attempts_per_slide: undefined })
                      return
                    }
                    setAttributes({ max_attempts_per_slide: parsed })
                  }}
                  className={css`
                    flex: 1;
                  `}
                />
              </div>
            </div>
            <div className={gutenbergControlsHidden}>
              <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} />
            </div>
            <div>
              <Button variant="primary" size="medium" onClick={handleAddNewSlide}>
                {t("add-slide")}
              </Button>
            </div>
          </ExerciseEditorCard>
        </Centered>
      </div>
    </BreakFromCentered>
  )
}

export default ExerciseEditor
