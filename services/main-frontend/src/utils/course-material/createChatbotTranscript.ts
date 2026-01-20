import { REMOVE_CITATIONS_REGEX } from "./chatbotCitationRegexes"

import { renumberFilterCitations } from "@/components/course-material/chatbot/shared/MessageBubble"
import { ChatbotConversationInfo } from "@/shared-module/common/bindings"

export const createChatbotTranscript = (info: ChatbotConversationInfo) => {
  let messages = info.current_conversation_messages
  if (messages === null || messages.length === 0) {
    throw new Error("Couldn't create a chatbot conversation transcript. The conversation is empty.")
  }
  let citations = info.current_conversation_message_citations ?? []
  let bot = info.chatbot_name
  let hide_citations = info.hide_citations
  let msgs_w_citations = new Set()
  if (!hide_citations) {
    msgs_w_citations = new Set(
      info.current_conversation_message_citations?.map((c) => c.conversation_message_id),
    )
  }
  let latest_cit_n = 0
  let any_citations_used = false
  let citation_list = "________________________________________________________\n\nReferences\n\n"

  let transcript = messages
    ?.map((m) => {
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

      if (hide_citations) {
        t += m.message?.replace(REMOVE_CITATIONS_REGEX, "") + "\n\n"
        return t
      }

      // if there are citations, process them and modify m.message
      if (m.message_role === "assistant" && msgs_w_citations.has(m.id) && m.message !== null) {
        let current_citations = citations.filter((c) => c.conversation_message_id === m.id)
        // citationNumberingMap should contain the same numbers as the filteredCitations array
        let { filteredCitations, citationNumberingMap } = renumberFilterCitations(
          m.message,
          current_citations,
          true,
        )
        any_citations_used = filteredCitations.length > 0 ? true : any_citations_used
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
            let new_cit_n = citationNumberingMap.get(cit.citation_number) + latest_cit_n
            m.message =
              m.message?.replaceAll(`[doc${cit.citation_number}]`, `[doc${new_cit_n}]`) ?? null
            citation_list += `[doc${new_cit_n}] ${cit.title}, ${cit.document_url}\n`
          })
        // latest_cit_n should equal the largest cit number in this message
        latest_cit_n += filteredCitations.length
      }
      t += m.message + "\n\n"

      return t
    })
    .join("")

  // add the references list to the transcript only on this condition
  transcript += !hide_citations && any_citations_used ? citation_list : ""

  return transcript.trim()
}
