import "@testing-library/jest-dom"

import { getMessagePartsCitationPairs } from "../MessageBubble"

describe("MessageBubble", () => {
  describe("getMessagePartsCitationPairs", () => {
    const exampleUserMessage = "Hi [dsds] [doc2] can you teach me chatbot? [23]."

    const exampleChatbotMessage = `Certainly! The Chinese abacus [doc1], known as the "suanpan," dates back to the Han Dynasty, around the 2nd century BCE [doc1]. It features a [dsdsg] bead-and-rod system, typically with two beads on the upper deck [doc23] and five beads on the lower deck per rod, operating on a decimal system.`

    const exampleChatbotMessage2 = `Certainly! The Chinese abacus, known as the "suanpan," dates back to the Han Dynasty, around the 2nd century BCE. It features a [dsdsg] bead-and-rod system, typically with two beads on the upper deck and five beads on the lower deck per rod, operating on a decimal system.`

    it("doesn't alter anything when it's an user message", () => {
      const isFromChatbot = false
      const { pairs, citedDocs, alteredMessage } = getMessagePartsCitationPairs(
        exampleUserMessage,
        isFromChatbot,
      )
      expect(pairs).toStrictEqual([])
      expect(citedDocs).toStrictEqual([])
      expect(alteredMessage).toStrictEqual(exampleUserMessage)
    })

    it("finds all the citations, removes them from the message, and forms correct pairs", () => {
      const isFromChatbot = true
      const { pairs, citedDocs, alteredMessage } = getMessagePartsCitationPairs(
        exampleChatbotMessage,
        isFromChatbot,
      )
      const expectedPairs = [
        { msg: "Certainly! The Chinese abacus ", cit_n: 1 },
        {
          msg: `, known as the "suanpan," dates back to the Han Dynasty, around the 2nd century BCE `,
          cit_n: 1,
        },
        {
          msg: ". It features a [dsdsg] bead-and-rod system, typically with two beads on the upper deck ",
          cit_n: 23,
        },
        {
          msg: " and five beads on the lower deck per rod, operating on a decimal system.",
          cit_n: undefined,
        },
      ]
      const expectedAlteredMsg = exampleChatbotMessage2

      expect(pairs).toStrictEqual(expectedPairs)
      expect(citedDocs).toStrictEqual([1, 1, 23])
      expect(alteredMessage).toStrictEqual(expectedAlteredMsg)
    })

    it("works even if the chatbot message has no citations", () => {
      const isFromChatbot = true
      const { pairs, citedDocs, alteredMessage } = getMessagePartsCitationPairs(
        exampleChatbotMessage2,
        isFromChatbot,
      )
      const expectedPairs = [{ msg: exampleChatbotMessage2, cit_n: undefined }]

      expect(pairs).toStrictEqual(expectedPairs)
      expect(citedDocs).toStrictEqual([])
      expect(alteredMessage).toStrictEqual(exampleChatbotMessage2)
    })
  })
})
