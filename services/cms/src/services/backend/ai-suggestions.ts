import { cmsClient } from "./cmsClient"

import type {
  ParagraphSuggestionRequest,
  ParagraphSuggestionResponse,
} from "@/shared-module/common/bindings"
import { isParagraphSuggestionResponse } from "@/shared-module/common/bindings.guard"
import { validateResponse } from "@/shared-module/common/utils/fetching"

/**
 * Sends a ParagraphSuggestionRequest to `/ai-suggestions/paragraph` and returns a validated ParagraphSuggestionResponse.
 * Uses `validateResponse` with `isParagraphSuggestionResponse`; throws on request or validation failures.
 */
export async function requestParagraphSuggestions(
  payload: ParagraphSuggestionRequest,
): Promise<ParagraphSuggestionResponse> {
  const response = await cmsClient.post("/ai-suggestions/paragraph", payload)
  return validateResponse(response, isParagraphSuggestionResponse)
}
