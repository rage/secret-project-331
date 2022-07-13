import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import CircularCheck from "../../../../img/circular-check.svg"
import { UserModuleCompletionStatus } from "../../../../shared-module/bindings"
import Button from "../../../../shared-module/components/Button"
import { headingFont } from "../../../../shared-module/styles"

import { CTAWrapper, StyledLink } from "./Congratulations"

const COMPLETION_REGISTRATION_BASE_PATH = `/completion-registration`

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
  const { t } = useTranslation()
  return (
    <Wrapper>
      {module.completed && <StyledSVG />}
      <h3>{module.name}</h3>
      <CTAWrapper>
        <a href={`${COMPLETION_REGISTRATION_BASE_PATH}/${module.module_id}`}>
          <Button variant="tertiary" size="large" disabled={!module.completed}>
            {t("register")}
          </Button>
        </a>
        <StyledLink>{t("generate-certicate")}</StyledLink>
      </CTAWrapper>
    </Wrapper>
  )
}

export default ModuleCard
