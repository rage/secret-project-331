import { act, renderHook } from "@testing-library/react"

import useMessageChannel from "../../src/hooks/useMessageChannel"

test("useMessageChannel returns a message channel and recreate function", () => {
  // @ts-expect-error: jsdom does not have MessageChannel
  window.MessageChannel = jest.fn().mockReturnValue({ port1: {}, port2: {} })
  const { result } = renderHook(() => useMessageChannel())
  expect(result.current[0]).not.toBeNull()
  expect(result.current[1]).toBeInstanceOf(Function)
})

test("recreateChannel creates a new MessageChannel", () => {
  window.MessageChannel = jest.fn(() => ({ port1: {}, port2: {} }))
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
