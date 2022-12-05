import { Download } from "playwright"

export const downloadToString = async (download: Download): Promise<string> => {
  const readStream = await download.createReadStream()
  if (readStream === null) {
    throw new Error("Downloding file failed")
  }
  const data: Buffer[] = []
  for await (const chunk of readStream) {
    data.push(Buffer.from(chunk))
  }

  return Buffer.concat(data).toString("utf-8")
}
