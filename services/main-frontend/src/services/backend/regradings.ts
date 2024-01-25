import { isNumber } from "lodash"

import { NewRegrading, Regrading, RegradingInfo } from "../../shared-module/common/bindings"
import { isRegrading, isRegradingInfo } from "../../shared-module/common/bindings.guard"
import { PaginationInfo } from "../../shared-module/common/hooks/usePaginationInfo"
import { isArray, isUuid, validateResponse } from "../../shared-module/common/utils/fetching"
import { mainFrontendClient } from "../mainFrontendClient"

export const fetchAllRegradings = async (pagination: PaginationInfo): Promise<Regrading[]> => {
  const response = await mainFrontendClient.get(`/regradings`, {
    params: { page: pagination.page, limit: pagination.limit },
  })
  return validateResponse(response, isArray(isRegrading))
}

export const fetchRegradingsCount = async (): Promise<number> => {
  const response = await mainFrontendClient.get(`/regradings/count`)
  return validateResponse(response, isNumber)
}

export const createNewRegrading = async (newRegrading: NewRegrading): Promise<string> => {
  const response = await mainFrontendClient.post(`/regradings`, newRegrading)
  return validateResponse(response, isUuid)
}

export const fetchRegradingInfo = async (regradingId: string): Promise<RegradingInfo> => {
  const response = await mainFrontendClient.get(`/regradings/${regradingId}`)
  return validateResponse(response, isRegradingInfo)
}
