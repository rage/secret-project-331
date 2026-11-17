"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import type { MouseEvent } from "react"

import ChatbotChat from "@/components/course-material/chatbot/shared/ChatbotChat"
import ChatbotChatBox from "@/components/course-material/ContentRenderer/moocfi/ChatbotBlock/ChatbotChatBox"
import { getChatbotEmbedConfOptions } from "@/generated/api/@tanstack/react-query.generated"
import { client as mainApiClient } from "@/generated/api/client.generated"
import { client as courseMaterialApiClient } from "@/generated/course-material-api/client.generated"
import { client as authApiClient } from "@/shared-module/common/generated/auth-api/client.generated"
import { client as errorsApiClient } from "@/shared-module/common/generated/errors-api/client.generated"
import { QueryResult } from "@/shared-module/components"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

// The embed always runs in the anonymous-token mode. Same-site embedders (e.g. mooc.fi) would
// otherwise send the visitor's courses.mooc.fi session cookie into the frame. Browser-only: on the
// server these clients are shared by every request.
if (typeof window !== "undefined") {
  for (const apiClient of [
    mainApiClient,
    courseMaterialApiClient,
    authApiClient,
    errorsApiClient,
  ]) {
    // oxlint-disable-next-line i18next/no-literal-string -- fetch option, not UI text
    apiClient.setConfig({ credentials: "omit" })
  }
}

/**
 * Retargets a clicked link to the embedding page's window instead of the iframe.
 *
 * Runs in the capture phase so the target is set before the browser (or a Next `Link`)
 * acts on the click. Links that already name a target and in-page `#` links are left alone.
 */
const openLinkInEmbeddingPage = (event: MouseEvent<HTMLDivElement>) => {
  if (!(event.target instanceof Element)) {
    return
  }
  const link = event.target.closest("a[href]")
  if (
    !(link instanceof HTMLAnchorElement) ||
    link.target ||
    link.getAttribute("href")?.startsWith("#")
  ) {
    return
  }
  // oxlint-disable-next-line i18next/no-literal-string -- browsing context keyword, not UI text
  link.target = "_top"
}

const ChatbotEmbed = () => {
  const { id } = useParams<{ id: string }>()
  const chatBotQuery = useQuery({
    ...optionalGeneratedQueryOptions({
      value: id,
      build: (value) =>
        getChatbotEmbedConfOptions({
          path: {
            chatbot_id: value,
          },
        }),
    }),
    enabled: Boolean(id),
    select: () => true,
  })

  return (
    <div onClickCapture={openLinkInEmbeddingPage}>
      <QueryResult query={chatBotQuery} emptyFallback>
        {() => (
          <div
            className={css`
              height: 100vh;
            `}
          >
            <ChatbotChat chatbotConfigurationId={id} isAlwaysOpen={true} pageId={null}>
              <ChatbotChatBox hideEditChatbot />
            </ChatbotChat>
          </div>
        )}
      </QueryResult>
    </div>
  )
}

export default ChatbotEmbed
