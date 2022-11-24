import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import Badge from "../../../../img/grade-badge.svg"
import { UserModuleCompletionStatus } from "../../../../shared-module/bindings"
import { baseTheme, headingFont, monospaceFont, typography } from "../../../../shared-module/styles"

import CongratulationsLinks from "./CongratulationsLinks"

// eslint-disable-next-line i18next/no-literal-string
const Wrapper = styled.div`
  font-family: ${headingFont};
  max-width: 480px;
  min-height: 100%;
  background: #6fb37e;
  box-shadow: 0px 10px 20px rgba(68, 130, 126, 0.2);
  border-radius: 4px;
  text-align: left;
  padding: 1.5rem 1.5rem 1.8rem 1.5rem;
  position: relative;

  button {
    text-transform: capitalize;
    color: #6fb27e !important;
    font-weight: 500;
  }

  button:disabled {
    color: #91ac97 !important;
  }

  h3 {
    color: #1a2333;
    font-style: normal;
    font-weight: 600;
    font-size: 22px;
    max-width: 420px;
    line-height: 30px;
  }
`

// eslint-disable-next-line i18next/no-literal-string
const BadgeWrapper = styled.div`
  position: absolute;
  top: 14px;
  right: 18px;
  width: auto;
  height: auto;
  transform: rotate(-30deg);

  .grade {
    position: absolute;
    top: 18px;
    left: 23px;
    font-family: ${monospaceFont};
    font-size: 10px;
    color: #535a66;
  }
  .points {
    position: absolute;
    top: 28px;
    left: 20px;
    font-family: ${headingFont};
    font-size: 18px;
    font-weight: 700;
    color: ${baseTheme.colors.grey[700]};
  }
`

export interface ModuleCardProps {
  module: UserModuleCompletionStatus
}

const ModuleCard: React.FC<React.PropsWithChildren<ModuleCardProps>> = ({ module }) => {
  const { t } = useTranslation()
  return (
    <Wrapper>
      {/* REMOVE THIS WHEN COMPLETE */}
      {!module.completed && (
        <BadgeWrapper>
          <Badge />
          <span className="grade">{t("grade")}</span>
          <span className="points">FAIL</span>
        </BadgeWrapper>
      )}
      <h2
        className={css`
          font-size: ${typography.h5};
          color: #04312e;
          font-weight: 600;
        `}
      >
        {module.name}
      </h2>
      <CongratulationsLinks module={module} />
    </Wrapper>
  )
}

export default ModuleCard
