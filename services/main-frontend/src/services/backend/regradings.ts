import { queryOptions } from "@tanstack/react-query"
import { isNumber } from "lodash"

import {
  createRegradingMutation,
  getRegradingInfoOptions as getRegradingInfoGeneratedOptions,
  getRegradingsCountOptions as getRegradingsCountGeneratedOptions,
  getRegradingsOptions as getRegradingsGeneratedOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import {
  createRegrading as createRegradingFromApi,
  getRegradingInfo as getRegradingInfoFromApi,
  getRegradingsCount as getRegradingsCountFromApi,
  getRegradings as getRegradingsFromApi,
} from "@/generated/api/sdk.generated"
import { NewRegrading, Regrading, RegradingInfo } from "@/shared-module/common/bindings"
import { isRegrading, isRegradingInfo } from "@/shared-module/common/bindings.guard"
import { PaginationInfo } from "@/shared-module/common/hooks/usePaginationInfo"
import { isArray, isUuid } from "@/shared-module/common/utils/fetching"

const validateGeneratedData = <T>(data: unknown, isT: (value: unknown) => value is T): T => {
  if (isT(data)) {
    return data
  }

  throw new Error(`Invalid data from API: ${JSON.stringify(data, undefined, 2)}`)
}

export const fetchAllRegradings = async (pagination: PaginationInfo): Promise<Regrading[]> => {
  const data = await getRegradingsFromApi({
    query: {
      page: pagination.page,
      limit: pagination.limit,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isRegrading))
}

export const getRegradingsOptions = (pagination: PaginationInfo) =>
  queryOptions({
    ...getRegradingsGeneratedOptions({
      query: {
        page: pagination.page,
        limit: pagination.limit,
      },
    }),
    select: (data): Regrading[] => validateGeneratedData(data, isArray(isRegrading)),
  })

export const fetchRegradingsCount = async (): Promise<number> => {
  const data = await getRegradingsCountFromApi({
    throwOnError: true,
  })

  return validateGeneratedData(data, isNumber)
}

export const getRegradingsCountOptions = () =>
  queryOptions({
    ...getRegradingsCountGeneratedOptions(),
    select: (data): number => validateGeneratedData(data, isNumber),
  })

export const createNewRegrading = async (newRegrading: NewRegrading): Promise<string> => {
  const data = await createRegradingFromApi({
    body: newRegrading,
    throwOnError: true,
  })

  return validateGeneratedData(data, isUuid)
}

export const createNewRegradingMutationOptions = () => createRegradingMutation()

export const fetchRegradingInfo = async (regradingId: string): Promise<RegradingInfo> => {
  const data = await getRegradingInfoFromApi({
    path: {
      regrading_id: regradingId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isRegradingInfo)
}

export const getRegradingInfoOptions = (regradingId: string) =>
  queryOptions({
    ...getRegradingInfoGeneratedOptions({
      path: {
        regrading_id: regradingId,
      },
    }),
    select: (data): RegradingInfo => validateGeneratedData(data, isRegradingInfo),
  })
