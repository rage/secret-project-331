type FileExtension = "txt" | "pdf"

export const downloadStringAsFile = (s: string, extension: FileExtension, fileName: string) => {
  const fileT = extension === "txt" ? "text/plain" : extension === "pdf" ? "application/pdf" : ""
  const b = new Blob([s], { type: fileT })
  const url = window.URL.createObjectURL(b)

  const downloadLink = document.createElement("a")
  downloadLink.href = url
  downloadLink.setAttribute("download", `${fileName}.${extension}`)
  document.body.appendChild(downloadLink)
  downloadLink.click()
  // remove the link after download
  downloadLink.parentNode?.removeChild(downloadLink)
  window.URL.revokeObjectURL(url)
}
