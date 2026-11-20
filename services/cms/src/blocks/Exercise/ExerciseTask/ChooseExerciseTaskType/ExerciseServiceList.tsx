"use client"

import { css } from "@emotion/css"

import ExerciseServiceBadges from "@/components/ExerciseServiceBadges"
import type { ExerciseServiceIframeRenderingInfo } from "@/generated/api"
import useAuthorizeMultiple from "@/shared-module/common/hooks/useAuthorizeMultiple"
import { Button, QueryResults } from "@/shared-module/components"
import { useTranslation } from "@/utils/useCmsTranslation"

import useAllExerciseServices from "../../../../hooks/useAllExerciseServices"

interface Props {
  onChooseItem: (task: ExerciseServiceIframeRenderingInfo) => void
}

const ExerciseServiceList: React.FC<React.PropsWithChildren<Props>> = ({ onChooseItem }) => {
  const exerciseServicesQuery = useAllExerciseServices()
  const isGlobalAdminQuery = useAuthorizeMultiple([
    { action: { type: "administrate" }, resource: { type: "global_permissions" } },
  ])
  const { t } = useTranslation()

  return (
    <QueryResults
      queries={[exerciseServicesQuery, isGlobalAdminQuery] as const}
      treatEmptyAsData
      renderData={([data, [isGlobalAdmin]]) => (
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
            {data
              .filter((exercise_service) => isGlobalAdmin || !exercise_service.is_global_admin_only)
              .map((exercise_service) => (
                <li key={exercise_service.name}>
                  <Button
                    onClick={() => {
                      if (!exercise_service.public_iframe_url) {
                        return
                      }
                      onChooseItem(exercise_service)
                    }}
                    variant="secondary"
                    size="medium"
                  >
                    {exercise_service.name}
                  </Button>
                  <ExerciseServiceBadges exerciseService={exercise_service} />
                </li>
              ))}
          </ul>
        </div>
      )}
    />
  )
}

export default ExerciseServiceList
