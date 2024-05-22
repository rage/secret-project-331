import { css } from "@emotion/css"
import { BlockEditProps } from "@wordpress/blocks"
import { useTranslation } from "react-i18next"

import useAllExerciseServices from "../../hooks/useAllExerciseServices"
import BlockPlaceholderWrapper from "../BlockPlaceholderWrapper"

import { ExerciseCustomViewAttributes } from "."

import Button from "@/shared-module/common/components/Button"
import DebugModal from "@/shared-module/common/components/DebugModal"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"

const ExerciseCustomViewEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<ExerciseCustomViewAttributes>>
> = ({ attributes, clientId, setAttributes }) => {
  const { t } = useTranslation()

  const exerciseServicesQuery = useAllExerciseServices()
  if (exerciseServicesQuery.isError) {
    return <ErrorBanner variant={"readOnly"} error={exerciseServicesQuery.error} />
  }

  if (exerciseServicesQuery.isPending) {
    return <Spinner variant={"medium"} />
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
    <BlockPlaceholderWrapper
      id={clientId}
      title={t("exercise-custom-view-block")}
      explanation={t("exercise-custom-view-block-explanation")}
    >
      {!exerciseType ? (
        <div>
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
            {exerciseServicesQuery.data.map(
              (exercise_service) =>
                exercise_service.has_custom_view && (
                  <li key={exercise_service.name}>
                    <Button
                      onClick={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        if (!exercise_service.public_iframe_url) {
                          return
                        }
                        setAttributes({
                          exercise_type: exercise_service.slug,
                          exercise_iframe_url: exercise_service.public_iframe_url,
                        })
                      }}
                      variant="outlined"
                      size="medium"
                    >
                      {exercise_service.name}
                    </Button>
                  </li>
                ),
            )}
          </ul>
        </div>
      ) : (
        <div>
          <p>{t("selected-exercise-type", { exerciseType })}</p>
        </div>
      )}
    </BlockPlaceholderWrapper>
  )
}

export default ExerciseCustomViewEditor
