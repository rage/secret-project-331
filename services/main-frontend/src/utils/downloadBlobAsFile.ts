export const downloadBlobAsFile = (blob: Blob, fileName: string) => {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement("a")

  link.href = url
  link.setAttribute("download", fileName)

  try {
    document.body.append(link)
    link.click()
    link.parentNode?.removeChild(link)
  } finally {
    window.URL.revokeObjectURL(url)
  }
}
