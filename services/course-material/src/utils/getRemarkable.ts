import { Remarkable } from "remarkable"
import { ContentToken, Options, Rule, StateInline } from "remarkable/lib"

import { MATCH_CITATION_TAG_REGEX } from "./chatbotCitationRegexes"

let md: Remarkable | null = null

const chatbotCitationParser = (state: StateInline) => {
  /** parser for parsing chatbot citations from text.
  matches `[docn]` where n is a sequence of digits 0-9 */
  let digitRegex = /^\d$/

  if (state.src.charAt(state.pos) !== "[") {
    return false
  }

  let newPos = state.pos
  newPos += 1

  if (state.src.charAt(newPos) !== "d") {
    return false
  }
  newPos += 1
  if (state.src.charAt(newPos) !== "o") {
    return false
  }
  newPos += 1
  if (state.src.charAt(newPos) !== "c") {
    return false
  }

  for (let i = 0; i < 1000; i++) {
    newPos += 1
    if (newPos >= state.posMax) {
      return false
    }
    let char = state.src.charAt(newPos)
    if (!char.match(digitRegex)) {
      if (i === 0) {
        // there needs to be at least one digit
        return false
      }
      if (!char.match("]")) {
        return false
      }
      break
    }
  }
  newPos += 1
  let marker = state.src.slice(state.pos, newPos)

  // double check if the current pos starts a string that matches our tag
  if (!marker.match(MATCH_CITATION_TAG_REGEX)) {
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

  // the content is the marker, so: `[docn]`
  // the doc number n is at the 4th index
  const marker: string = tokens[idx].content
  const citationN = marker.slice(4, marker.length - 1)
  let htmlString = `<span data-chatbot-citation="true" data-citation-n="${citationN}"></span>`
  return htmlString
}

let chatbotCitation: Remarkable.Plugin = (md) => {
  md.inline.ruler.push("chatbotCitation", chatbotCitationParser, {})
  md.renderer.rules.chatbotCitation = chatbotCitationRenderer
}

export const getRemarkable = () => {
  if (md === null) {
    md = new Remarkable()
    md.use(chatbotCitation)
  }
  return md
}
