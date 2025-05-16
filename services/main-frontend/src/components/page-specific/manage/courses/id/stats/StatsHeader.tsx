import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"

import DebugModal from "@/shared-module/common/components/DebugModal"
import { baseTheme, headingFont } from "@/shared-module/common/styles"

interface StatsHeaderProps {
  heading: string
  debugData?: unknown
  children?: React.ReactNode
}

export const StatHeading = styled.h2`
  font-size: 1.8rem;
  color: ${baseTheme.colors.gray[600]};
  font-family: ${headingFont};
  margin-bottom: 1rem;
  margin-top: 1rem;
`

const StatsHeader: React.FC<StatsHeaderProps> = ({ heading, debugData, children }) => {
  return (
    <div
      className={css`
        display: flex;
        align-items: center;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
      `}
    >
      <div
        className={css`
          display: flex;
          align-items: center;
          gap: 0.5rem;
        `}
      >
        <StatHeading>{heading}</StatHeading>
        {Boolean(debugData) && (
          <DebugModal
            variant="minimal"
            data={debugData}
            buttonWrapperStyles={css`
              display: flex;
              align-items: center;
            `}
          />
        )}
      </div>
      {children}
    </div>
  )
}

export default StatsHeader
