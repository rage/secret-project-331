import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import Progress from "../CourseProgress/index"

const Wrapper = styled.div`
  width: 100%;
  background: #e9efef;
  padding: 2rem 2rem;
  display: grid;
  grid-template-columns: 1fr 240px;
`

const Label = styled.div`
  font-weight: 500;
  margin-left: 1.5rem;
  text-align: left;

  span {
    color: #1f6964;
  }
`
export interface ReviewExtraProps {
  total: number
  attempt: number
}

export type ReviewComponentProps = React.HTMLAttributes<HTMLDivElement> & ReviewExtraProps

const PeerReviewProgress: React.FC<ReviewComponentProps> = ({ total, attempt }) => {
  const { t } = useTranslation()
  return (
    <Wrapper>
      <Progress
        variant="bar"
        exercisesTotal={total}
        exercisesAttempted={attempt}
        showAsPercentage={true}
        height="small"
        label={false}
      />
      <Label>
        <span>{`${attempt} / ${total} ${t("exercises-attempted")}`}</span>
      </Label>
    </Wrapper>
  )
}

export default PeerReviewProgress
