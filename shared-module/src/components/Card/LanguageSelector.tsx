import styled from "@emotion/styled"
import React, { useState } from "react"

import Close from "../../img/close.svg"
import UK from "../../img/flags/UK.png"
import Belgium from "../../img/flags/belgium.png"
import China from "../../img/flags/china.png"
import Finland from "../../img/flags/finland.png"
import Germany from "../../img/flags/germany.png"
import Holland from "../../img/flags/netherlands.png"
import Russia from "../../img/flags/russia.png"
import SK from "../../img/flags/southkorea.png"
import Spain from "../../img/flags/spain.png"
import Swiss from "../../img/flags/switzerland.png"
import US from "../../img/flags/unitedstates.png"
import Check from "../../img/tick.svg"

const arr = {
  belgium: ["belgium-dutch", Belgium],
  chinese: ["chinese", China],
  finland: ["finnish", Finland],
  english: ["english", UK],
  german: ["german", Germany],
  dutch: ["dutch", Holland],
  russian: ["russian", Russia],
  korean: ["korean", SK],
  spanish: ["spanish", Spain],
  swiss: ["swiss-german", Swiss],
  unitedState: ["us-english", US],
}

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
const StCheck = styled(Check)`
  position: absolute;
  top: 0px;
  right: 21px;
  fill: red;
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
  height: 80px;
  align-items: center;
  z-index: 100;

  img {
    width: 50px;
    height: 50px;
    border-radius: 50px;
    /*
    &:after {
      content: "";
      width: 50px;
      height: 50px;
      display: block;
      background: black;
    } */
  }

  span {
    word-wrap: break-word;
    font-size: 12px;
  }
`

export interface LanguageSelectorExtraProps {
  /*   variant: "text" | "link" | "read-only"
  content: string */
  click: any
}

export type LanguageSelectorProps = React.HTMLAttributes<HTMLDivElement> &
  LanguageSelectorExtraProps

const LanguageSelector: React.FC<LanguageSelectorProps> = (props) => {
  const [checked, setChecked] = useState<string>("")

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    console.log("flag-handler", e.currentTarget.id)
    setChecked(e.currentTarget.id)
  }

  return (
    <SelectorWrapper {...props}>
      <Header>
        <span>Choose a language</span>
        <StyledClose onClick={props.click} />
      </Header>
      <Content>
        {Object.values(arr).map((o, index) => (
          <>
            <Country key={o[0]} id={JSON.stringify(index)} onClick={handleClick}>
              <div>
                {checked === JSON.stringify(index) && <StCheck />}
                <img src={o[1]} data-attribute={o[1]} id={JSON.stringify(index)} alt="flag" />
              </div>
              <span>{o[0]}</span>
            </Country>
          </>
        ))}
      </Content>
    </SelectorWrapper>
  )
}

export default LanguageSelector
