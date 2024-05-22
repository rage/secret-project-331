import { mainFrontendClient } from "../mainFrontendClient"

import { TermUpdate } from "@/shared-module/common/bindings"

export const updateTerm = async (
  termId: string,
  newTerm: string,
  newDefinition: string,
): Promise<void> => {
  const update: TermUpdate = { term: newTerm, definition: newDefinition }
  await mainFrontendClient.put(`/glossary/${termId}`, update)
}

export const deleteTerm = async (termId: string): Promise<void> => {
  await mainFrontendClient.delete(`/glossary/${termId}`)
}
