"use client"

import { css } from "@emotion/css"
import type { UseQueryResult } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import PeerOrSelfReviewViewImpl from "./PeerOrSelfReviewViewImpl"

import type { CourseMaterialExercise } from "@/generated/course-material-api/types.generated"
import { baseTheme } from "@/shared-module/common/styles"

export interface PeerOrSelfReviewViewProps {
  exerciseNumber: number
  exerciseId: string
  parentExerciseQuery: UseQueryResult<CourseMaterialExercise, unknown>
  selfReview?: boolean
}

export const getPeerReviewBeginningScrollingId = (exerciseId: string) =>
  // oxlint-disable-next-line i18next/no-literal-string
  `start-of-peer-review-${exerciseId}`

const PeerOrSelfReviewView: React.FC<React.PropsWithChildren<PeerOrSelfReviewViewProps>> = (
  props,
) => {
  const { t } = useTranslation()

  return (
    <div id={getPeerReviewBeginningScrollingId(props.exerciseId)}>
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
        {props.selfReview ? t("title-self-review") : t("title-peer-review")}
      </h3>
      <PeerOrSelfReviewViewImpl {...props} />
    </div>
  )
}

export default PeerOrSelfReviewView
