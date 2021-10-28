import styled from "@emotion/styled"
import Image from "next/image"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

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
import { headingFont } from "../../shared-module/styles"

// TODO: Human readable name should contain the language name in the language itself
const arr = {
  // eslint-disable-next-line i18next/no-literal-string
  "bg-BG": { humanReadableName: "belgium", image: Belgium },
  // eslint-disable-next-line i18next/no-literal-string
  "fi-FI": { humanReadableName: "finnish", image: Finland },
  // eslint-disable-next-line i18next/no-literal-string
  "fr-BE": { humanReadableName: "belgium-french", image: Belgium },
  // eslint-disable-next-line i18next/no-literal-string
  "de-AT": { humanReadableName: "german", image: Austria },
  // eslint-disable-next-line i18next/no-literal-string
  "pt-PT": { humanReadableName: "portugal", image: Portugal },
  // eslint-disable-next-line i18next/no-literal-string
  "da-DK": { humanReadableName: "danish", image: Denmark },
  // eslint-disable-next-line i18next/no-literal-string
  "de-DE": { humanReadableName: "german", image: Germany },
  // eslint-disable-next-line i18next/no-literal-string
  "sv-SE": { humanReadableName: "swedish", image: Sweden },
  // eslint-disable-next-line i18next/no-literal-string
  "en-US": { humanReadableName: "english", image: USA },
  // eslint-disable-next-line i18next/no-literal-string
  "nl-NL": { humanReadableName: "dutch", image: Netherland },
  // eslint-disable-next-line i18next/no-literal-string
  "nl-BE": { humanReadableName: "dutch-belgium", image: Netherland },
  // eslint-disable-next-line i18next/no-literal-string
  "cs-CZ": { humanReadableName: "czech", image: Czech },
  // eslint-disable-next-line i18next/no-literal-string
  "sk-SK": { humanReadableName: "slovenia", image: Slovenia },
  // eslint-disable-next-line i18next/no-literal-string
  "lt-LT": { humanReadableName: "lithuania", image: Lithuania },
  // eslint-disable-next-line i18next/no-literal-string
  "it-IT": { humanReadableName: "italian", image: Italy },
  // eslint-disable-next-line i18next/no-literal-string
  "hr-HR": { humanReadableName: "croatia", image: Croatia },
  // eslint-disable-next-line i18next/no-literal-string
  "el-GR": { humanReadableName: "greece", image: Greece },
  // eslint-disable-next-line i18next/no-literal-string
  "pl-PL": { humanReadableName: "polish", image: Poland },
  // eslint-disable-next-line i18next/no-literal-string
  "nb-NO": { humanReadableName: "norway", image: Norway },
  // eslint-disable-next-line i18next/no-literal-string
  "lv-LV": { humanReadableName: "latvia", image: Latvia },
  // eslint-disable-next-line i18next/no-literal-string
  "en-IE": { humanReadableName: "english", image: Ireland },
  // eslint-disable-next-line i18next/no-literal-string
  "ro-RO": { humanReadableName: "romanian", image: Romania },
  // eslint-disable-next-line i18next/no-literal-string
  "es-ES": { humanReadableName: "spanish", image: Spain },
  // eslint-disable-next-line i18next/no-literal-string
  "et-EE": { humanReadableName: "estonian", image: Estonia },
  // eslint-disable-next-line i18next/no-literal-string
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
    font-family: ${headingFont};
    opacity: 0.7;
  }
`

export interface LanguageSelectorExtraProps {
  click: unknown
}

export type LanguageSelectorProps = React.HTMLAttributes<HTMLDivElement> &
  LanguageSelectorExtraProps

const LanguageSelector: React.FC<LanguageSelectorProps> = (props) => {
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
        {Object.entries(arr).map(([key, o], index) => (
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
                <Image
                  src={o.image}
                  data-attribute={o.image}
                  id={`country-flag-${index}`}
                  alt={t("language-language", { language: key })}
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
