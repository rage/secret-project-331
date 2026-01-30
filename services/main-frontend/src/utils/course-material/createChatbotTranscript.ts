import { REMOVE_CITATIONS_REGEX } from "./chatbotCitationRegexes"

import { renumberFilterCitations } from "@/components/course-material/chatbot/shared/MessageBubble"
import { ChatbotConversationInfo } from "@/shared-module/common/bindings"

export const createChatbotTranscript = (info: ChatbotConversationInfo) => {
  let messages = info.current_conversation_messages
  if (messages === null || messages.length === 0) {
    throw new Error("Couldn't create a chatbot conversation transcript. The conversation is empty.")
  }
  const citations = info.current_conversation_message_citations ?? []
  const bot = info.chatbot_name
  const hideCitations = info.hide_citations
  let msgsWithCitations = new Set()
  if (!hideCitations) {
    msgsWithCitations = new Set(
      info.current_conversation_message_citations?.map((c) => c.conversation_message_id),
    )
  }
  let latestCitNumber = 0
  let anyCitationsUsed = false
  let citationList = "________________________________________________________\n\nReferences\n\n"

  let transcript = messages
    ?.map((m) => {
      if (m.message === null) {
        return ""
      }
      let msg = m.message

      if (m.message_role !== "user" && m.message_role !== "assistant") {
        // don't put system or tool messages in the transcript
        return ""
      }
      if (m.tool_call_fields.length !== 0) {
        // don't put tool calls in the transcript
        return ""
      }
      let t = ""
      // the role is either user or assistant because of the condition above
      let name = m.message_role === "user" ? "You" : bot
      t += `[${name} said:]\n`

      if (hideCitations && m.message_role === "assistant") {
        t += msg.replace(REMOVE_CITATIONS_REGEX, "") + "\n\n"
        return t
      }

      // if there are citations, process them and modify msg
      if (m.message_role === "assistant" && msgsWithCitations.has(m.id)) {
        let currentCitations = citations.filter((c) => c.conversation_message_id === m.id)
        // citationNumberingMap should contain the same numbers as the filteredCitations array
        let { filteredCitations, citationNumberingMap } = renumberFilterCitations(
          msg,
          currentCitations,
          true,
        )
        anyCitationsUsed = filteredCitations.length > 0 || anyCitationsUsed
        filteredCitations
          .sort((a, b) =>
            citationNumberingMap.get(a.citation_number) <
            citationNumberingMap.get(b.citation_number)
              ? -1
              : 1,
          )
          .forEach((cit) => {
            // the 1st cit in this message has number 1 in citationNumberingMap
            // add to it the last cit number from the prev message, so that
            // the numbers are unique across the whole transcript.
            let newCitNumber = citationNumberingMap.get(cit.citation_number) + latestCitNumber
            msg = msg.replaceAll(`[doc${cit.citation_number}]`, `[doc${newCitNumber}]`)
            citationList += `[doc${newCitNumber}] ${cit.title}, ${cit.document_url}\n`
          })
        // latest_cit_n should equal the largest cit number in this message
        latestCitNumber += filteredCitations.length
      }
      t += msg + "\n\n"

      return t
    })
    .join("")

  // add the references list to the transcript only on this condition
  if (!hideCitations && anyCitationsUsed) {
    transcript += citationList
  }

  return transcript.trim()
}
