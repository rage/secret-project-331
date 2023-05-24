import {
  CourseModuleCertificateConfigurationUpdate,
  CourseModuleCompletionCertificate,
} from "../../shared-module/bindings"
import { isCourseModuleCompletionCertificate } from "../../shared-module/bindings.guard"
import { isArray, validateResponse } from "../../shared-module/utils/fetching"
import { mainFrontendClient } from "../mainFrontendClient"

export const generateCertificate = async (
  courseModuleId: string,
  courseInstanceId: string,
  nameOnCertificate: string,
): Promise<void> => {
  const data = {
    course_module_id: courseModuleId,
    course_instance_id: courseInstanceId,
    name_on_certificate: nameOnCertificate,
  }
  await mainFrontendClient.post(`/certificates/generate`, data, {
    responseType: "json",
  })
}

export const fetchCertificate = async (
  courseModuleId: string,
  courseInstanceId: string,
): Promise<CourseModuleCompletionCertificate | null> => {
  const res = await mainFrontendClient.get(
    `/certificates/course-module/${courseModuleId}/course-instance/${courseInstanceId}`,
  )
  return validateResponse(res, isCourseModuleCompletionCertificate)
}

export const fetchCertificatesForCourseInstance = async (
  courseInstanceId: string,
): Promise<Array<CourseModuleCompletionCertificate>> => {
  const res = await mainFrontendClient.get(
    `/course-instances/${courseInstanceId}/certificate-configurations`,
  )
  return validateResponse(res, isArray(isCourseModuleCompletionCertificate))
}

export const fetchCertificateImage = async (
  certificateVerificationId: string,
  debug: boolean,
): Promise<Blob> => {
  const res = await mainFrontendClient.get(`/certificates/${certificateVerificationId}`, {
    params: debug ? { debug: true } : undefined,
    responseType: "blob",
  })
  return res.data
}

export const updateCertificateConfiguration = async (
  configurationUpdate: CourseModuleCertificateConfigurationUpdate,
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
  await mainFrontendClient.post("/certificates", formData)
}

export const deleteCertificateConfiguration = async (configurationId: string): Promise<void> => {
  await mainFrontendClient.delete(`/certificates/configuration/${configurationId}`)
}
