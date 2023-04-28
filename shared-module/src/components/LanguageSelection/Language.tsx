import React from "react"

import Austria from "../../img/flags/Austria.svg"
import Belgium from "../../img/flags/Belgium.svg"
import Croatia from "../../img/flags/Croatia.svg"
import Czech from "../../img/flags/Czech.svg"
import Denmark from "../../img/flags/Denmark.svg"
import Estonia from "../../img/flags/Estonia.svg"
import Finland from "../../img/flags/Finland.svg"
import France from "../../img/flags/France.svg"
import Germany from "../../img/flags/Germany.svg"
import Greece from "../../img/flags/Greece.svg"
import Ireland from "../../img/flags/Ireland.svg"
import Italy from "../../img/flags/Italy.svg"
import Latvia from "../../img/flags/Latvia.svg"
import Lithuania from "../../img/flags/Lithuania.svg"
import Netherlands from "../../img/flags/Netherlands.svg"
import Norway from "../../img/flags/Norway.svg"
import Poland from "../../img/flags/Poland.svg"
import Portugal from "../../img/flags/Portugal.svg"
import Romania from "../../img/flags/Romania.svg"
import Slovenia from "../../img/flags/Slovenia.svg"
import Spain from "../../img/flags/Spain.svg"
import Sweden from "../../img/flags/Sweden.svg"
import USA from "../../img/flags/USA.svg"
import UK from "../../img/flags/United_Kingdom.svg"

export const DEFAULT_FLAG_CLIP_PATH = "circle(25% at 42% 50%)"

const LANGUAGE: {
  [languageCode: string]: {
    humanReadableName: string
    image: React.FC<React.PropsWithChildren<React.SVGProps<SVGSVGElement>>>
    clipPath?: string
  }
} = {
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
  "en-GB": { humanReadableName: "english", image: UK, clipPath: "circle(25% at 50% 50%)" },
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

export default LANGUAGE
