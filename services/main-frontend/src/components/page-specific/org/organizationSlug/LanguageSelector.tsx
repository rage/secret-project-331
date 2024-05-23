import styled from "@emotion/styled"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import Close from "../imgs/close.svg"
import Tick from "../imgs/tick-03.svg"

import Flag from "@/shared-module/common/components/LanguageSelection/Language"
import { headingFont } from "@/shared-module/common/styles"

const SelectorWrapper = styled.div`
  background: #e7e7e7;
  width: 100%;
  position: relative;
  margin: 0 auto;
  display: block;
  min-height: 200px;
`
const Header = styled.div`
  background: #e7e7e7;
  display: flex;
  width: 100%;
  height: 50px;
  padding: 1rem;

  #close {
    top: 12px;
    position: absolute;
  }

  span {
    line-height: 1;
  }
`
const StyledClose = styled(Close)`
  position: absolute;
  top: 13px;
  right: 20px;
  cursor: pointer;
  color: red;
`
const StCheck = styled(Tick)`
  position: absolute;
  top: 0px;
  right: 21px;
  fill: black;
`

const Content = styled.div`
  display: grid;
  grid-template-columns: repeat(4, auto);
  background: #ccc;
  height: auto;
  padding: 2rem;
`
const Country = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100px;
  height: 90px;
  align-items: center;
  z-index: 100;

  img {
    object-fit: cover;
    width: 50px;
    height: 50px;
    border-radius: 50px;
  }

  span {
    margin-top: 5px;
    font-size: 14px;
    font-family: ${headingFont};
    opacity: 0.7;
  }
`

export interface LanguageSelectorExtraProps {
  click: unknown
}

export type LanguageSelectorProps = React.HTMLAttributes<HTMLDivElement> &
  LanguageSelectorExtraProps

const LanguageSelector: React.FC<React.PropsWithChildren<LanguageSelectorProps>> = (props) => {
  const { t } = useTranslation()
  const [checked, setChecked] = useState<number | null>(null)

  const handleClick = (index: number) => {
    setChecked(index)
  }

  return (
    <SelectorWrapper {...props}>
      <Header>
        <span>{t("choose-a-language")}</span>
        <StyledClose onClick={props.click} />
      </Header>
      <Content>
        {Object.entries(Flag).map(([_, o], index) => (
          <>
            <Country
              key={o.humanReadableName}
              id={JSON.stringify(index)}
              onClick={() => {
                handleClick(index)
              }}
            >
              <div>
                {checked === index && <StCheck />}
                {/* <Image
                  src={o.image}
                  data-attribute={o.image}
                  id={`country-flag-${index}`}
                  alt={t("language-language", { language: key })}
                /> */}
              </div>
              <span>{o.humanReadableName}</span>
            </Country>
          </>
        ))}
      </Content>
    </SelectorWrapper>
  )
}

export default LanguageSelector
