import { matchSpecifiedCitationNumberRegex, REMOVE_CITATIONS_REGEX } from "./chatbotCitationRegexes"

import { renumberFilterCitations } from "@/components/course-material/chatbot/shared/MessageBubble"
import type { ChatbotConversationInfo } from "@/generated/course-material-api/types.generated"
import { zChatbotConversationMessageMessage } from "@/generated/course-material-api/zod.generated"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

export const createChatbotTranscript = (info: ChatbotConversationInfo) => {
  const messages = info.current_conversation_messages
  if (!messages || messages.length === 0) {
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
    .map((m) => {
      const originalMessage = zChatbotConversationMessageMessage.safeParse(m.message)
      console.log(originalMessage)
      if (!originalMessage.success) {
        // don't put tool messages or reasoning in the transcript
        console.log("11111111")
        return ""
      }

      let msg = originalMessage.data

      if (msg.message_role !== "user" && msg.message_role !== "assistant") {
        // don't put system or tool messages in the transcript
        console.log("222222222")

        return ""
      }
      let t = ""
      // the role is either user or assistant because of the condition above
      let name = msg.message_role === "user" ? "You" : bot
      t += `[${name} said:]\n`

      if (hideCitations && msg.message_role === "assistant") {
        t += msg.text.replace(REMOVE_CITATIONS_REGEX, "") + "\n\n"
        return t
      }

      // if there are citations, process them and modify msg
      if (msg.message_role === "assistant" && msgsWithCitations.has(m.id)) {
        let currentCitations = citations.filter((c) => c.conversation_message_id === m.id)
        // citationNumberingMap should contain the same numbers as the filteredCitations array
        let { filteredCitations, citationNumberingMap } = renumberFilterCitations(
          msg.text,
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
            let newCitNumber =
              assertNotNullOrUndefined(citationNumberingMap.get(cit.citation_number)) +
              latestCitNumber
            let re = matchSpecifiedCitationNumberRegex(cit.citation_number)
            msg.text = msg.text.replaceAll(re, `[doc${newCitNumber}]`)
            citationList += `[doc${newCitNumber}] ${cit.title}, ${cit.document_url}\n`
          })
        // latest_cit_n should equal the largest cit number in this message
        latestCitNumber += filteredCitations.length
      }
      t += msg.text + "\n\n"

      return t
    })
    .join("")

  // add the references list to the transcript only on this condition
  if (!hideCitations && anyCitationsUsed) {
    transcript += citationList
  }

  return transcript.trim()
}
