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

interface EditorProps {
  content: BlockInstance[]
  onContentChange: React.Dispatch<BlockInstance[]>
}

const Editor: React.FC<EditorProps> = (props: EditorProps) => {
  const { content, onContentChange } = props

  const handleChanges = (page: BlockInstance<ExerciseAttributes>[]): void => {
    console.log(page)
    onContentChange(page)
  }
  const handleInput = (page: BlockInstance<ExerciseAttributes>[]): void => {
    console.log(page)
    onContentChange(page)
  }

  useEffect(() => {
    registerCoreBlocks()
    registerBlockType("moocfi/exercise", Exercise)
    registerBlockType("moocfi/exercise-item", ExerciseItem)
  }, [])

  return (
    <div>
      <SlotFillProvider>
        <DropZoneProvider>
          <BlockEditorProvider value={content} onInput={handleInput} onChange={handleChanges}>
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
