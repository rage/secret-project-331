import "@wordpress/block-editor/build-style/style.css"
import "@wordpress/block-library/build-style/style.css"
import "@wordpress/block-library/build-style/theme.css"
import "@wordpress/block-library/build-style/editor.css"
import "@wordpress/components/build-style/style.css"
import "@wordpress/editor/build-style/style.css"
import "@wordpress/editor/build-style/editor-styles.css"
import "@wordpress/edit-post/build-style/style.css"
import "@wordpress/format-library/build-style/style.css"
import "@wordpress/nux/build-style/style.css"

import { useState, useEffect } from "react"
import {
  BlockEditorKeyboardShortcuts,
  BlockEditorProvider,
  BlockList,
  BlockInspector,
  WritingFlow,
  ObserveTyping,
} from "@wordpress/block-editor"
import { Popover, SlotFillProvider, DropZoneProvider } from "@wordpress/components"
import { registerCoreBlocks } from "@wordpress/block-library"
import { BlockInstance, registerBlockType } from "@wordpress/blocks"

import Exercise, { ExerciseAttributes } from "../blocks/Exercise"
import ExerciseItem from "../blocks/ExerciseItem"
import { Button } from "@material-ui/core"
import { Page, PageWithExercises } from "../services/services.types"
import { normalWidthCenteredComponentStyles } from "../styles/componentStyles"
import { css } from "@emotion/css"
import { updateExistingPage } from "../services/backend/pages"

interface EditorProps {
  data: PageWithExercises
}

const Editor: React.FC<EditorProps> = (props: EditorProps) => {
  const { content, url_path, title, id } = props.data
  const [blocks, setBlocks] = useState(content ?? [])

  const handleChanges = (page: BlockInstance<ExerciseAttributes>[]): void => {
    console.log(page)
    setBlocks(page)
  }
  const handleInput = (page: BlockInstance<ExerciseAttributes>[]): void => {
    console.log(page)
    setBlocks(page)
  }

  const handleSave = (): void => {
    updateExistingPage({
      page_id: id,
      content: blocks,
      url_path,
      title,
    }).then((res: Page) => {
      console.log(res)
      setBlocks(res.content)
    })
  }

  useEffect(() => {
    registerCoreBlocks()
    registerBlockType("moocfi/exercise", Exercise)
    registerBlockType("moocfi/exercise-item", ExerciseItem)
  }, [])

  return (
    <div
      className={css`
        ${normalWidthCenteredComponentStyles}
      `}
    >
      <Button onClick={handleSave}>Save</Button>
      <SlotFillProvider>
        <DropZoneProvider>
          <BlockEditorProvider value={blocks} onInput={handleInput} onChange={handleChanges}>
            <div className="playground__sidebar">
              <BlockInspector />
            </div>
            <div className="editor-styles-wrapper">
              <Popover.Slot />
              <BlockEditorKeyboardShortcuts />
              <WritingFlow>
                <ObserveTyping>
                  <BlockList />
                </ObserveTyping>
              </WritingFlow>
              <Popover.Slot />
            </div>
          </BlockEditorProvider>
        </DropZoneProvider>
      </SlotFillProvider>
    </div>
  )
}

export default Editor
