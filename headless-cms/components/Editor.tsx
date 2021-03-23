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
import { BlockInstance, registerBlockType } from '@wordpress/blocks'

import Exercise from '../blocks/Exercise'
import { updateExistingPage } from '../services/postData'
import { Button } from '@material-ui/core'
import { PageWithExercises } from '../services/services.types'
import { exercisesState } from '../state/exercises'
import { useRecoilValue } from 'recoil'
import { ExerciseAttributes } from '../blocks/blocks.types'

interface EditorProps {
  data: PageWithExercises
}

function Editor(props: EditorProps) {
  const { id, content, url_path, title } = props.data
  const [blocks, setBlocks] = useState(content ?? [])
  const exercises = useRecoilValue(exercisesState)

  const handleSave = (): void => {
    updateExistingPage({ page_id: id, content: blocks, exercises, url_path, title }).then(
      (res: PageWithExercises) => {
        setBlocks(res.content)
      },
    )
  }

  const handleChanges = (page: BlockInstance<ExerciseAttributes>[]): void => {
    setBlocks(page)
  }
  const handleInput = (page: BlockInstance<ExerciseAttributes>[]): void => {
    setBlocks(page)
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
