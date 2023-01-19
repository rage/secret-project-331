import { css } from "@emotion/css"
import { store as blockEditorStore } from "@wordpress/block-editor"
import { useDispatch, useSelect } from "@wordpress/data"
import { useRef } from "react"
import { useTranslation } from "react-i18next"

import useAllExerciseServices from "../../../hooks/useAllExerciseServices"
import { ExerciseServiceIframeRenderingInfo } from "../../../shared-module/bindings"
import Button from "../../../shared-module/components/Button"
import ErrorBanner from "../../../shared-module/components/ErrorBanner"
import Spinner from "../../../shared-module/components/Spinner"

const EMPTY_ARRAY: unknown[] = []

interface Props {
  onChooseItem: (task: ExerciseServiceIframeRenderingInfo) => void
}

const ExerciseServiceList: React.FC<React.PropsWithChildren<Props>> = ({ onChooseItem }) => {
  const exerciseServicesQuery = useAllExerciseServices()
  const { isBlockSelected } = useSelect(blockEditorStore, EMPTY_ARRAY)
  const { selectBlock } = useDispatch(blockEditorStore)
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)

  if (exerciseServicesQuery.isError) {
    return <ErrorBanner variant={"readOnly"} error={exerciseServicesQuery.error} />
  }

  if (exerciseServicesQuery.isLoading) {
    return <Spinner variant="medium" />
  }

  return (
    <div
      ref={ref}
      onMouseDownCapture={(e) => {
        // Workarounnd for a problem where when the last block of the assignment innerblocks was lost focus it always added an extra block and stopped the buttons in this blocks from working.
        e.stopPropagation()
        e.preventDefault()

        if (!ref.current) {
          return
        }
        // Selecting the exercise task causes the problem, selecting the exercise slide instead
        const parentBlockElement = ref.current
          .closest(".wp-block")
          ?.closest(".wp-block")
          ?.parentElement?.closest(".wp-block")

        if (!parentBlockElement) {
          return
        }
        const parentBlockId = (parentBlockElement as HTMLElement).dataset?.block
        if (!parentBlockId) {
          return
        }
        if (!isBlockSelected(parentBlockId)) {
          selectBlock(parentBlockId)
        }
      }}
    >
      <h2>{t("please-select-exercise-type")}</h2>
      <ul
        className={css`
          list-style: none;
          padding: 0;

          li {
            margin: 0.5rem 0;
          }
        `}
      >
        {exerciseServicesQuery.data.map((exercise_service) => (
          <li key={exercise_service.name}>
            <Button
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                if (!exercise_service.public_iframe_url) {
                  return
                }
                onChooseItem(exercise_service)
              }}
              variant="outlined"
              size="medium"
            >
              {exercise_service.name}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default ExerciseServiceList
