import type { ChatbotChatStreamEvent } from "@/generated/course-material-api/types.generated"

import type { ChatbotAction } from "./chatbotReducer"

/**
 * Applies a chatbot response stream to the chat state, returning once the turn has ended.
 *
 * Shared by `send-message` and `tool-response`, which answer with the same stream: an answer that
 * was the last one a suspended turn waited for resumes it and streams the continuation, and one
 * that was not carries a lone `Suspended`.
 *
 * Errors the stream reports go to `setError` instead of being thrown, because the turn can carry
 * on producing output after one.
 */
const readChatbotResponseStream = async (
  stream: ReadableStream<Uint8Array>,
  dispatch: (action: ChatbotAction) => void,
  setError: (error: unknown) => void,
): Promise<void> => {
  const reader = stream.getReader()

  /** Applies one event line, returning true once a terminal event has arrived. */
  const handleLine = (line: string): boolean => {
    if (line.trim() === "") {
      return false
    }
    try {
      const parsedValue: ChatbotChatStreamEvent = JSON.parse(line)
      if (parsedValue.type === "Delta") {
        dispatch({
          type: "RECEIVED_TEXT_DELTA",
          payload: { text: parsedValue.data.text, message_id: parsedValue.data.message_id },
        })
      } else if (parsedValue.type === "Reasoning") {
        dispatch(
          parsedValue.data.finished
            ? {
                type: "REASONING_FINISHED",
                payload: { reasoning_id: parsedValue.data.reasoning_id },
              }
            : {
                type: "REASONING_IN_PROGRESS",
                payload: { reasoning_id: parsedValue.data.reasoning_id },
              },
        )
      } else if (parsedValue.type === "ToolCall") {
        dispatch(
          parsedValue.data.finished
            ? {
                type: "TOOL_CALL_FINISHED",
                payload: { tool_call_id: parsedValue.data.tool_call_id },
              }
            : { type: "TOOL_CALL_IN_PROGRESS", payload: { ...parsedValue.data } },
        )
      } else if (parsedValue.type === "Error") {
        setError(parsedValue.data)
      } else if (parsedValue.type === "Done" || parsedValue.type === "Suspended") {
        // Suspended ends the turn without an answer: the chatbot is waiting for a client tool
        // call to be answered. Reading on would hang until the server closes the stream.
        return true
      }
    } catch (e) {
      console.error(e)
    }
    return false
  }

  // The response is newline-delimited JSON, not SSE, despite its text/event-stream content type.
  // One decoder for the whole stream so multi-byte characters split across chunks survive.
  const decoder = new TextDecoder()
  let buffer = ""
  let terminated = false
  try {
    while (!terminated) {
      const { done, value } = await reader.read()
      if (value) {
        buffer += decoder.decode(value, { stream: true })
      }
      if (done) {
        buffer += decoder.decode()
      }
      const lines = buffer.split("\n")
      // The last element has no newline behind it yet: empty, or an event still being sent.
      buffer = done ? "" : (lines.pop() ?? "")
      for (const line of lines) {
        if (handleLine(line)) {
          terminated = true
          break
        }
      }
      if (done) {
        break
      }
    }
  } finally {
    // A terminal event leaves the rest of the body unread, and an undrained body holds its
    // connection open for as long as the reader keeps the lock.
    try {
      await reader.cancel()
    } catch (_e) {
      // The body is already gone; nothing left to release.
    }
  }
}

export default readChatbotResponseStream
