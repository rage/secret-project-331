import type { UpdateCertificateConfigurationData } from "@/generated/api/types.generated"

export const createCertificateConfigurationFormData = (
  metadata: UpdateCertificateConfigurationData["body"],
  files: ReadonlyArray<File>,
): FormData => {
  const formData = new FormData()

  formData.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }))

  files.forEach((file) => {
    formData.append("file", file)
  })

  return formData
}
