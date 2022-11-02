import styled from "@emotion/styled"
import * as React from "react"
import { useTranslation } from "react-i18next"

import { baseTheme } from "../../../../shared-module/styles"

interface CircleProps {
  bg: string
}

const Wrapper = styled.div`
  margin-top: 20px;
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
  border-radius: 10px;
  display: inline-block;
  margin-right: 10px;
`
const IdentifierContainer = styled.div`
  padding: 5px 10px 10px 10px;
  display: inline-block;
  justify-content: center;
  align-items: center;
  width: auto;
  span {
    color: ${baseTheme.colors.grey[400]};
    font-size: 17px;
    line-height: 1.4;
  }
`

const ColoursIdentifier: React.FunctionComponent = () => {
  const { t } = useTranslation()
  return (
    <Wrapper>
      <div>
        <IdentifierContainer>
          <Circle bg={baseTheme.colors.green[600]} />
          <span>{t("student-point")}</span>
        </IdentifierContainer>
        <IdentifierContainer>
          <Circle bg={baseTheme.colors.yellow[300]} />
          <span>{t("necessary-point")}</span>
        </IdentifierContainer>
        <IdentifierContainer>
          <Circle bg={baseTheme.colors.green[200]} />
          <span>{t("max-point")}</span>
        </IdentifierContainer>
      </div>
    </Wrapper>
  )
}

export default ColoursIdentifier
