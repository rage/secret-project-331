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

import Exercise, { ExerciseAttributes } from '../blocks/Exercise'
import { updateExistingPage } from '../services/postData'
import { Button } from '@material-ui/core'
import {
  ExerciseWithExerciseItems,
  PageUpdateExercise,
  PageUpdateExerciseItem,
  PageWithExercises,
} from '../services/services.types'
import {
  allExercises,
  exerciseFamilySelector,
  exercisesAtoms,
  exercisesState,
} from '../state/exercises'
import { useRecoilCallback, useRecoilValue } from 'recoil'

interface EditorProps {
  data: PageWithExercises
}

export const saveResolveMap = new Map<string, (value: unknown) => void>()

const HandleSave = () => {
  const saveExerciseData = useRecoilCallback(
    ({ snapshot }) => async () => {
      const ids = await snapshot.getPromise(exercisesState)
      for (const exerciseId of ids) {
        const exercise = await snapshot.getPromise(exerciseFamilySelector(exerciseId))
        const element = document.getElementById(exerciseId)
        const promises = exercise.exercise_items.map(ei => {
          return new Promise<[string, PageUpdateExerciseItem]>((resolve, _reject) => {
            const enhancedResolve = (value: PageUpdateExerciseItem) => {
              resolve([ei.id, value])
            }
            // Response handler will get the resolve function from this map
            saveResolveMap.set(ei.id, enhancedResolve)
            const frame: HTMLIFrameElement = element.querySelector(
              `iframe[data-exercise-item-id='${ei.id}']`,
            )

            frame.contentWindow.postMessage(
              {
                message: 'give-state',
                message_type: 'moocfi/editor-message',
              },
              '*',
            )
          })
        })
        const exerciseItemContentsArray = await Promise.all(promises)
        const exerciseItemContetentsMapping = exerciseItemContentsArray.reduce((acc, val) => {
          const [key, value] = val;
          acc[key] = value;
          return acc;
        }, {})
        console.log(`All exercise item contents: ${JSON.stringify(exerciseItemContetentsMapping)}`)
      }
    },
    [],
  )
  return <Button onClick={saveExerciseData}>Update states...</Button>
}

function Editor(props: EditorProps) {
  const { content, url_path, title, course_id, deleted, exercises, id } = props.data
  const [blocks, setBlocks] = useState(content ?? [])

  // useRecoilCallback to create exercise atom state for each exercises array when opening Editor
  const createExercisesStates = useRecoilCallback(
    ({ set }) => (exerciseData: ExerciseWithExerciseItems[]) => {
      const ids = []
      for (const exercise of exerciseData) {
        ids.push(exercise.id)
        set(exercisesAtoms(exercise.id), exercise)
      }
      set(exercisesState, ids)
    },
    [],
  )

  const mapExercises = useRecoilCallback(({ snapshot }) => async () => {
    const exercises = await snapshot.getPromise(allExercises)
    return exercises
  })

  const handleChanges = (page: BlockInstance<ExerciseAttributes>[]): void => {
    console.log(page)
    setBlocks(page)
  }
  const handleInput = (page: BlockInstance<ExerciseAttributes>[]): void => {
    console.log(page)
    setBlocks(page)
  }

  const handleSave = (): void => {
    mapExercises().then((fetchedExercises: PageUpdateExercise[]) => {
      updateExistingPage({
        page_id: id,
        content: blocks,
        exercises: fetchedExercises,
        url_path,
        title,
      }).then((res: PageWithExercises) => {
        setBlocks(res.content)
      })
    })
  }

  useEffect(() => {
    registerCoreBlocks()
    registerBlockType('moocfi/iframe-exercise', Exercise)
  }, [])

  useEffect(() => {
    createExercisesStates(exercises)
  }, [exercises])

  return (
    <div className="playground">
      <HandleSave />
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
