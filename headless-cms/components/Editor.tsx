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

import { Fragment } from '@wordpress/element'
import { useState, useEffect } from 'react'
import {
  BlockEditorKeyboardShortcuts,
  BlockEditorProvider,
  BlockList,
  BlockInspector,
  WritingFlow,
  ObserveTyping,
  InspectorControls,
} from '@wordpress/block-editor'
import {
  Popover,
  SlotFillProvider,
  DropZoneProvider,
  TextControl,
  Panel,
  PanelBody,
  PanelRow,
} from '@wordpress/components'
import { registerCoreBlocks } from '@wordpress/block-library'
import { registerBlockType } from '@wordpress/blocks'

import { ProgrammingExercise } from 'moocfi-python-editor'
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
  const handleSave = () => {
    const data = updateExistingPage(id, blocks, exercises, url_path, title)
  }

  const handleChanges = (page) => {
    setBlocks(page)
    console.log(JSON.stringify(blocks, undefined, 2))
  }
  const handleInput = (page) => {
    setBlocks(page)
    console.log(JSON.stringify(blocks, undefined, 2))
  }

  useEffect(() => {
    registerCoreBlocks()
    registerBlockType('moocfi/iframe-exercise', Exercise)
    registerBlockType('moocfi/exercise', {
      title: 'Exercise',
      description: 'Exercise example',
      category: 'embed',
      attributes: {
        exerciseId: {
          type: 'string',
          default: '',
        },
      },
      edit: ({ setAttributes, clientId }) => {
        setAttributes({ exerciseId: clientId })
        const [exerciseName, setExerciseName] = useState('name')
        const [deadline, setDeadline] = useState('deadline')
        return (
          <div>
            <Fragment>
              <InspectorControls>
                <Panel>
                  <PanelBody>
                    <PanelRow>
                      <TextControl
                        label="Exercise name"
                        onChange={(val) => {
                          setExerciseName(val)
                        }}
                        value={exerciseName}
                      />
                      <TextControl
                        label="Deadline"
                        onChange={(val) => {
                          setDeadline(val)
                        }}
                        value={deadline}
                      />
                    </PanelRow>
                  </PanelBody>
                </Panel>
              </InspectorControls>
              <ProgrammingExercise
                onExerciseDetailsChange={() => {}}
                organization={'test'}
                course={'python-random-testcourse'}
                exercise={exerciseName}
                token={'asd'}
                height={'300px'}
                outputHeight={'auto'}
                outputPosition={'relative'}
                language={'fi'}
              />
            </Fragment>
          </div>
        )
      },
      save: () => {
        console.log('Saving...')
        return <></>
      },
    })
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
