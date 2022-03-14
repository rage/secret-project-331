import { css, cx } from "@emotion/css"
import styled from "@emotion/styled"
import { faPenSquare, faTrashAlt, faWindowClose } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { InnerBlocks } from "@wordpress/block-editor"
import { BlockEditProps } from "@wordpress/blocks"
import React, { useContext, useState } from "react"
import { useTranslation } from "react-i18next"

import { EditorContentDispatch } from "../../contexts/EditorContentContext"
import { baseTheme, primaryFont, typography } from "../../shared-module/styles"
import { narrowContainerWidthPx } from "../../shared-module/styles/constants"
import { runCallbackIfEnterPressed } from "../../shared-module/utils/accessibility"
import { gutenbergControlsVisible } from "../../styles/EditorStyles"

import ChooseExerciseTaskType from "./ChooseExerciseTaskType"
import { exerciseTaskTypes } from "./ChooseExerciseTaskType/ExerciseServiceList"
import ExerciseTaskIFrameEditor from "./IFrameEditor"

const ALLOWED_NESTED_BLOCKS = ["core/image", "core/paragraph", "core/list", "moocfi/latex"]

const ExerciseTaskEditorCard = styled.div`
  padding: 2rem 0;
  margin-bottom: 2rem;
`

const svgSquare = css`
  align-items: center;
  display: flex;
  flex: 0 0 4rem;
  height: 4rem;
  justify-content: center;
`

// eslint-disable-next-line i18next/no-literal-string
const grey400WithHover = css`
  background-color: ${baseTheme.colors.grey[400]};

  :hover {
    background-color: ${baseTheme.colors.grey[600]};
  }
`

// eslint-disable-next-line i18next/no-literal-string
const grey500WithHover = css`
  background-color: ${baseTheme.colors.grey[500]};

  :hover {
    background-color: ${baseTheme.colors.grey[600]};
  }
`

// eslint-disable-next-line i18next/no-literal-string
const StyledIconDark = styled(FontAwesomeIcon)`
  font-size: 1rem;
  color: ${baseTheme.colors.grey[700]};
  margin: 1.5rem;
`

// eslint-disable-next-line i18next/no-literal-string
const StyledIconLight = styled(FontAwesomeIcon)`
  font-size: 1rem;
  color: ${baseTheme.colors.grey[100]};
  margin: 1.5rem;
`

export interface ExerciseTaskAttributes {
  id: string
  exercise_type: string
  private_spec: unknown
  show_editor: boolean
}

const ExerciseTaskEditor: React.FC<BlockEditProps<ExerciseTaskAttributes>> = ({
  attributes,
  clientId,
  setAttributes,
}) => {
  const dispatch = useContext(EditorContentDispatch)

  const [privateSpecOnFirstRender] = useState(attributes.private_spec)
  const { t } = useTranslation()

  const handleDeleteTask = () => {
    dispatch({ type: "deleteExerciseTask", payload: { clientId } })
  }

  const toggleEditor = () => setAttributes({ show_editor: !attributes.show_editor })

  const exerciseType = attributes.exercise_type
  const url = exerciseTaskTypes.find((o) => o.identifier === exerciseType)?.url

  return (
    <div id={attributes.id}>
      <div>
        <div
          className={css`
            align-items: stretch;
            display: flex;
            flex-direction: row;
          `}
        >
          <div
            className={css`
              align-items: center;
              background-color: ${baseTheme.colors.grey[300]};
              display: flex;
              flex: 1;
              font-family: ${primaryFont};
              font-size: ${typography.paragraph};
              padding: 0 1rem;
            `}
          >
            {t("task")}
          </div>
          <div
            className={cx(svgSquare, grey500WithHover)}
            onKeyDown={(e) => runCallbackIfEnterPressed(e, toggleEditor)}
            onClick={toggleEditor}
            role="button"
            tabIndex={0}
            aria-label={attributes.show_editor ? t("close") : t("edit")}
          >
            <StyledIconLight icon={attributes.show_editor ? faWindowClose : faPenSquare} />
          </div>
          <div
            className={cx(svgSquare, grey400WithHover)}
            onKeyDown={(e) => runCallbackIfEnterPressed(e, handleDeleteTask)}
            onClick={handleDeleteTask}
            role="button"
            tabIndex={0}
            aria-label={t("delete")}
          >
            <StyledIconDark icon={faTrashAlt} />
          </div>
        </div>
      </div>
      {attributes.show_editor ? (
        <ExerciseTaskEditorCard>
          <div
            className={css`
              padding: 1rem;
              border: 1px solid black;
              ${gutenbergControlsVisible}
            `}
          >
            <h3>{t("title-assignment")}</h3>
            <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} />
          </div>
          {!exerciseType ? (
            <ChooseExerciseTaskType
              onChooseItem={(x) => setAttributes({ exercise_type: x.identifier })}
            />
          ) : (
            <ExerciseTaskIFrameEditor
              exerciseTaskId={attributes.id}
              onPrivateSpecChange={(x) => setAttributes({ private_spec: x })}
              privateSpec={privateSpecOnFirstRender}
              url={`${url}?width=${narrowContainerWidthPx}`}
            />
          )}
        </ExerciseTaskEditorCard>
      ) : null}
    </div>
  )
}

export default ExerciseTaskEditor
