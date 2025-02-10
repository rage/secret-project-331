
import { renderHook } from "@testing-library/react"

import useMessageChannel from "../../src/hooks/useMessageChannel"

test("useMessageChannel returns a message channel", () => {
  // @ts-ignore: jsdom does not have MessageChannel
  window.MessageChannel = jest.fn().mockReturnValue({ port1: {}, port2: {} })
  const { result } = renderHook(() => useMessageChannel())
  expect(result).not.toBeNull()
})
