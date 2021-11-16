import styled from "@emotion/styled"
import React, { useContext } from "react"
import { useTranslation } from "react-i18next"

import Finland from "../../imgs/flags/Finland.svg"
import SettingIcon from "../../imgs/setting.svg"
import LoginStateContext from "../../shared-module/contexts/LoginStateContext"

interface CardExtraProps {
  title: string
  description: string
}

const CourseGridWrapper = styled.div`
  max-width: 450px;
  height: 400px;
  border-radius: 1px;
  background: #ededed;
  padding: 40px 60px 40px 40px;
  position: relative;
  display: grid;
  align-items: center;
`
const Content = styled.div`
  h2 {
    line-height: 1.25;
    margin-bottom: 10px;
  }

  span {
    font-size: 16px;
    line-height: 24px;
  }
`
const StyledSettingIcon = styled(SettingIcon)`
  position: absolute;
  top: 30px;
  right: 40px;
`

const StyledFlag = styled(Finland)`
  width: 25px;
  height: 25px;
  border-radius: 50%;
  display: inline;
  float: right;
`

export type CardProps = React.HTMLAttributes<HTMLDivElement> & CardExtraProps

const CourseCard: React.FC<CardProps> = ({ title, description }) => {
  const { t } = useTranslation()
  // If URL defined, the chapter is open
  const loginStateContext = useContext(LoginStateContext)

  return (
    <CourseGridWrapper>
      {loginStateContext.signedIn && <StyledSettingIcon />}
      <Content>
        <h2>{title}</h2>
        <span>{description}</span>
        <div>
          <StyledFlag />
          <p>{t("american-english")}</p>
        </div>
      </Content>
    </CourseGridWrapper>
  )
}

export default CourseCard
