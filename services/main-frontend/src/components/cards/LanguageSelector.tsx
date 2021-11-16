import styled from "@emotion/styled"
import Image from "next/image"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import Close from "../../imgs/close.svg"
import Austria from "../../imgs/flags/Austria.svg"
import Belgium from "../../imgs/flags/Belgium.svg"
import Croatia from "../../imgs/flags/Croatia.svg"
import Czech from "../../imgs/flags/Czech.svg"
import Denmark from "../../imgs/flags/Denmark.svg"
import Estonia from "../../imgs/flags/Estonia.svg"
import Finland from "../../imgs/flags/Finland.svg"
import France from "../../imgs/flags/France.svg"
import Germany from "../../imgs/flags/Germany.svg"
import Greece from "../../imgs/flags/Greece.svg"
import Ireland from "../../imgs/flags/Ireland.svg"
import Italy from "../../imgs/flags/Italy.svg"
import Latvia from "../../imgs/flags/Latvia.svg"
import Lithuania from "../../imgs/flags/Lithuania.svg"
import Netherlands from "../../imgs/flags/Netherlands.svg"
import Norway from "../../imgs/flags/Norway.svg"
import Poland from "../../imgs/flags/Poland.svg"
import Portugal from "../../imgs/flags/Portugal.svg"
import Romania from "../../imgs/flags/Romania.svg"
import Slovenia from "../../imgs/flags/Slovenia.svg"
import Spain from "../../imgs/flags/Spain.svg"
import Sweden from "../../imgs/flags/Sweden.svg"
import USA from "../../imgs/flags/USA.svg"
import Tick from "../../imgs/tick-03.svg"
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
  "nl-NL": { humanReadableName: "dutch", image: Netherlands },
  // eslint-disable-next-line i18next/no-literal-string
  "nl-BE": { humanReadableName: "dutch-belgium", image: Netherlands },
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
