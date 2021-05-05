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

import React, { useEffect } from "react"
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
import SerializeGutenbergModal from "./SerializeGutenbergModal"
import DebugModal from "./DebugModal"
import CourseGrid from "../blocks/CourseGrid"
import { css } from "@emotion/css"

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
    registerBlockType("moocfi/course-grid", CourseGrid)
  }, [])

  return (
    <div
      className={css`
        /* This makes Gutenberg popovers to keep their position on scrolling */
        position: relative;
      `}
    >
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
      <SerializeGutenbergModal content={content} />
      <DebugModal data={content} />
    </div>
  )
}

export default Editor
