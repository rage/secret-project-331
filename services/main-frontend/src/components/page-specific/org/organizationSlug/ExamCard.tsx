import styled from "@emotion/styled"
import React, { useContext } from "react"
import { useTranslation } from "react-i18next"

import SettingIcon from "../../../../imgs/setting.svg"
import LoginStateContext from "../../../../shared-module/contexts/LoginStateContext"

const ExamCard = styled.a`
  margin-bottom: 5px;

  position: relative;
  max-width: 100%;
  width: 100%;
  height: 320px;
  background: #f5f6f7;
  border-radius: 3px;
  text-decoration: none;
  border: 1px solid #bec3c7;

  :hover {
    cursor: pointer;
    background: #ebedee;
  }
`

const StyledSettingIcon = styled(SettingIcon)`
  position: absolute;
  top: 30px;
  right: 40px;

  :hover {
    cursor: pointer;
  }
`

interface Props {
  id: string
  name: string
  manageHref: string
  navigateToExamHref: string
}

const ExamComponent: React.FC<Props> = ({ id, name, manageHref, navigateToExamHref }) => {
  const loginStateContext = useContext(LoginStateContext)
  const { t } = useTranslation()
  return (
    <div>
      <ExamCard href={navigateToExamHref} aria-label={t("exam-navigation", { name })}>
        {loginStateContext.signedIn && (
          <a aria-label={t("manage-exam", { name })} href={manageHref}>
            <StyledSettingIcon />
          </a>
        )}
        <div>
          <p>{id}</p>
          <p> {name}</p>
        </div>
      </ExamCard>
    </div>
  )
}

export default ExamComponent
