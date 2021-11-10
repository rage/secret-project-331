import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { IconButton } from "@material-ui/core"
import { Settings as SettingsIcon } from "@material-ui/icons"
import React from "react"

import { headingFont } from "../../styles"

interface CourseCardProps {
  name: string
  onClick: (event: unknown) => void
}

const CardStyle = css`
  background-color: #ededed;
  max-width: 404px;
  max-height: 338px;
  padding: 2%;
  margin: 5px;
`

const IconButtonStyle = css`
  float: right;
`

const CardTitle = styled.h2`
  margin-top: 82px;
  color: #333333;
  font-family: ${headingFont};
`

const CardContainer = styled.div`
  display: flex;
  flex-direction: row;
  margin-bottom: 20px;
  flex-wrap: wrap;
`

const CourseCard: React.FC<CourseCardProps> = ({ name, onClick }) => {
  return (
    <div className={CardStyle}>
      <IconButton className={IconButtonStyle} onClick={onClick}>
        <SettingsIcon />
      </IconButton>
      <CardTitle> {name} </CardTitle>
    </div>
  )
}

export { CardContainer, CourseCard }
