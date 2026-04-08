import { queryOptions } from "@tanstack/react-query"

import {
  addCodeGiveawayCodesMutation,
  createCodeGiveawayMutation,
  deleteCodeGiveawayCodeMutation,
  getCodeGiveawayByIdOptions as getCodeGiveawayByIdGeneratedOptions,
  getCodeGiveawayCodesOptions as getCodeGiveawayCodesGeneratedOptions,
  getCodeGiveawaysByCourseOptions as getCodeGiveawaysByCourseGeneratedOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import {
  addCodeGiveawayCodes as addCodeGiveawayCodesFromApi,
  createCodeGiveaway as createCodeGiveawayFromApi,
  deleteCodeGiveawayCode as deleteCodeGiveawayCodeFromApi,
  downloadCodeGiveawayCodesCsv as downloadCodeGiveawayCodesCsvFromApi,
  getCodeGiveawayById as getCodeGiveawayByIdFromApi,
  getCodeGiveawayCodes as getCodeGiveawayCodesFromApi,
  getCodeGiveawaysByCourse as getCodeGiveawaysByCourseFromApi,
} from "@/generated/api/sdk.generated"
import type {
  CodeGiveaway as GeneratedCodeGiveaway,
  CodeGiveawayCode as GeneratedCodeGiveawayCode,
} from "@/generated/api/types.generated"
import { CodeGiveaway, CodeGiveawayCode, NewCodeGiveaway } from "@/shared-module/common/bindings"

export interface DownloadedCsvFile {
  blob: Blob
  fileName: string
}

const normalizeCodeGiveaway = (codeGiveaway: GeneratedCodeGiveaway): CodeGiveaway => ({
  ...codeGiveaway,
  course_module_id: codeGiveaway.course_module_id ?? null,
  deleted_at: codeGiveaway.deleted_at ?? null,
  require_course_specific_consent_form_question_id:
    codeGiveaway.require_course_specific_consent_form_question_id ?? null,
})

const normalizeCodeGiveawayCode = (
  codeGiveawayCode: GeneratedCodeGiveawayCode,
): CodeGiveawayCode => ({
  ...codeGiveawayCode,
  code_given_to_user_id: codeGiveawayCode.code_given_to_user_id ?? null,
  deleted_at: codeGiveawayCode.deleted_at ?? null,
})

export const fetchCodeGiveawaysByCourse = async (courseId: string): Promise<CodeGiveaway[]> => {
  const codeGiveaways = await getCodeGiveawaysByCourseFromApi({
    path: {
      course_id: courseId,
    },
    throwOnError: true,
  })

  return codeGiveaways.map(normalizeCodeGiveaway)
}

export const getCodeGiveawaysByCourseOptions = (courseId: string) =>
  queryOptions({
    ...getCodeGiveawaysByCourseGeneratedOptions({
      path: {
        course_id: courseId,
      },
    }),
    select: (codeGiveaways): CodeGiveaway[] => codeGiveaways.map(normalizeCodeGiveaway),
  })

export const createCodeGiveaway = async (input: NewCodeGiveaway): Promise<CodeGiveaway> => {
  const codeGiveaway = await createCodeGiveawayFromApi({
    body: input,
    throwOnError: true,
  })

  return normalizeCodeGiveaway(codeGiveaway)
}

export const createCodeGiveawayMutationOptions = () => createCodeGiveawayMutation()

export const fetchCodeGiveawayById = async (id: string): Promise<CodeGiveaway> => {
  const codeGiveaway = await getCodeGiveawayByIdFromApi({
    path: {
      id,
    },
    throwOnError: true,
  })

  return normalizeCodeGiveaway(codeGiveaway)
}

export const getCodeGiveawayByIdOptions = (id: string) =>
  queryOptions({
    ...getCodeGiveawayByIdGeneratedOptions({
      path: {
        id,
      },
    }),
    select: (codeGiveaway): CodeGiveaway => normalizeCodeGiveaway(codeGiveaway),
  })

export const fetchCodesByCodeGiveawayId = async (id: string): Promise<CodeGiveawayCode[]> => {
  const codes = await getCodeGiveawayCodesFromApi({
    path: {
      id,
    },
    throwOnError: true,
  })

  return codes.map(normalizeCodeGiveawayCode)
}

export const getCodeGiveawayCodesOptions = (id: string) =>
  queryOptions({
    ...getCodeGiveawayCodesGeneratedOptions({
      path: {
        id,
      },
    }),
    select: (codes): CodeGiveawayCode[] => codes.map(normalizeCodeGiveawayCode),
  })

export const addCodesToCodeGiveaway = async (
  id: string,
  codes: string[],
): Promise<CodeGiveawayCode[]> => {
  const createdCodes = await addCodeGiveawayCodesFromApi({
    path: {
      id,
    },
    body: codes,
    throwOnError: true,
  })

  return createdCodes.map(normalizeCodeGiveawayCode)
}

export const addCodeGiveawayCodesMutationOptions = () => addCodeGiveawayCodesMutation()

export const downloadCodeGiveawayCodesCsv = async (
  id: string,
  fileName = `code-giveaway-${id}-codes.csv`,
): Promise<DownloadedCsvFile> => {
  const data: unknown = await downloadCodeGiveawayCodesCsvFromApi({
    parseAs: "blob",
    path: {
      id,
    },
    throwOnError: true,
  })

  if (!(data instanceof Blob)) {
    throw new Error("Invalid code giveaway CSV response")
  }

  return {
    blob: data,
    fileName,
  }
}

export const deleteCodeGiveawayCode = async (id: string, codeId: string): Promise<void> => {
  await deleteCodeGiveawayCodeFromApi({
    path: {
      id,
      code_id: codeId,
    },
    throwOnError: true,
  })
}

export const deleteCodeGiveawayCodeMutationOptions = () => deleteCodeGiveawayCodeMutation()
