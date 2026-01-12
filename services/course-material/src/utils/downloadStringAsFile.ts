type fileExtension = "txt" | "pdf"

export const downloadStringAsFile = (s: string, extension: fileExtension, fileName: string) => {
  let fileT = extension === "txt" ? "text/plain" : extension === "pdf" ? "application/pdf" : ""
  let b = new Blob([s], { type: fileT })
  const url = window.URL.createObjectURL(b)

  const downloadLink = document.createElement("a")
  downloadLink.href = url
  downloadLink.setAttribute("download", `${fileName}.${extension}`)
  document.body.appendChild(downloadLink)
  downloadLink.click()
  // remove the link after download
  downloadLink.parentNode?.removeChild(downloadLink)
}
