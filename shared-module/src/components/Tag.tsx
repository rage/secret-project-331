import { css } from "@emotion/css"
import { keyframes } from "@emotion/react"
import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"
import { baseTheme, headingFont } from "../styles"

type Color = 'blue' | 'green';

export interface TagExtraProps {
  label: boolean
  text: string
  color: Color
  blink: boolean
}

const blink = keyframes`
0% {
  transform: scale(1);
  opacity: 0.25;
}
25%{
  opacity: 1;
}
50% {
  opacity: 0.25;
}
75%{
  opacity: 1;
}
100% {
  transform: scale(1);
  opacity: 0.25;
}
`

const Wrapper = styled.div`
  display: flex;
  font-family: ${headingFont};
  font-size: 22px;
  align-items: center;
`
const Blink = styled.div`
border-radius: 50%;
width: 10px;
height: 10px;
opacity: .25;
margin-right: 5px;
background-color: ${({color}) => color === 'blue' ? baseTheme.colors.blue[600] : baseTheme.colors.green[600]};
-webkit-animation: ${blink} 1s infinite;
-moz-animation: ${blink} 1s infinite;
-o-animation: ${blink} 1s infinite;
animation: ${blink} 1s infinite;

&:after {
  border-radius: 50%;
  content: "";
  position: absolute;
  top: 0px;
  left: 0px;
  right: 0px;
  bottom: 0px;
  border: 2px solid ${({color}) => color === 'blue' ? baseTheme.colors.blue[300] : baseTheme.colors.green[300]};
}
`

export type TagProps = React.HTMLAttributes<HTMLDivElement> & TagExtraProps

const Tag: React.FC<TagProps> = ({ label = true, text='ongoing', color='blue', blink = true }) => {
  const { t } = useTranslation()
  return (
    <Wrapper>
      {label && (
        <span className={css`
        color: #747A83;
        `}>{t('status')}:</span>
      )}
      <div className={css`
        margin-left: 10px;
        display: inherit;
        justify-content: center;
        align-items: center;
        background: ${color === 'blue' ? baseTheme.colors.blue[100] : baseTheme.colors.green[100]};
        padding: 16px;
        color: ${color === 'blue' ? baseTheme.colors.blue[600] : baseTheme.colors.green[600]};
        border-radius: 3px;
        height: 28px;
        min-weight: 95px;
        font-family: ${headingFont};
        font-size: 20px;
      `}>{blink && (
        <Blink color={color}></Blink>
      )}{text}</div>
    </Wrapper>
  )
}

export default Tag
