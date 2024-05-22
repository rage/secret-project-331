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
  "bg-BG": { humanReadableName: "belgium", image: Belgium },
  "fi-FI": { humanReadableName: "finnish", image: Finland },
  "fr-BE": { humanReadableName: "belgium-french", image: Belgium },
  "de-AT": { humanReadableName: "german", image: Austria },
  "pt-PT": { humanReadableName: "portugal", image: Portugal },
  "da-DK": { humanReadableName: "danish", image: Denmark },
  "de-DE": { humanReadableName: "german", image: Germany },
  "sv-SE": { humanReadableName: "swedish", image: Sweden },
  "en-US": { humanReadableName: "english", image: USA },
  "en-GB": { humanReadableName: "english", image: UK, clipPath: "circle(25% at 50% 50%)" },
  "nl-NL": { humanReadableName: "dutch", image: Netherlands },
  "nl-BE": { humanReadableName: "dutch-belgium", image: Netherlands },
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

export default LANGUAGE
