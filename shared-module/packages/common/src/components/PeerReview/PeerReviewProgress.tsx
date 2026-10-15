"use client"

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import { Meter } from "@/shared-module/components/components/Meter"
import { METER_KIND, TONE } from "@/shared-module/components/lib/displayConstants"

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

const PeerReviewProgress: React.FC<React.PropsWithChildren<ReviewComponentProps>> = ({
  total,
  attempt,
}) => {
  const { t } = useTranslation()
  return (
    <Wrapper>
      <div
        className={css`
          flex: 1;
        `}
      >
        <Meter
          kind={METER_KIND.PROGRESS}
          tone={TONE.SUCCESS}
          label={t("peer-reviews-given")}
          value={attempt}
          maxValue={total}
          valueLabel={t("value-of-maximum", { value: attempt, maximum: total })}
        />
      </div>
    </Wrapper>
  )
}

export default PeerReviewProgress
