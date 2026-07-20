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
    document.body.append(link)
    link.click()
    link.remove()
  } finally {
    window.URL.revokeObjectURL(url)
  }
}
