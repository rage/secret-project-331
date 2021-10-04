import styled from "@emotion/styled"
import React, { useState } from "react"

import Check from "../../img/check.svg"
import Close from "../../img/close.svg"
import Austria from "../../img/flags/Austria.png"
import Belgium from "../../img/flags/Belgium.png"
import Croatia from "../../img/flags/Croatia.png"
import Czech from "../../img/flags/Czech.png"
import Denmark from "../../img/flags/Denmark.png"
import Estonia from "../../img/flags/Estonia.png"
import Finland from "../../img/flags/Finland.png"
import France from "../../img/flags/France.png"
import Germany from "../../img/flags/Germany.png"
import Greece from "../../img/flags/Greece.png"
import Ireland from "../../img/flags/Ireland.png"
import Italy from "../../img/flags/Italy.png"
import Latvia from "../../img/flags/Latvia.png"
import Lithuania from "../../img/flags/Lithuania.png"
import Netherland from "../../img/flags/Netherland.png"
import Norway from "../../img/flags/Norway.png"
import Poland from "../../img/flags/Poland.png"
import Portugal from "../../img/flags/Portugal.png"
import Romania from "../../img/flags/Romania.png"
import Slovenia from "../../img/flags/Slovenia.png"
import Spain from "../../img/flags/Spain.png"
import Sweden from "../../img/flags/Sweden.png"
import USA from "../../img/flags/USA.png"
import { headingFont } from "../../styles"

const arr = {
  belgium: ["belgium", Belgium],
  finland: ["finnish", Finland],
  belgiumFrench: ["belgium-french", Belgium],
  austria: ["german", Austria],
  portugal: ["portugal", Portugal],
  denmark: ["danish", Denmark],
  germany: ["german", Germany],
  sweden: ["swedidh", Sweden],
  USA: ["english", USA],
  netherland: ["dutch", Netherland],
  czech: ["czech", Czech],
  slovenia: ["slovenia", Slovenia],
  lithuania: ["lithuania", Lithuania],
  italy: ["italian", Italy],
  croatia: ["croatia", Croatia],
  greece: ["greece", Greece],
  poland: ["polish", Poland],
  norway: ["norway", Norway],
  latvia: ["latvia", Latvia],
  ireland: ["english", Ireland],
  romania: ["romanian", Romania],
  spain: ["spanish", Spain],
  estonia: ["estonian", Estonia],
  france: ["french", France],
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
  height: 80px;
  align-items: center;
  z-index: 100;

  img {
    object-fit: cover;
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
    font-size: 14px;
    font-family: ${headingFont};
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
