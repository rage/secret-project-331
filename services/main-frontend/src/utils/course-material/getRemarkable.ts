import { Remarkable } from "remarkable"
import type { ContentToken, InlineParsingRule, Options, Rule } from "remarkable/lib"

import { MATCH_CITATION_TAG_REGEX } from "./chatbotCitationRegexes"
import { textParser } from "./remarkableTextParser"

let md: Remarkable | null = null

const chatbotCitationParser: InlineParsingRule = (state, checkMode) => {
  /** parser for parsing chatbot citations from text.
  matches `【x:y†source】` where x and y are a sequence of digits 0-9 */
  let digitRegex = /^\d$/

  if (state.src.charAt(state.pos) !== "【") {
    return false
  } else if (checkMode) {
    return true
  }
  let newPos = state.pos

  // check for the digits 'x' until ':' is found
  for (let i = 0; i < 100; i++) {
    newPos += 1
    if (newPos >= state.posMax) {
      return false
    }
    let char = state.src.charAt(newPos)
    if (!digitRegex.test(char)) {
      if (i === 0) {
        // there needs to be at least one digit
        return false
      }
      if (char === ":") {
        break
      } else {
        return false
      }
    }
  }

  // check for the digits 'y' until '†' is found
  for (let i = 0; i < 100; i++) {
    newPos += 1
    if (newPos >= state.posMax) {
      return false
    }
    let char = state.src.charAt(newPos)
    if (!digitRegex.test(char)) {
      if (i === 0) {
        // there needs to be at least one digit
        return false
      }
      if (char !== "†") {
        return false
      }
      break
    }
  }

  newPos += 1
  if (state.src.charAt(newPos) !== "s") {
    return false
  }
  newPos += 1
  if (state.src.charAt(newPos) !== "o") {
    return false
  }
  newPos += 1
  if (state.src.charAt(newPos) !== "u") {
    return false
  }
  newPos += 1
  if (state.src.charAt(newPos) !== "r") {
    return false
  }
  newPos += 1
  if (state.src.charAt(newPos) !== "c") {
    return false
  }
  newPos += 1
  if (state.src.charAt(newPos) !== "e") {
    return false
  }
  newPos += 1
  if (state.src.charAt(newPos) !== "】") {
    return false
  }
  newPos += 1
  let marker = state.src.slice(state.pos, newPos)

  // double check if the current pos starts a string that matches our tag
  if (!MATCH_CITATION_TAG_REGEX.test(marker)) {
    console.warn(
      `Markdown parser caught an incorrect chatbotCitation marker in the double check. Marker: ${marker}. There's a bug in the parser.`,
    )
    return false
  }
  // we found our tag in the source so let's create a token and update the state pos
  // to signify that we have inspected these characters in the source string
  state.pos = newPos
  let token = {
    type: "chatbotCitation",
    level: state.level,
    content: marker,
  }
  state.push(token)

  return true
}

const chatbotCitationRenderer: Rule = (
  tokens: ContentToken[],
  idx: number,
  _options: Options | undefined,
) => {
  // rendering rule to render chatbot citations.
  // `tokens` contains some surrounding tokens and this specific token at `idx`.
  // tokens are created in the parser and contain the marker as token.content

  // the content is the marker, so: `【x:y†source】`
  const marker: string = tokens[idx].content
  const start = marker.indexOf(":") + 1
  const end = marker.length - "†source】".length
  const n = marker.slice(start, end)
  let htmlString = `<span data-chatbot-citation="true" data-citation-n="${n}"></span>`
  return htmlString
}

let chatbotCitation: Remarkable.Plugin = (md) => {
  md.inline.ruler.push("chatbotCitation", chatbotCitationParser, {})
  md.renderer.rules.chatbotCitation = chatbotCitationRenderer
}

let textPlugin: Remarkable.Plugin = (md) => {
  md.inline.ruler.at("text", textParser, {})
}

export const getRemarkable = () => {
  if (md === null) {
    md = new Remarkable()
    md.use(textPlugin)
    md.use(chatbotCitation)
  }
  return md
}
