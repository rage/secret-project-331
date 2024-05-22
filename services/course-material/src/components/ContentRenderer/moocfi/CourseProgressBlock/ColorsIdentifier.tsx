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

const ColorsIdentifier: React.FunctionComponent = () => {
  const { t } = useTranslation()
  return (
    <Wrapper>
      <div>
        <IdentifierContainer>
          <Circle bg={baseTheme.colors.green[600]} />
          <span>{t("student-points")}</span>
        </IdentifierContainer>
        <IdentifierContainer>
          <Circle bg={baseTheme.colors.yellow[300]} />
          <span>{t("required-points")}</span>
        </IdentifierContainer>
        <IdentifierContainer>
          <Circle bg={baseTheme.colors.green[200]} />
          <span>{t("max-points")}</span>
        </IdentifierContainer>
      </div>
    </Wrapper>
  )
}

export default ColorsIdentifier
