import { css, cx } from "@emotion/css"
import styled from "@emotion/styled"
import { PencilBox, Trash, XmarkCircle } from "@vectopus/atlas-icons-react"
import { InnerBlocks } from "@wordpress/block-editor"
import { BlockEditProps } from "@wordpress/blocks"
import React, { useContext, useState } from "react"
import { useTranslation } from "react-i18next"

import { EditorContentDispatch } from "../../../contexts/EditorContentContext"
import useAllExerciseServices from "../../../hooks/useAllExerciseServices"
import { gutenbergControlsVisible } from "../../../styles/EditorStyles"
import breakFromCenteredProps from "../../../utils/breakfromCenteredProps"

import ChooseExerciseTaskType from "./ChooseExerciseTaskType"
import ExerciseTaskIFrameEditor from "./IFrameEditor"

import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import Centered from "@/shared-module/common/components/Centering/Centered"
import DebugModal from "@/shared-module/common/components/DebugModal"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { baseTheme, primaryFont, typography } from "@/shared-module/common/styles"
import { runCallbackIfEnterPressed } from "@/shared-module/common/utils/accessibility"

const ALLOWED_NESTED_BLOCKS = [
  "core/paragraph",
  "core/image",
  "core/heading",
  "core/list",
  "core/list-item",
  "core/quote",
  "core/audio",
  "core/code",
  "core/columns",
  "core/column", // core/column is child of core/columns
  "core/embed", // This is used by youtube, twitter etc.
  "core/file",
  "core/html",
  "core/preformatted",
  "core/pullquote",
  "core/separator",
  "core/block",
  "core/spacer",
  "core/table",
  "core/verse",
  "moocfi/latex",
  "moocfi/iframe",
]

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

const gray400WithHover = css`
  background-color: ${baseTheme.colors.gray[200]};

  :hover {
    filter: brightness(92%) contrast(110%);
  }
`

const gray500WithHover = css`
  background-color: ${baseTheme.colors.gray[300]};

  :hover {
    filter: brightness(92%) contrast(110%);
  }
`

export interface ExerciseTaskAttributes {
  id: string
  exercise_type: string
  private_spec: string | null
  show_editor: boolean
  order_number: number
}

const ExerciseTaskEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<ExerciseTaskAttributes>>
> = ({ attributes, clientId, setAttributes }) => {
  const dispatch = useContext(EditorContentDispatch)

  const exerciseServicesQuery = useAllExerciseServices()

  // Updated on the first render or when we collapse the editor. We use this to prevent posting the existing state back to the iframe when the iframe's internal state is updated. (The iframe input and output types are the same in this case.)
  const [privateSpecToPostToIframe, setPrivateSpecToPostToIframe] = useState(
    attributes.private_spec,
  )
  const { t } = useTranslation()

  const handleDeleteTask = () => {
    dispatch({ type: "deleteExerciseTask", payload: { clientId } })
  }

  const toggleEditor = () => {
    setAttributes({ show_editor: !attributes.show_editor })
    setPrivateSpecToPostToIframe(attributes.private_spec)
  }

  if (exerciseServicesQuery.isError) {
    return <ErrorBanner variant={"readOnly"} error={exerciseServicesQuery.error} />
  }

  if (exerciseServicesQuery.isPending) {
    return <Spinner variant="medium" />
  }

  const exerciseType = attributes.exercise_type
  const url = exerciseServicesQuery.data.find((o) => o.slug === exerciseType)?.public_iframe_url

  if (exerciseType && !url) {
    return (
      <>
        <ErrorBanner
          variant="readOnly"
          error={t("error-cannot-render-editor-for-exercise-service-x", { slug: exerciseType })}
        />
        <DebugModal data={exerciseServicesQuery.data} />
      </>
    )
  }

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
              background-color: ${baseTheme.colors.gray[100]};
              display: flex;
              flex: 1;
              font-family: ${primaryFont};
              font-size: ${typography.paragraph};
              padding: 0 1rem;
              border-radius: 2px;
            `}
          >
            {t("task")}
          </div>
          <div
            className={cx(svgSquare, gray500WithHover)}
            onKeyDown={(e) => runCallbackIfEnterPressed(e, toggleEditor)}
            onClick={toggleEditor}
            role="button"
            tabIndex={0}
            aria-label={attributes.show_editor ? t("close") : t("edit")}
          >
            {attributes.show_editor ? (
              <XmarkCircle
                size={16}
                className={css`
                  color: ${baseTheme.colors.gray[100]};
                  margin: 1.5rem;
                `}
              />
            ) : (
              <PencilBox
                size={16}
                className={css`
                  color: ${baseTheme.colors.gray[100]};
                  margin: 1.5rem;
                `}
              />
            )}
          </div>
          <div
            className={cx(svgSquare, gray400WithHover)}
            onKeyDown={(e) => runCallbackIfEnterPressed(e, handleDeleteTask)}
            onClick={handleDeleteTask}
            role="button"
            tabIndex={0}
            aria-label={t("delete")}
          >
            <Trash
              size={16}
              className={css`
                color: ${baseTheme.colors.gray[700]};
                margin: 1.5rem;
              `}
            />
          </div>
        </div>
      </div>
      {attributes.show_editor ? (
        <BreakFromCentered {...breakFromCenteredProps}>
          <div
            className={css`
              background-color: white;
            `}
          >
            <Centered variant="narrow">
              <ExerciseTaskEditorCard>
                <div
                  className={css`
                    padding: 1rem;
                    border: 1px solid black;
                    margin-bottom: 2rem;

                    .block-list-appender:not(:first-child) {
                      position: relative;
                      top: -40px;
                      margin: 0;

                      .block-editor-inserter {
                        line-height: 0;
                        position: absolute;
                        top: 0;
                        right: 0;
                      }

                      .block-editor-default-block-appender__content {
                        height: 0px;
                      }
                    }

                    ${gutenbergControlsVisible}
                  `}
                >
                  <h3>{t("title-assignment")}</h3>
                  <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} />
                </div>
                {!exerciseType ? (
                  <ChooseExerciseTaskType
                    onChooseItem={(x) => setAttributes({ exercise_type: x.slug })}
                  />
                ) : (
                  <ExerciseTaskIFrameEditor
                    exerciseTaskId={attributes.id}
                    onPrivateSpecChange={(x) => setAttributes({ private_spec: x })}
                    privateSpec={privateSpecToPostToIframe}
                    url={url}
                  />
                )}
              </ExerciseTaskEditorCard>
            </Centered>
          </div>
        </BreakFromCentered>
      ) : null}
    </div>
  )
}

export default ExerciseTaskEditor
