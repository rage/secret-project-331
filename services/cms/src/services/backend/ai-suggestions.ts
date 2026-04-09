import { cmsClient } from "./cmsClient"
import { parseCmsResponse } from "./parseCmsResponse"

import type { ParagraphSuggestionRequest, ParagraphSuggestionResponse } from "@/generated/api"
import { zParagraphSuggestionResponse } from "@/generated/api/zod.generated"

/**
 * Sends a ParagraphSuggestionRequest to `/ai-suggestions/paragraph` and returns a validated ParagraphSuggestionResponse.
 * Uses `validateResponse` with `isParagraphSuggestionResponse`; throws on request or validation failures.
 */
export async function requestParagraphSuggestions(
  payload: ParagraphSuggestionRequest,
): Promise<ParagraphSuggestionResponse> {
  const response = await cmsClient.post("/ai-suggestions/paragraph", payload)
  return parseCmsResponse(response, zParagraphSuggestionResponse)
}
