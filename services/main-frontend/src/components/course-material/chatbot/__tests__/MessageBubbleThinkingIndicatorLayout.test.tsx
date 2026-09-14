"use client"

import "@testing-library/jest-dom"
import { render } from "@testing-library/react"

import MessageBubble from "../shared/MessageBubble"
import RenderedMessage, { MessageRenderType } from "../shared/RenderedMessage"

const NOOP_RENDERED_MESSAGE_PROPS = {
  citationNumberingMap: new Map<number, number>(),
  citationButtonClicked: false,
  currentTriggerId: undefined,
  handleClick: () => {},
  hoverCitationProps: {},
}

describe("Thinking indicator stays on the streamed text's line", () => {
  it("makes the streamed message's last block inline while pending, so its line has room for the dots", () => {
    const { container } = render(
      <MessageBubble
        message="The abacus is an ancient calculator."
        isFromChatbot={true}
        isPending={true}
        citations={undefined}
      />,
    )

    const lastParagraph = container.querySelector("p")!
    expect(getComputedStyle(lastParagraph).display).toBe("inline")

    // The dots must be a sibling of the message span with nothing block-level between them, or
    // they would still wrap onto their own line regardless of the paragraph's own display.
    const thinkingIndicator = container.querySelector('[aria-hidden="true"]')
    expect(thinkingIndicator).not.toBeNull()
    // the last paragraph is two levels deeper than the thinking indicator
    // so its second parent's next sibling should be the thinking indicator
    expect(lastParagraph.parentElement!.parentElement!.nextElementSibling).toBe(thinkingIndicator)
  })

  it("leaves the message's normal paragraph layout alone once the turn is no longer pending", () => {
    const { container } = render(
      <MessageBubble
        message="The abacus is an ancient calculator."
        isFromChatbot={true}
        isPending={false}
        citations={undefined}
      />,
    )

    const lastParagraph = container.querySelector("p")!
    expect(getComputedStyle(lastParagraph).display).toBe("block")
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull()
  })

  // A single-paragraph fixture can't tell a correct "last child" rule from one that targets the
  // wrong child, or all children, so this pins down the selector against a multi-block answer.
  it("only flattens the trailing paragraph while pending, leaving earlier paragraphs block", () => {
    const { container } = render(
      <RenderedMessage
        renderOption={MessageRenderType.ChatbotNoCitations}
        message={"First paragraph.\n\nSecond paragraph."}
        isPending={true}
        {...NOOP_RENDERED_MESSAGE_PROPS}
      />,
    )

    const [firstParagraph, secondParagraph] = Array.from(container.querySelectorAll("p"))
    expect(getComputedStyle(firstParagraph!).display).toBe("block")
    expect(getComputedStyle(secondParagraph!).display).toBe("inline")
  })

  // A streamed answer can legitimately end in a list; forcing that inline would mangle it, so the
  // fallback here is to accept the indicator wrapping onto its own line instead.
  it("leaves a trailing list block instead of flattening it inline", () => {
    const { container } = render(
      <RenderedMessage
        renderOption={MessageRenderType.ChatbotNoCitations}
        message={"Steps:\n\n- item one\n- item two"}
        isPending={true}
        {...NOOP_RENDERED_MESSAGE_PROPS}
      />,
    )

    const list = container.querySelector("ul")!
    expect(getComputedStyle(list).display).toBe("block")
  })

  // The citations render path used to render its own markup without ever receiving `isPending`,
  // so a message expanded to show citations while still streaming lost the inline fix entirely.
  it("also flattens the trailing paragraph on the citations render path", () => {
    const { container } = render(
      <RenderedMessage
        renderOption={MessageRenderType.ChatbotWithCitations}
        message={"First paragraph.\n\nSecond paragraph."}
        isPending={true}
        {...NOOP_RENDERED_MESSAGE_PROPS}
      />,
    )

    const [firstParagraph, secondParagraph] = Array.from(container.querySelectorAll("p"))
    expect(getComputedStyle(firstParagraph!).display).toBe("block")
    expect(getComputedStyle(secondParagraph!).display).toBe("inline")
  })
})
