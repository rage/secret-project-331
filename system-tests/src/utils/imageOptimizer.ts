import { spawnSync } from "child_process"
import { readFile, writeFile } from "fs/promises"
// @ts-expect-error: no typescript definitions
import pngMetadata from "png-metadata"

export async function ensureImageHasBeenOptimized(pathToImage: string): Promise<void> {
  if (!(await hasImageBeenOptimizedBefore(pathToImage))) {
    console.info(`Image "${pathToImage}" has not been optimized before. Optimizing now.`)
    const res = spawnSync("oxipng", ["-o", "4", pathToImage], { stdio: "inherit" })
    if (res.error) {
      console.error(`Error: Could not optimize image "${pathToImage}": ${res.error}`)
      throw res.error
    }
    await markImageAsOptimized(pathToImage)
  }
}

async function hasImageBeenOptimizedBefore(pathToImage: string): Promise<boolean> {
  const contents = await readFile(pathToImage, "binary")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listOfPngMetadataChunks: any[] = pngMetadata.splitChunk(contents)
  const chunkTypes = listOfPngMetadataChunks.map((o) => o.type)
  console.log(JSON.stringify({ chunkTypes }, undefined, 2))
  return listOfPngMetadataChunks.some((chunk) => chunk.data === "moocfi-optimized")
}

async function markImageAsOptimized(pathToImage: string): Promise<void> {
  const contents = await readFile(pathToImage, "binary")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listOfPngMetadataChunks: any[] = pngMetadata.splitChunk(contents)
  const iend = listOfPngMetadataChunks.pop()
  listOfPngMetadataChunks.push(pngMetadata.createChunk("aaaa", "moocfi-optimized"))
  listOfPngMetadataChunks.push(iend)
  const newContents = pngMetadata.joinChunk(listOfPngMetadataChunks)
  await writeFile(pathToImage, newContents, "binary")
}
