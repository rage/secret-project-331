"use client"

import type { UseQueryResult } from "@tanstack/react-query"
import { renderHook } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import type { ReactNode } from "react"

import type { ChatbotConversationInfo } from "@/generated/course-material-api/types.generated"
import {
  defaultChatbotCommunicationChannel,
  defaultChatbotIsTurnInFlight,
} from "@/stores/course-material/chatbotDialogStore"

import useSynchronizeDefaultChatbotCommunicationChannel from "../useSynchronizeDefaultChatbotCommunicationChannel"

// The shared setup mints a new `t` per render, which would hide the dependency churn under test.
jest.mock("react-i18next", () => {
  const translation = { t: (key: string) => key, i18n: { changeLanguage: () => Promise.resolve() } }
  return { useTranslation: () => translation }
})
jest.mock("@/shared-module/common/components/dialogs/DialogProvider", () => {
  const dialog = { confirm: jest.fn() }
  return { useDialog: () => dialog }
})

const CURRENT_CONVERSATION = { id: "11111111-1111-4111-8111-111111111111" }

const refetch = jest.fn()
const mutateNewMessageAsync = jest.fn()
const mutateNewConversationAsync = jest.fn()
const dispatch = jest.fn()

/// A fresh result object holding the same data, as React Query hands out on every render.
const conversationInfo = () =>
  ({ data: { current_conversation: CURRENT_CONVERSATION }, refetch }) as unknown as UseQueryResult<
    ChatbotConversationInfo,
    Error
  >

const renderChannel = () => {
  const store = createStore()
  const channels: unknown[] = []
  store.sub(defaultChatbotCommunicationChannel, () =>
    channels.push(store.get(defaultChatbotCommunicationChannel)),
  )
  const rendered = renderHook(
    ({ isTurnInFlight }: { isTurnInFlight: boolean }) =>
      useSynchronizeDefaultChatbotCommunicationChannel(
        false,
        conversationInfo(),
        mutateNewMessageAsync,
        mutateNewConversationAsync,
        dispatch,
        isTurnInFlight,
      ),
    {
      initialProps: { isTurnInFlight: false },
      wrapper: ({ children }: { children: ReactNode }) => (
        <Provider store={store}>{children}</Provider>
      ),
    },
  )
  return { ...rendered, store, channels }
}

describe("Publishing the course default chatbot channel", () => {
  // The chat re-renders once per streamed token, so rebuilding the channel there would re-render
  // every subscriber that often, each time pinning a stale conversation snapshot in the closure.
  it("keeps one channel across re-renders that only replace the query result object", () => {
    const { rerender, channels } = renderChannel()

    for (let i = 0; i < 5; i++) {
      rerender({ isTurnInFlight: false })
    }

    expect(channels).toHaveLength(1)
  })

  it("reports a turn starting and ending without replacing the channel", () => {
    const { rerender, store, channels } = renderChannel()

    rerender({ isTurnInFlight: true })
    expect(store.get(defaultChatbotIsTurnInFlight)).toBe(true)

    rerender({ isTurnInFlight: false })
    expect(store.get(defaultChatbotIsTurnInFlight)).toBe(false)
    expect(channels).toHaveLength(1)
  })

  it("takes the channel away when the chatbot unmounts", () => {
    const { unmount, store } = renderChannel()

    unmount()

    expect(store.get(defaultChatbotCommunicationChannel)).toBeNull()
    expect(store.get(defaultChatbotIsTurnInFlight)).toBe(false)
  })
})

describe("Sending through the course default chatbot channel", () => {
  it("sends the message through the mutation", async () => {
    const { store } = renderChannel()
    mutateNewMessageAsync.mockClear()

    await store.get(defaultChatbotCommunicationChannel)?.sendNewMessage("hi")

    expect(mutateNewMessageAsync).toHaveBeenCalledWith("hi")
  })

  // Callers fire this from a click handler without awaiting it, so a rejection would surface as an
  // unhandled one; the chatbot shows the failure itself.
  it("does not reject when the mutation fails", async () => {
    const { store } = renderChannel()
    mutateNewMessageAsync.mockClear()
    mutateNewMessageAsync.mockRejectedValueOnce(new Error("boom"))

    await expect(
      store.get(defaultChatbotCommunicationChannel)?.sendNewMessage("hi"),
    ).resolves.toBeUndefined()
  })
})
