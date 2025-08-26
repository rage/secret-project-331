import { getRemarkable } from "../getRemarkable"

describe("getRemarkable", () => {
  const exampleMessageCitations = `**Certainly!** The Chinese abacus [doc3], known as the "suanpan," dates back to the Han Dynasty, around the 2nd century BCE [doc3]. It features a [dsdsg] bead-and-rod system, typically with two beads on the upper deck [doc1] and five beads on the lower deck per rod [doc5], operating on a decimal system.`

  const exampleMessageNoCitations = `**Certainly!** The Chinese abacus, known as the "suanpan," dates back to the Han Dynasty, around the 2nd century BCE. It features a [dsdsg] bead-and-rod system, typically with two beads on the upper deck and five beads on the lower deck per rod, operating on a decimal system.`

  let md = getRemarkable()

  it("works and doesn't crash with a message with citations", () => {
    const rendered = md.render(exampleMessageCitations).trim()

    expect(rendered).toStrictEqual(
      `<p><strong>Certainly!</strong> The Chinese abacus <span data-chatbot-citation="true" data-citation-n="3"></span>, known as the &quot;suanpan,&quot; dates back to the Han Dynasty, around the 2nd century BCE <span data-chatbot-citation="true" data-citation-n="3"></span>. It features a [dsdsg] bead-and-rod system, typically with two beads on the upper deck <span data-chatbot-citation="true" data-citation-n="1"></span> and five beads on the lower deck per rod <span data-chatbot-citation="true" data-citation-n="5"></span>, operating on a decimal system.</p>`,
    )
  })

  it("works and doesn't crash with a message with no citations", () => {
    const rendered = md.render(exampleMessageNoCitations).trim()

    expect(rendered).toStrictEqual(
      `<p><strong>Certainly!</strong> The Chinese abacus, known as the &quot;suanpan,&quot; dates back to the Han Dynasty, around the 2nd century BCE. It features a [dsdsg] bead-and-rod system, typically with two beads on the upper deck and five beads on the lower deck per rod, operating on a decimal system.</p>`,
    )
  })
})
