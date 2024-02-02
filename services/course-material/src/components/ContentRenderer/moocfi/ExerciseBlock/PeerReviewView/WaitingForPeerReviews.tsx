import { css, cx } from "@emotion/css"
import { useQueryClient } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import { exerciseButtonStyles, makeExerciseButtonMutedStyles } from ".."
import { courseMaterialExerciseQueryKey } from "../../../../../hooks/useCourseMaterialExerciseQuery"
import { CourseMaterialExercise } from "../../../../../shared-module/bindings"
import { baseTheme } from "../../../../../shared-module/styles"

const WaitingForPeerReviews: React.FC<React.PropsWithChildren<{ exerciseId: string }>> = ({
  exerciseId,
}) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  return (
    <div
      className={css`
        p {
          margin-bottom: 1rem;
        }
      `}
    >
      <h3
        className={css`
          font-weight: 600;
          font-size: 36px;
          line-height: 50px;
          text-align: center;
          margin-bottom: 1rem;

          color: ${baseTheme.colors.gray[700]};
        `}
      >
        {t("title-waiting-for-peer-reviews")}
      </h3>

      <p>{t("waiting-for-peer-reviews-explanation")}</p>
      <p>{t("help-text-increase-peer-review-priority")}</p>
      <button
        onClick={() => {
          // Resets the reviewing stage back to peer review so that the reviewing ui shows up
          const queryKey = courseMaterialExerciseQueryKey(exerciseId)
          const oldData: CourseMaterialExercise | undefined = queryClient.getQueryData(queryKey)
          if (oldData === undefined || oldData.exercise_status === null) {
            throw new Error(
              `Cannot find required data to start giving extra peer review. ${JSON.stringify(
                { queryKey, oldData },
                undefined,
                2,
              )}`,
            )
          }
          const newData: CourseMaterialExercise = {
            ...oldData,
            exercise_status: { ...oldData.exercise_status, reviewing_stage: "PeerReview" },
          }
          queryClient.setQueryData(queryKey, newData)
        }}
        className={cx(exerciseButtonStyles, makeExerciseButtonMutedStyles)}
      >
        {t("button-text-give-extra-peer-review")}
      </button>
    </div>
  )
}

export default WaitingForPeerReviews
