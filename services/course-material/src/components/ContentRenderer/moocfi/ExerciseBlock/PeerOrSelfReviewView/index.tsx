import { css } from "@emotion/css"
import { UseQueryResult } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import { baseTheme } from "../../../../../shared-module/styles"

import PeerOrSelfReviewViewImpl from "./PeerOrSelfReviewViewImpl"

export interface PeerOrSelfReviewViewProps {
  exerciseNumber: number
  exerciseId: string
  parentExerciseQuery: UseQueryResult<unknown, unknown>
  selfReview?: boolean
}

export const getPeerReviewBeginningScrollingId = (exerciseId: string) =>
  // eslint-disable-next-line i18next/no-literal-string
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
