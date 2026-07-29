import { act, renderHook } from "@testing-library/react"

import useMessageChannel from "../../src/useMessageChannel"
import { createMockMessageChannel } from "../utils/iframeTestUtils"

test("useMessageChannel returns a message channel and recreate function", () => {
  window.MessageChannel = jest.fn().mockImplementation(function () {
    return createMockMessageChannel()
  }) as unknown as typeof MessageChannel
  const { result } = renderHook(() => useMessageChannel())
  expect(result.current[0]).not.toBeNull()
  expect(result.current[1]).toBeInstanceOf(Function)
})

test("recreateChannel creates a new MessageChannel", () => {
  window.MessageChannel = jest.fn().mockImplementation(function () {
    return createMockMessageChannel()
  }) as unknown as typeof MessageChannel
  const { result } = renderHook(() => useMessageChannel())

  const [firstChannel] = result.current
  const recreate = result.current[1]

  act(() => {
    recreate()
  })

  const [secondChannel] = result.current

  expect(secondChannel).not.toBe(firstChannel)
  expect(secondChannel).not.toBeNull()
})
