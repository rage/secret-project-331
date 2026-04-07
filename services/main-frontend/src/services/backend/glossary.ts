import { deleteGlossaryTermById, updateGlossaryTermById } from "@/services/api/client"

export const updateTerm = async (
  termId: string,
  newTerm: string,
  newDefinition: string,
): Promise<void> => {
  await updateGlossaryTermById(termId, {
    definition: newDefinition,
    term: newTerm,
  })
}

export const deleteTerm = async (termId: string): Promise<void> => {
  await deleteGlossaryTermById(termId)
}
