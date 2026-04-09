export const downloadTextFile = (
  contents: string,
  fileName: string,
  mimeType = "text/csv;charset=utf-8",
) => {
  const blob = new Blob([contents], { type: mimeType })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement("a")

  link.href = url
  link.setAttribute("download", fileName)

  try {
    document.body.appendChild(link)
    link.click()
    link.parentNode?.removeChild(link)
  } finally {
    window.URL.revokeObjectURL(url)
  }
}
