import { streamOf } from "../../__fixtures__/chatbotResponseStream"
import type { ChatbotAction } from "../chatbotReducer"
import readChatbotResponseStream from "../readChatbotResponseStream"

const encode = (text: string) => new TextEncoder().encode(text)

const lineOf = (event: unknown) => `${JSON.stringify(event)}\n`

const delta = (text: string, messageId = "m1") => ({
  type: "Delta",
  data: { text, message_id: messageId },
})

const run = async (chunks: Uint8Array[]) => {
  const actions: ChatbotAction[] = []
  const errors: unknown[] = []
  const { stream, wasCancelled } = streamOf(chunks)
  await readChatbotResponseStream(
    stream,
    (action) => actions.push(action),
    (error) => errors.push(error),
  )
  return { actions, errors, wasCancelled }
}

describe("readChatbotResponseStream", () => {
  it("dispatches a delta for each complete line", async () => {
    const { actions } = await run([encode(lineOf(delta("Hello")) + lineOf(delta(" world")))])

    expect(actions).toEqual([
      { type: "RECEIVED_TEXT_DELTA", payload: { text: "Hello", message_id: "m1" } },
      { type: "RECEIVED_TEXT_DELTA", payload: { text: " world", message_id: "m1" } },
    ])
  })

  it("carries a partial line over to the next read", async () => {
    const line = lineOf(delta("split across reads"))
    const cut = Math.floor(line.length / 2)
    const { actions } = await run([encode(line.slice(0, cut)), encode(line.slice(cut))])

    expect(actions).toEqual([
      { type: "RECEIVED_TEXT_DELTA", payload: { text: "split across reads", message_id: "m1" } },
    ])
  })

  it("delivers a tool call whose line is split across reads", async () => {
    const line = lineOf({
      type: "ToolCall",
      data: {
        finished: false,
        tool_call_id: "call-1",
        tool_name: "ask_multiple_choice_question",
        arguments: '{"question":"Which loop?"}',
      },
    })
    const cut = line.indexOf("tool_call_id")
    const { actions } = await run([encode(line.slice(0, cut)), encode(line.slice(cut))])

    expect(actions).toEqual([
      {
        type: "TOOL_CALL_IN_PROGRESS",
        payload: {
          finished: false,
          tool_call_id: "call-1",
          tool_name: "ask_multiple_choice_question",
          arguments: '{"question":"Which loop?"}',
        },
      },
    ])
  })

  it.each([
    ["a two-byte character", "ä"],
    ["a four-byte emoji", "🎉"],
  ])("decodes %s split across a chunk boundary", async (_name, char) => {
    const text = `start ${char} end`
    const line = lineOf(delta(text))
    // Halfway through that character's own bytes, where a per-chunk decoder emits U+FFFD.
    const bytesBeforeChar = encode(line.slice(0, line.indexOf(char))).length
    const cut = bytesBeforeChar + Math.floor(encode(char).length / 2)
    const bytes = encode(line)
    const { actions } = await run([bytes.slice(0, cut), bytes.slice(cut)])

    expect(actions).toEqual([{ type: "RECEIVED_TEXT_DELTA", payload: { text, message_id: "m1" } }])
  })

  it("stops reading at Done and cancels the body", async () => {
    const { actions, wasCancelled } = await run([
      encode(lineOf(delta("before"))),
      encode(lineOf({ type: "Done" }) + lineOf(delta("after"))),
      encode(lineOf(delta("never read"))),
    ])

    expect(actions).toEqual([
      { type: "RECEIVED_TEXT_DELTA", payload: { text: "before", message_id: "m1" } },
    ])
    expect(wasCancelled()).toBe(true)
  })

  it("stops reading at Suspended, which ends a turn that is waiting for a tool answer", async () => {
    const { actions, wasCancelled } = await run([
      encode(lineOf({ type: "Suspended" }) + lineOf(delta("after"))),
    ])

    expect(actions).toEqual([])
    expect(wasCancelled()).toBe(true)
  })

  it("reports an Error event through setError without throwing", async () => {
    const { actions, errors } = await run([
      encode(lineOf({ type: "Error", data: "Something went wrong" }) + lineOf(delta("still here"))),
    ])

    expect(errors).toEqual(["Something went wrong"])
    expect(actions).toEqual([
      { type: "RECEIVED_TEXT_DELTA", payload: { text: "still here", message_id: "m1" } },
    ])
  })

  it("skips a malformed line and keeps applying the rest", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {})
    try {
      const { actions, errors } = await run([encode("{not json\n" + lineOf(delta("after")))])

      expect(actions).toEqual([
        { type: "RECEIVED_TEXT_DELTA", payload: { text: "after", message_id: "m1" } },
      ])
      expect(errors).toEqual([])
      expect(consoleError).toHaveBeenCalled()
    } finally {
      consoleError.mockRestore()
    }
  })

  it("applies a trailing line that arrives without a newline before the stream ends", async () => {
    const { actions } = await run([encode(JSON.stringify(delta("no trailing newline")))])

    expect(actions).toEqual([
      { type: "RECEIVED_TEXT_DELTA", payload: { text: "no trailing newline", message_id: "m1" } },
    ])
  })

  it("emits REASONING_FINISHED only once the reasoning event is finished", async () => {
    const { actions } = await run([
      encode(
        lineOf({ type: "Reasoning", data: { finished: false, reasoning_id: "r1" } }) +
          lineOf({ type: "Reasoning", data: { finished: true, reasoning_id: "r1" } }),
      ),
    ])

    expect(actions).toEqual([
      { type: "REASONING_IN_PROGRESS", payload: { reasoning_id: "r1" } },
      { type: "REASONING_FINISHED", payload: { reasoning_id: "r1" } },
    ])
  })
})
