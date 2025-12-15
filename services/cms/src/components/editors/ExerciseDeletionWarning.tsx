import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { CmsPageExercise } from "@/shared-module/common/bindings"
import { dateToString } from "@/shared-module/common/utils/time"

interface ExerciseDeletionWarningProps {
  exercises: CmsPageExercise[]
}

const ExerciseDeletionWarning: React.FC<ExerciseDeletionWarningProps> = ({ exercises }) => {
  const { t } = useTranslation()
  const exerciseCount = exercises.length
  const exerciseText = exerciseCount === 1 ? t("exercise") : t("exercises")

  return (
    <div
      className={css`
        padding: 0.5rem 0;
      `}
    >
      <p
        className={css`
          margin-bottom: 1.5rem;
          color: #212529;
          font-size: 1rem;
          line-height: 1.5;
        `}
      >
        {t("saving-will-delete-exercises-warning", {
          count: exerciseCount,
          exercises: exerciseText,
        })}
      </p>

      <div
        className={css`
          display: flex;
          flex-direction: column;
          gap: 1rem;
        `}
      >
        {exercises.map((exercise) => (
          <div
            key={exercise.id}
            className={css`
              padding: 1rem;
              background-color: #f8f9fa;
              border-radius: 4px;
              border: 1px solid #dee2e6;
            `}
          >
            <div
              className={css`
                display: grid;
                grid-template-columns: auto 1fr;
                gap: 0.75rem 1.5rem;
                font-size: 0.9rem;
              `}
            >
              <div
                className={css`
                  color: #6c757d;
                  font-weight: 500;
                `}
              >
                {t("exercise-name")}:
              </div>
              <div
                className={css`
                  color: #212529;
                `}
              >
                {exercise.name || (
                  <span
                    className={css`
                      font-style: italic;
                      color: #6c757d;
                    `}
                  >
                    {t("unnamed-exercise")}
                  </span>
                )}
              </div>

              <div
                className={css`
                  color: #6c757d;
                  font-weight: 500;
                `}
              >
                {t("exercise-max-points")}:
              </div>
              <div
                className={css`
                  color: #212529;
                `}
              >
                {exercise.score_maximum}
              </div>

              <div
                className={css`
                  color: #6c757d;
                  font-weight: 500;
                `}
              >
                {t("created-at")}:
              </div>
              <div
                className={css`
                  color: #212529;
                `}
              >
                {dateToString(exercise.created_at)}
              </div>

              {exercise.deadline && (
                <>
                  <div
                    className={css`
                      color: #6c757d;
                      font-weight: 500;
                    `}
                  >
                    {t("deadline")}:
                  </div>
                  <div
                    className={css`
                      color: #212529;
                    `}
                  >
                    {dateToString(exercise.deadline)}
                  </div>
                </>
              )}

              {(exercise.needs_peer_review || exercise.needs_self_review) && (
                <>
                  <div
                    className={css`
                      color: #6c757d;
                      font-weight: 500;
                    `}
                  >
                    {t("review-requirements")}:
                  </div>
                  <div
                    className={css`
                      color: #212529;
                    `}
                  >
                    {[
                      exercise.needs_peer_review && t("needs-peer-review"),
                      exercise.needs_self_review && t("needs-self-review"),
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </div>
                </>
              )}

              {exercise.max_tries_per_slide && (
                <>
                  <div
                    className={css`
                      color: #6c757d;
                      font-weight: 500;
                    `}
                  >
                    {t("tries-per-slide")}:
                  </div>
                  <div
                    className={css`
                      color: #212529;
                    `}
                  >
                    {exercise.max_tries_per_slide}
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <p
        className={css`
          margin-top: 1.5rem;
          color: #212529;
          font-size: 1rem;
        `}
      >
        {t("are-you-sure-you-want-to-continue")}
      </p>
    </div>
  )
}

export default ExerciseDeletionWarning
