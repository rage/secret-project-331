import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { InnerBlocks } from "@wordpress/block-editor"
import { BlockEditProps, TemplateArray } from "@wordpress/blocks"
import { useContext } from "react"
import { useTranslation } from "react-i18next"

import { EditorContentDispatch } from "../../contexts/EditorContentContext"
import ExerciseBlockContext from "../../contexts/ExerciseBlockContext"
import Button from "../../shared-module/components/Button"
import BreakFromCentered from "../../shared-module/components/Centering/BreakFromCentered"
import Centered from "../../shared-module/components/Centering/Centered"
import { baseTheme, primaryFont, typography } from "../../shared-module/styles"
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

const INNER_BLOCKS_TEMPLATE: TemplateArray = [
  ["moocfi/exercise-settings", {}],
  ["moocfi/exercise-slides", {}],
]

const ExerciseEditor: React.FC<React.PropsWithChildren<BlockEditProps<ExerciseAttributes>>> = ({
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
    <ExerciseBlockContext.Provider value={{ attributes, setAttributes }}>
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
                  color: ${baseTheme.colors.gray[500]};
                  font-weight: bold;
                  margin-bottom: 1.5rem;
                `}
              >
                {t("exercise-title")}
              </div>

              <InnerBlocks
                allowedBlocks={ALLOWED_NESTED_BLOCKS}
                template={INNER_BLOCKS_TEMPLATE}
                templateLock="all"
              />

              <div>
                <Button variant="primary" size="medium" onClick={handleAddNewSlide}>
                  {t("add-slide")}
                </Button>
              </div>
              <div
                className={css`
                  margin-top: 1rem;
                `}
              ></div>
            </ExerciseEditorCard>
          </Centered>
        </div>
      </BreakFromCentered>
    </ExerciseBlockContext.Provider>
  )
}

export default ExerciseEditor
