"use client"

import { css } from "@emotion/css"

import useAllExerciseServices from "../../../../hooks/useAllExerciseServices"

import type { ExerciseServiceIframeRenderingInfo } from "@/generated/api"
import Button from "@/shared-module/common/components/Button"
import { QueryResult } from "@/shared-module/components/components/queryResult/QueryResult"
import { useTranslation } from "@/utils/useCmsTranslation"

interface Props {
  onChooseItem: (task: ExerciseServiceIframeRenderingInfo) => void
}

const ExerciseServiceList: React.FC<React.PropsWithChildren<Props>> = ({ onChooseItem }) => {
  const exerciseServicesQuery = useAllExerciseServices()
  const { t } = useTranslation()

  return (
    <QueryResult query={exerciseServicesQuery} treatEmptyAsData>
      {(data) => (
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
            {data.map((exercise_service) => (
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
      )}
    </QueryResult>
  )
}

export default ExerciseServiceList
