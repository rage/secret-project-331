import styled from "@emotion/styled"
import React, { useState } from "react"

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
import Tick from "../../img/tick-03.svg"

const arr = {
  "bg-BG": { humanReadableName: "belgium", image: Belgium },
  "fi-FI": { humanReadableName: "finnish", image: Finland },
  "fr-BE": { humanReadableName: "belgium-french", image: Belgium },
  "de-AT": { humanReadableName: "german", image: Austria },
  "pt-PT": { humanReadableName: "portugal", image: Portugal },
  "da-DK": { humanReadableName: "danish", image: Denmark },
  "de-DE": { humanReadableName: "german", image: Germany },
  "sv-SE": { humanReadableName: "swedish", image: Sweden },
  "en-US": { humanReadableName: "english", image: USA },
  "nl-NL": { humanReadableName: "dutch", image: Netherland },
  "nl-BE": { humanReadableName: "dutch-belgium", image: Netherland },
  "cs-CZ": { humanReadableName: "czech", image: Czech },
  "sk-SK": { humanReadableName: "slovenia", image: Slovenia },
  "lt-LT": { humanReadableName: "lithuania", image: Lithuania },
  "it-IT": { humanReadableName: "italian", image: Italy },
  "hr-HR": { humanReadableName: "croatia", image: Croatia },
  "el-GR": { humanReadableName: "greece", image: Greece },
  "pl-PL": { humanReadableName: "polish", image: Poland },
  "nb-NO": { humanReadableName: "norway", image: Norway },
  "lv-LV": { humanReadableName: "latvia", image: Latvia },
  "en-IE": { humanReadableName: "english", image: Ireland },
  "ro-RO": { humanReadableName: "romanian", image: Romania },
  "es-ES": { humanReadableName: "spanish", image: Spain },
  "et-EE": { humanReadableName: "estonian", image: Estonia },
  "fr-FR": { humanReadableName: "french", image: France },
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
    font-family: "Josefin Sans", sans-serif;
    opacity: 0.7;
  }
`

export interface LanguageSelectorExtraProps {
  click: any
}

export type LanguageSelectorProps = React.HTMLAttributes<HTMLDivElement> &
  LanguageSelectorExtraProps

const LanguageSelector: React.FC<LanguageSelectorProps> = (props) => {
  const [checked, setChecked] = useState<number | null>(null)

  const handleClick = (index: number) => {
    setChecked(index)
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
            <Country
              key={o.humanReadableName}
              id={JSON.stringify(index)}
              onClick={() => {
                handleClick(index)
              }}
            >
              <div>
                {checked === index && <StCheck />}
                <img
                  src={o.image}
                  data-attribute={o.image}
                  id={JSON.stringify(index)}
                  alt={`${o.humanReadableName} flag`}
                />
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
