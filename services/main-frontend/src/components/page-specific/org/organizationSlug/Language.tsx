import React from "react"

import Austria from "../../../../imgs/flags/Austria.svg"
import Belgium from "../../../../imgs/flags/Belgium.svg"
import Croatia from "../../../../imgs/flags/Croatia.svg"
import Czech from "../../../../imgs/flags/Czech.svg"
import Denmark from "../../../../imgs/flags/Denmark.svg"
import Estonia from "../../../../imgs/flags/Estonia.svg"
import Finland from "../../../../imgs/flags/Finland.svg"
import France from "../../../../imgs/flags/France.svg"
import Germany from "../../../../imgs/flags/Germany.svg"
import Greece from "../../../../imgs/flags/Greece.svg"
import Ireland from "../../../../imgs/flags/Ireland.svg"
import Italy from "../../../../imgs/flags/Italy.svg"
import Latvia from "../../../../imgs/flags/Latvia.svg"
import Lithuania from "../../../../imgs/flags/Lithuania.svg"
import Netherlands from "../../../../imgs/flags/Netherlands.svg"
import Norway from "../../../../imgs/flags/Norway.svg"
import Poland from "../../../../imgs/flags/Poland.svg"
import Portugal from "../../../../imgs/flags/Portugal.svg"
import Romania from "../../../../imgs/flags/Romania.svg"
import Slovenia from "../../../../imgs/flags/Slovenia.svg"
import Spain from "../../../../imgs/flags/Spain.svg"
import Sweden from "../../../../imgs/flags/Sweden.svg"
import USA from "../../../../imgs/flags/USA.svg"
import UK from "../../../../imgs/flags/United_Kingdom.svg"

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
