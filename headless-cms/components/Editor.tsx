import '@wordpress/block-editor/build-style/style.css'
import '@wordpress/block-library/build-style/style.css'
import '@wordpress/block-library/build-style/theme.css'
import '@wordpress/block-library/build-style/editor.css'
import '@wordpress/components/build-style/style.css'
import '@wordpress/editor/build-style/style.css'
import '@wordpress/editor/build-style/editor-styles.css'
import '@wordpress/edit-post/build-style/style.css'
import '@wordpress/format-library/build-style/style.css'
import '@wordpress/nux/build-style/style.css'

import { useState, useEffect } from 'react'
import {
  BlockEditorKeyboardShortcuts,
  BlockEditorProvider,
  BlockList,
  BlockInspector,
  WritingFlow,
  ObserveTyping,
} from '@wordpress/block-editor'
import { Popover, SlotFillProvider, DropZoneProvider } from '@wordpress/components'
import { registerCoreBlocks } from '@wordpress/block-library'
import { registerBlockType } from '@wordpress/blocks'

import Exercise from '../blocks/Exercise'
import { updateExistingPage } from '../utils/postData'
import { Button } from '@material-ui/core'
import { PageData } from '../utils/types'

interface EditorProps {
  data: PageData
}

function Editor(props: EditorProps) {
  const { id, content, exercises, url_path, title } = props.data
  const [blocks, setBlocks] = useState(content ?? [])
  const [pageExercises, setPageExercises] = useState(exercises ?? [])

  const handleSave = () => {
    updateExistingPage(id, blocks, exercises, url_path, title).then((res) => {
      setBlocks(res.content)
    })
  }

  const handleChanges = (page) => {
    setBlocks(page)
    console.log(blocks)
  }
  const handleInput = (page) => {
    setBlocks(page)
    console.log(blocks)
  }

  useEffect(() => {
    registerCoreBlocks()
    registerBlockType('moocfi/iframe-exercise', Exercise)
  }, [])

  return (
    <div className="playground">
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
