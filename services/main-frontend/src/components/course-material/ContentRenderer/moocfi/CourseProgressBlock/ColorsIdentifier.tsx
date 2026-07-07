"use client"

import styled from "@emotion/styled"
import * as React from "react"
import { useTranslation } from "react-i18next"

import { baseTheme, headingFont } from "@/shared-module/common/styles"

interface CircleProps {
  bg: string
}

const Wrapper = styled.div`
  margin-top: 1.4rem;
  background: #fff;
  max-width: 100%;
  height: auto;
  display: flex;
  justify-content: center;
`
const Circle = styled.div`
  width: 12px;
  height: 12px;
  background: ${({ bg }: CircleProps) => bg};
  border-radius: 50%;
  display: inline-block;
  margin-right: 8px;
`
const IdentifierContainer = styled.div`
  padding: 5px 10px 10px 10px;
  display: inline-block;
  justify-content: center;
  align-items: center;
  width: auto;
  span {
    color: ${baseTheme.colors.gray[600]};
    font-size: 15px;
    line-height: 1;
    font-family: ${headingFont};
    font-weight: 500;
  }
`

export interface ColorsIdentifierProps {
  /** Student (given) points, shown as text next to the legend. */
  studentPoints?: number | null
  /** Points required for completion, shown as text next to the legend. */
  requiredPoints?: number | null
  /** Maximum obtainable points, shown as text next to the legend. */
  maxPoints?: number | null
  /**
   * Forces the yellow "required" legend row to be shown even when requiredPoints
   * has no numeric value. Pass this when any visible progress bar draws the
   * required marker for a different threshold (e.g. required attempted exercises).
   */
  showRequiredLegend?: boolean
}

const ColorsIdentifier: React.FunctionComponent<ColorsIdentifierProps> = ({
  studentPoints,
  requiredPoints,
  maxPoints,
  showRequiredLegend = false,
}) => {
  const { t } = useTranslation()
  // Append the numeric value to the label so the information is not conveyed by
  // colour alone (WCAG 1.3.1, 1.4.1). The required-points legend is only shown
  // when a required threshold exists (or a required marker is drawn elsewhere).
  const withValue = (label: string, value: number | null | undefined) =>
    value === null || value === undefined ? label : `${label}: ${value}`

  const requiredLegendVisible =
    showRequiredLegend || (requiredPoints !== null && requiredPoints !== undefined)

  return (
    <Wrapper>
      <div>
        <IdentifierContainer>
          <Circle bg={baseTheme.colors.green[600]} />
          <span>{withValue(t("student-points"), studentPoints)}</span>
        </IdentifierContainer>
        {requiredLegendVisible && (
          <IdentifierContainer>
            <Circle bg={baseTheme.colors.yellow[300]} />
            <span>{withValue(t("required-points"), requiredPoints)}</span>
          </IdentifierContainer>
        )}
        <IdentifierContainer>
          <Circle bg={baseTheme.colors.green[200]} />
          <span>{withValue(t("max-points"), maxPoints)}</span>
        </IdentifierContainer>
      </div>
    </Wrapper>
  )
}

export default ColorsIdentifier
