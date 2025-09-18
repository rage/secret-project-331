import "@testing-library/jest-dom"

import { renumberFilterCitations } from "../Chatbot/MessageBubble"

import { ChatbotConversationMessageCitation } from "@/shared-module/common/bindings"
import { REMOVE_CITATIONS_REGEX } from "@/utils/chatbotCitationRegexes"

describe("MessageBubble", () => {
  describe("renumberFilterCitations", () => {
    const exampleChatbotMessage = `Certainly! The Chinese abacus [doc3], known as the "suanpan," dates back to the Han Dynasty, around the 2nd century BCE [doc3]. It features a [dsdsg] bead-and-rod system, typically with two beads on the upper deck [doc12] and five beads on the lower deck per rod [doc5], operating on a decimal system.`
    const exampleCitedDocs = [3, 3, 12, 5]

    const exampleChatbotMessage2 = `Certainly! The Chinese abacus [doc1], known as the "suanpan," dates back to the Han Dynasty, around the 2nd century BCE [doc2]. It features a [dsdsg] bead-and-rod system, typically with two beads on the upper deck [doc3] and five beads on the lower deck per rod [doc4], operating on a decimal system.`
    const exampleCitedDocs2 = [1, 2, 3, 4]

    const exampleChatbotMessageNoCitations = `Certainly! The Chinese abacus, known as the "suanpan," dates back to the Han Dynasty, around the 2nd century BCE. It features a [dsdsg] bead-and-rod system, typically with two beads on the upper deck and five beads on the lower deck per rod, operating on a decimal system.`

    const exampleChatbotMessageCitations: ChatbotConversationMessageCitation[] = [
      // cit 1 and 4 have the same url
      {
        id: "a",
        created_at: "",
        citation_number: 1,
        content: "",
        conversation_id: "",
        conversation_message_id: "",
        course_material_chapter_number: null,
        deleted_at: null,
        document_url: "url14",
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
        document_url: "url2",
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
        document_url: "url3",
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
        document_url: "url14",
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
        document_url: "url5",
        title: "",
        updated_at: "",
      },
      {
        id: "f",
        created_at: "",
        citation_number: 12,
        content: "",
        conversation_id: "",
        conversation_message_id: "",
        course_material_chapter_number: null,
        deleted_at: null,
        document_url: "url12",
        title: "",
        updated_at: "",
      },
    ]

    it("filters out the citations that don't appear in the message and sorts and renumbers them based on when they appear", () => {
      const { filteredCitations, citedDocs, citationNumberingMap } = renumberFilterCitations(
        exampleChatbotMessage,
        exampleChatbotMessageCitations,
        true,
      )
      expect(filteredCitations).toStrictEqual([
        {
          id: "c",
          created_at: "",
          citation_number: 3,
          content: "",
          conversation_id: "",
          conversation_message_id: "",
          course_material_chapter_number: null,
          deleted_at: null,
          document_url: "url3",
          title: "",
          updated_at: "",
        },
        {
          id: "f",
          created_at: "",
          citation_number: 12,
          content: "",
          conversation_id: "",
          conversation_message_id: "",
          course_material_chapter_number: null,
          deleted_at: null,
          document_url: "url12",
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
          document_url: "url5",
          title: "",
          updated_at: "",
        },
      ])

      expect(citedDocs).toStrictEqual(exampleCitedDocs)
      // check each filteredCitations number to see if they map to the order in
      // which they appear in the text.
      expect(citationNumberingMap.get(3)).toEqual(1)
      expect(citationNumberingMap.get(12)).toEqual(2)
      expect(citationNumberingMap.get(5)).toEqual(3)
    })

    it("works when the citations are already in the correct numbered order", () => {
      const { filteredCitations, citedDocs, citationNumberingMap } = renumberFilterCitations(
        exampleChatbotMessage2,
        exampleChatbotMessageCitations,
        true,
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
          document_url: "url14",
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
          document_url: "url2",
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
          document_url: "url3",
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
          document_url: "url14",
          title: "",
          updated_at: "",
        },
      ])
      expect(citedDocs).toStrictEqual(exampleCitedDocs2)
      // check each filteredCitations number to see if they map to the order in
      // which they appear in the text.
      expect(citationNumberingMap.get(1)).toEqual(1)
      expect(citationNumberingMap.get(2)).toEqual(2)
      expect(citationNumberingMap.get(3)).toEqual(3)
      expect(citationNumberingMap.get(4)).toEqual(1)
    })

    it("works if the msg has no citations but is associated with cited docs", () => {
      const { filteredCitations, citedDocs } = renumberFilterCitations(
        exampleChatbotMessageNoCitations,
        exampleChatbotMessageCitations,
        true,
      )
      expect(filteredCitations).toStrictEqual([])
      expect(citedDocs).toStrictEqual([])
    })

    it("is true that the remove citations regex works", () => {
      const removedCitations = exampleChatbotMessage.replace(REMOVE_CITATIONS_REGEX, "")
      expect(removedCitations).toStrictEqual(exampleChatbotMessageNoCitations)
    })
  })
})
