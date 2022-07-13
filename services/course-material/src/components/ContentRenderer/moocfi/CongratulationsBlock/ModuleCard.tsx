import styled from "@emotion/styled"
import React from "react"

import CircularCheck from "../../../../img/circular-check.svg"
import { UserModuleCompletionStatus } from "../../../../shared-module/bindings"
import { headingFont } from "../../../../shared-module/styles"

import CongratulationsLinks from "./CongratulationsLinks"

// eslint-disable-next-line i18next/no-literal-string
const Wrapper = styled.div`
  font-family: ${headingFont};
  max-width: 480px;
  min-height: 190px;
  background: #6fb37e;
  box-shadow: 0px 10px 20px rgba(68, 130, 126, 0.2);
  border-radius: 4px;
  text-align: left;
  padding: 1.5rem;
  position: relative;

  h3 {
    color: #1a2333;
    font-style: normal;
    font-weight: 600;
    font-size: 22px;
    max-width: 420px;
    line-height: 30px;
  }
`
const StyledSVG = styled(CircularCheck)`
  position: absolute;
  top: 26px;
  right: 29px;
`

export interface ModuleCardProps {
  module: UserModuleCompletionStatus
}

const ModuleCard: React.FC<ModuleCardProps> = ({ module }) => {
  return (
    <Wrapper>
      {module.completed && <StyledSVG />}
      <h3>{module.name}</h3>
      <CongratulationsLinks module={module} />
    </Wrapper>
  )
}

export default ModuleCard
