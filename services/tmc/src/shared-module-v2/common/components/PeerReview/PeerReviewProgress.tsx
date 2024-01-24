import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import Progress from "../CourseProgress/index"

const Wrapper = styled.div`
  width: 100%;
  background: #e9efef;
  padding: 1.75rem 2rem;
  display: flex;
  align-items: center;
  margin-bottom: 2rem;
`

export interface ReviewExtraProps {
  total: number
  attempt: number
}

export type ReviewComponentProps = React.HTMLAttributes<HTMLDivElement> & ReviewExtraProps

const PeerReviewProgress: React.FC<
  React.PropsWithChildren<React.PropsWithChildren<ReviewComponentProps>>
> = ({ total, attempt }) => {
  const { t } = useTranslation()
  return (
    <Wrapper>
      <div
        className={css`
          flex: 1;
        `}
      >
        <Progress
          variant="bar"
          exercisesTotal={total}
          exercisesAttempted={attempt}
          showAsPercentage={false}
          height="small"
          label={t("peer-reviews-given")}
        />
      </div>
    </Wrapper>
  )
}

export default PeerReviewProgress
