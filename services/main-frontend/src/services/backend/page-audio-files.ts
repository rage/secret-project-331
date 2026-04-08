import { queryOptions } from "@tanstack/react-query"

import { getPageAudioFilesOptions as getPageAudioFilesGeneratedOptions } from "@/generated/api/@tanstack/react-query.generated"
import {
  createPageAudioFile as createPageAudioFileFromApi,
  getPageAudioFiles as getPageAudioFilesFromApi,
} from "@/generated/api/sdk.generated"
import type { PageAudioFile as GeneratedPageAudioFile } from "@/generated/api/types.generated"
import { PageAudioFile } from "@/shared-module/common/bindings"
import { validateFile } from "@/shared-module/common/utils/files"

const normalizePageAudioFile = (pageAudioFile: GeneratedPageAudioFile): PageAudioFile => ({
  ...pageAudioFile,
  deleted_at: pageAudioFile.deleted_at ?? null,
})

export const postPageAudioFile = async (pageId: string, file: File): Promise<boolean> => {
  validateFile(file, ["audio"])

  return await createPageAudioFileFromApi({
    path: {
      page_id: pageId,
    },
    body: {
      file: file as unknown as number[],
    },
    throwOnError: true,
  })
}

export const fetchPageAudioFiles = async (pageId: string): Promise<PageAudioFile[]> => {
  const pageAudioFiles = await getPageAudioFilesFromApi({
    path: {
      page_id: pageId,
    },
    throwOnError: true,
  })

  return pageAudioFiles.map(normalizePageAudioFile)
}

export const getPageAudioFilesOptions = (pageId: string) =>
  queryOptions({
    ...getPageAudioFilesGeneratedOptions({
      path: {
        page_id: pageId,
      },
    }),
    select: (pageAudioFiles): PageAudioFile[] => pageAudioFiles.map(normalizePageAudioFile),
  })
