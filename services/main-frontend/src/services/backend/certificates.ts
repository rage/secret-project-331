import { mainFrontendClient } from "../mainFrontendClient"

import {
  CertificateConfigurationUpdate,
  GeneratedCertificate,
} from "@/shared-module/common/bindings"
import { isGeneratedCertificate } from "@/shared-module/common/bindings.guard"
import { isArray, validateResponse } from "@/shared-module/common/utils/fetching"

export const generateCertificate = async (
  certificateConfigurationId: string,
  nameOnCertificate: string,
): Promise<void> => {
  const data = {
    certificate_configuration_id: certificateConfigurationId,
    name_on_certificate: nameOnCertificate,
  }
  await mainFrontendClient.post(`/certificates/generate`, data)
}

export const fetchCertificate = async (
  certificateConfigurationId: string,
): Promise<GeneratedCertificate | null> => {
  const res = await mainFrontendClient.get(
    `/certificates/get-by-configuration-id/${certificateConfigurationId}`,
  )
  return validateResponse(res, isGeneratedCertificate)
}

export const fetchCertificatesForCourseInstance = async (
  courseInstanceId: string,
): Promise<Array<GeneratedCertificate>> => {
  const res = await mainFrontendClient.get(
    `/course-instances/${courseInstanceId}/default-certificate-configurations`,
  )
  return validateResponse(res, isArray(isGeneratedCertificate))
}

export const fetchCertificateImage = async (
  certificateVerificationId: string,
  debug: boolean,
  testCourseModuleId: string | undefined,
  testCourseInstanceId: string | undefined,
): Promise<Blob> => {
  let params:
    | {
        debug?: boolean
        test_certificate_configuration_id?: string
        test_course_instance_id?: string
      }
    | undefined = {}
  if (debug) {
    params.debug = true
  }
  if (testCourseModuleId) {
    params.test_certificate_configuration_id = testCourseModuleId
  }
  if (testCourseInstanceId) {
    params.test_course_instance_id = testCourseInstanceId
  }
  if (Object.keys(params).length === 0) {
    params = undefined
  }
  const res = await mainFrontendClient.get(`/certificates/${certificateVerificationId}`, {
    params,
    responseType: "blob",
  })
  return res.data
}

export const updateCertificateConfiguration = async (
  configurationUpdate: CertificateConfigurationUpdate,
  backgroundSvgFile: File | null,
  overlaySvgFile: File | null,
): Promise<void> => {
  const formData = new FormData()
  // sets the content-disposition to json
  formData.append(
    "metadata",
    new Blob([JSON.stringify(configurationUpdate)], { type: "application/json" }),
    "metadata",
  )
  if (overlaySvgFile !== null && configurationUpdate.overlay_svg_file_name !== null) {
    formData.append("file", overlaySvgFile, configurationUpdate.overlay_svg_file_name)
  }
  if (backgroundSvgFile !== null && configurationUpdate.background_svg_file_name !== null) {
    formData.append("file", backgroundSvgFile, configurationUpdate.background_svg_file_name)
  }
  await mainFrontendClient.post("/certificates", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  })
}

export const deleteCertificateConfiguration = async (configurationId: string): Promise<void> => {
  await mainFrontendClient.delete(`/certificates/configuration/${configurationId}`)
}
