import { queryOptions } from "@tanstack/react-query"

import { validateGeneratedData } from "./generated"

import {
  getCertificateByConfigurationIdOptions as getCertificateByConfigurationIdGeneratedOptions,
  getCertificateByVerificationIdOptions as getCertificateByVerificationIdGeneratedOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import { client as generatedApiClient } from "@/generated/api/client.generated"
import {
  deleteCertificateConfiguration as deleteCertificateConfigurationFromApi,
  generateCertificate as generateCertificateFromApi,
  getCertificateByConfigurationId as getCertificateByConfigurationIdFromApi,
  getCertificateByVerificationId as getCertificateByVerificationIdFromApi,
  updateCertificateConfiguration as updateCertificateConfigurationFromApi,
} from "@/generated/api/sdk.generated"
import type { GetCertificateByVerificationIdData } from "@/generated/api/types.generated"
import {
  CertificateConfigurationUpdate,
  GeneratedCertificate,
} from "@/shared-module/common/bindings"
import { isGeneratedCertificate } from "@/shared-module/common/bindings.guard"
import { isNull, isUnion } from "@/shared-module/common/utils/fetching"

const CERTIFICATE_BY_VERIFICATION_PATH: GetCertificateByVerificationIdData["url"] =
  "/api/v0/main-frontend/certificates/{certificate_verification_id}"

export const generateCertificate = async (
  certificateConfigurationId: string,
  nameOnCertificate: string,
  grade: string,
): Promise<void> => {
  await generateCertificateFromApi({
    body: {
      certificate_configuration_id: certificateConfigurationId,
      name_on_certificate: nameOnCertificate,
      grade,
    },
    throwOnError: true,
  })
}

export const fetchCertificate = async (
  certificateConfigurationId: string,
): Promise<GeneratedCertificate | null> => {
  const data = await getCertificateByConfigurationIdFromApi({
    path: {
      certificate_configuration_id: certificateConfigurationId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isUnion(isGeneratedCertificate, isNull))
}

export const getCertificateByConfigurationIdOptions = (certificateConfigurationId: string) =>
  queryOptions({
    ...getCertificateByConfigurationIdGeneratedOptions({
      path: {
        certificate_configuration_id: certificateConfigurationId,
      },
    }),
    select: (data): GeneratedCertificate | null =>
      validateGeneratedData(data, isUnion(isGeneratedCertificate, isNull)),
  })

export const getCertificateImageUrl = (certificateVerificationId: string): string =>
  generatedApiClient.buildUrl({
    path: {
      certificate_verification_id: certificateVerificationId,
    },
    url: CERTIFICATE_BY_VERIFICATION_PATH,
  })

export const fetchCertificateImage = async (
  certificateVerificationId: string,
  debug: boolean,
  testCourseModuleId: string | undefined,
  _testCourseInstanceId: string | undefined,
): Promise<Blob> => {
  const data = await getCertificateByVerificationIdFromApi({
    parseAs: "blob",
    path: {
      certificate_verification_id: certificateVerificationId,
    },
    query: {
      debug,
      test_certificate_configuration_id: testCourseModuleId,
    },
    throwOnError: true,
  })

  if (data instanceof Blob) {
    return data
  }

  throw new Error("Invalid certificate image response")
}

export const getCertificateByVerificationIdOptions = (
  certificateVerificationId: string,
  debug: boolean,
  testCourseModuleId: string | undefined,
) =>
  queryOptions({
    ...getCertificateByVerificationIdGeneratedOptions({
      parseAs: "blob",
      path: {
        certificate_verification_id: certificateVerificationId,
      },
      query: {
        debug,
        test_certificate_configuration_id: testCourseModuleId,
      },
    }),
    select: (data): Blob => {
      if (data instanceof Blob) {
        return data
      }

      throw new Error("Invalid certificate image response")
    },
  })

export const updateCertificateConfiguration = async (
  configurationUpdate: CertificateConfigurationUpdate,
  backgroundSvgFile: File | null,
  overlaySvgFile: File | null,
): Promise<void> => {
  const files = [overlaySvgFile, backgroundSvgFile].filter((file): file is File => file !== null)

  await updateCertificateConfigurationFromApi({
    body: {
      metadata: JSON.stringify(configurationUpdate),
      file: files as unknown as number[][],
    },
    throwOnError: true,
  })
}

export const deleteCertificateConfiguration = async (configurationId: string): Promise<void> => {
  await deleteCertificateConfigurationFromApi({
    path: {
      certificate_configuration_id: configurationId,
    },
    throwOnError: true,
  })
}
