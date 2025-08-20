import "@testing-library/jest-dom"

import { renumberFilterCitations } from "../Chatbot/MessageBubble"
import { REMOVE_CITATIONS_REGEX } from "../Chatbot/RenderedMessage"

import { ChatbotConversationMessageCitation } from "@/shared-module/common/bindings"

describe("MessageBubble", () => {
  describe("renumberFilterCitations", () => {
    const exampleChatbotMessage = `Certainly! The Chinese abacus [doc3], known as the "suanpan," dates back to the Han Dynasty, around the 2nd century BCE [doc3]. It features a [dsdsg] bead-and-rod system, typically with two beads on the upper deck [doc1] and five beads on the lower deck per rod [doc5], operating on a decimal system.`

    const exampleChatbotMessage2 = `Certainly! The Chinese abacus [doc1], known as the "suanpan," dates back to the Han Dynasty, around the 2nd century BCE [doc2]. It features a [dsdsg] bead-and-rod system, typically with two beads on the upper deck [doc3] and five beads on the lower deck per rod [doc4], operating on a decimal system.`

    const exampleChatbotMessageNoCitations = `Certainly! The Chinese abacus, known as the "suanpan," dates back to the Han Dynasty, around the 2nd century BCE. It features a [dsdsg] bead-and-rod system, typically with two beads on the upper deck and five beads on the lower deck per rod, operating on a decimal system.`

    const exampleChatbotMessageCitations: ChatbotConversationMessageCitation[] = [
      {
        id: "a",
        created_at: "",
        citation_number: 1,
        content: "",
        conversation_id: "",
        conversation_message_id: "",
        course_material_chapter_number: null,
        deleted_at: null,
        document_url: "",
        title: "",
        updated_at: "",
      },
      {
        id: "b",
        created_at: "",
        citation_number: 2,
        content: "",
        conversation_id: "",
        conversation_message_id: "",
        course_material_chapter_number: null,
        deleted_at: null,
        document_url: "",
        title: "",
        updated_at: "",
      },
      {
        id: "c",
        created_at: "",
        citation_number: 3,
        content: "",
        conversation_id: "",
        conversation_message_id: "",
        course_material_chapter_number: null,
        deleted_at: null,
        document_url: "",
        title: "",
        updated_at: "",
      },
      {
        id: "d",
        created_at: "",
        citation_number: 4,
        content: "",
        conversation_id: "",
        conversation_message_id: "",
        course_material_chapter_number: null,
        deleted_at: null,
        document_url: "",
        title: "",
        updated_at: "",
      },
      {
        id: "e",
        created_at: "",
        citation_number: 5,
        content: "",
        conversation_id: "",
        conversation_message_id: "",
        course_material_chapter_number: null,
        deleted_at: null,
        document_url: "",
        title: "",
        updated_at: "",
      },
    ]

    it("filters out the citations that don't appear in the message and sorts and renumbers them based on when they appear", () => {
      const { filteredCitations } = renumberFilterCitations(
        exampleChatbotMessage,
        exampleChatbotMessageCitations,
      )
      expect(filteredCitations).toStrictEqual([
        {
          id: "c",
          created_at: "",
          citation_number: 1,
          content: "",
          conversation_id: "",
          conversation_message_id: "",
          course_material_chapter_number: null,
          deleted_at: null,
          document_url: "",
          title: "",
          updated_at: "",
        },
        {
          id: "a",
          created_at: "",
          citation_number: 2,
          content: "",
          conversation_id: "",
          conversation_message_id: "",
          course_material_chapter_number: null,
          deleted_at: null,
          document_url: "",
          title: "",
          updated_at: "",
        },
        {
          id: "e",
          created_at: "",
          citation_number: 3,
          content: "",
          conversation_id: "",
          conversation_message_id: "",
          course_material_chapter_number: null,
          deleted_at: null,
          document_url: "",
          title: "",
          updated_at: "",
        },
      ])
    })

    it("works when the citations are already in the correct numbered order", () => {
      const { filteredCitations } = renumberFilterCitations(
        exampleChatbotMessage2,
        exampleChatbotMessageCitations,
      )

      expect(filteredCitations).toStrictEqual([
        {
          id: "a",
          created_at: "",
          citation_number: 1,
          content: "",
          conversation_id: "",
          conversation_message_id: "",
          course_material_chapter_number: null,
          deleted_at: null,
          document_url: "",
          title: "",
          updated_at: "",
        },
        {
          id: "b",
          created_at: "",
          citation_number: 2,
          content: "",
          conversation_id: "",
          conversation_message_id: "",
          course_material_chapter_number: null,
          deleted_at: null,
          document_url: "",
          title: "",
          updated_at: "",
        },
        {
          id: "c",
          created_at: "",
          citation_number: 3,
          content: "",
          conversation_id: "",
          conversation_message_id: "",
          course_material_chapter_number: null,
          deleted_at: null,
          document_url: "",
          title: "",
          updated_at: "",
        },
        {
          id: "d",
          created_at: "",
          citation_number: 4,
          content: "",
          conversation_id: "",
          conversation_message_id: "",
          course_material_chapter_number: null,
          deleted_at: null,
          document_url: "",
          title: "",
          updated_at: "",
        },
      ])
    })

    it("works if the msg has no citations but is associated with cited docs", () => {
      const { filteredCitations } = renumberFilterCitations(
        exampleChatbotMessageNoCitations,
        exampleChatbotMessageCitations,
      )
      expect(filteredCitations).toStrictEqual([])
    })

    it("is true that the remove citations regex works", () => {
      const removedCitations = exampleChatbotMessage.replace(REMOVE_CITATIONS_REGEX, "")
      expect(removedCitations).toStrictEqual(exampleChatbotMessageNoCitations)
    })
  })
})
