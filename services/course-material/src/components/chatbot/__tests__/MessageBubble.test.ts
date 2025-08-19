import "@testing-library/jest-dom"
import { zipWith } from "lodash"

// TODO this shouldn't be here
// captures citations
const MATCH_CITATIONS_REGEX = /\[[\w]*?([\d]+)\]/g
// don't capture citations, just detect
const SPLIT_AT_CITATIONS_REGEX = /\[[\w]*?[\d]+\]/g
// also matches a starting whitespace that should be removed
const REPLACE_CITATIONS_REGEX = /\s\[[a-z]*?[0-9]+\]/g

export const getMessagePartsCitationPairs = (message: string, isFromChatbot: boolean) => {
  let pairs: {
    msg: string
    cit_n: number
  }[] = []
  let citedDocs: number[] = []

  // if the message is from user, there are no citations for it so no need to
  // process further
  if (!isFromChatbot) {
    return { pairs, citedDocs, alteredMessage: message }
  }

  citedDocs = Array.from(message.matchAll(MATCH_CITATIONS_REGEX), (arr, _) => parseInt(arr[1]))
  let messageParts = message.split(SPLIT_AT_CITATIONS_REGEX)
  pairs = zipWith(messageParts, citedDocs, (m, c) => {
    return { msg: m, cit_n: c }
  })

  const messageNoCitations = message.replace(REPLACE_CITATIONS_REGEX, "")

  return { pairs, citedDocs, alteredMessage: messageNoCitations }
}
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
