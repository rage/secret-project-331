import { Remarkable } from "remarkable"
import { ContentToken, Options, Rule, StateInline } from "remarkable/lib"

let md: Remarkable | null = null

const chatbotCitationParser = (state: StateInline) => {
  // parser for parsing chatbot citations from text.
  // matches [docn] where n is a digit
  let citationTag = /^\[doc\d\]$/g

  let marker = ""
  for (let i = 0; i < 6; i++) {
    let newPos = state.pos + i
    // if the source string ended, then there's no match and return
    if (newPos > state.posMax) {
      return false
    }
    marker = marker.concat(state.src.charAt(newPos))
  }

  // check if the current pos starts a string that matches our tag [docn]
  if (!marker.match(citationTag)) {
    return false
  }
  // we found our tag in the source so let's create a token and update the state pos
  // to signify that we have identified these 6 characters in the source string
  state.pos += 6
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
  // tokens contains the surrounding tokens and this specific token. tokens are created
  // in the parser and contain the marker as token.content

  // the content is the marker, so:  [docn]
  // the doc number is the 4th index
  const citationN = tokens[idx].content.charAt(4)
  // !!!!!!!!!!!! not unique across all messages, problem?
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
