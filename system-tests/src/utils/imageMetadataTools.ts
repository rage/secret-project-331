import { spawnSync } from "child_process"
import { readFile, writeFile } from "fs/promises"
import { Page } from "playwright"
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

export async function imageSavedPageYCoordinate(pathToImage: string): Promise<number | null> {
  try {
    const contents = await readFile(pathToImage, "binary")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const listOfPngMetadataChunks: any[] = pngMetadata.splitChunk(contents)
    const coordString: string | undefined = listOfPngMetadataChunks.find((chunk) =>
      (chunk.data as string).startsWith("moocfi-page-y-"),
    )?.data
    if (!coordString) {
      return null
    }
    const coordinate = coordString.split("moocfi-page-y-")[1]
    if (coordinate) {
      const yCoordinate = Number(coordinate)
      if (Number.isNaN(yCoordinate)) {
        console.warn(`Warn: Invalid y-coordinate "${coordinate}" in image metadata, ignoring it.`)
        return null
      }
      return yCoordinate
    }
  } catch (_e) {
    return null
  }
  return null
}

export async function savePageYCoordinateToImage(
  pathToImage: string,
  page: Page,
  useCoordinatesFromTheBottomForSavingYCoordinates: boolean | undefined,
): Promise<void> {
  // eslint-disable-next-line playwright/no-wait-for-timeout
  await page.waitForTimeout(200)
  const yCoordinate = await observeYCoordinate(
    page,
    useCoordinatesFromTheBottomForSavingYCoordinates,
  )

  console.info(`Saving y-coordinate ${yCoordinate} to image "${pathToImage}"`)

  const contents = await readFile(pathToImage, "binary")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let listOfPngMetadataChunks: any[] = pngMetadata.splitChunk(contents)
  const iend = listOfPngMetadataChunks.pop()
  // Remove previous y-coordinate metadata
  listOfPngMetadataChunks = listOfPngMetadataChunks.filter(
    (chunk) => !(chunk.data as string).startsWith("moocfi-page-y-"),
  )
  listOfPngMetadataChunks.push(pngMetadata.createChunk("aaab", `moocfi-page-y-${yCoordinate}`))
  listOfPngMetadataChunks.push(iend)
  const newContents = pngMetadata.joinChunk(listOfPngMetadataChunks)
  await writeFile(pathToImage, newContents, "binary")
}

export async function observeYCoordinate(
  page: Page,
  useCoordinatesFromTheBottomForSavingYCoordinates: boolean | undefined,
): Promise<number> {
  let previousYCoordinate: number | null = null
  let tries = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // eslint-disable-next-line no-await-in-loop, playwright/no-wait-for-timeout
    await page.waitForTimeout(100)
    let yCoordinate = await page.mainFrame().evaluate(() => {
      return window.scrollY
    })

    if (useCoordinatesFromTheBottomForSavingYCoordinates) {
      const pageHeight = await page.evaluate(() => {
        return document.body.scrollHeight
      })
      yCoordinate = -(pageHeight - yCoordinate)
    }

    if (previousYCoordinate === yCoordinate) {
      return yCoordinate
    } else {
      previousYCoordinate = yCoordinate
    }

    if (tries > 100) {
      throw new Error(`Could not stabilize y-coordinate after ${tries} tries.`)
    }
    tries++
  }
}

export async function scrollToObservedYCoordinate(page: Page, yCoordinate: number): Promise<void> {
  const targetY =
    yCoordinate < 0
      ? (await page.evaluate(() => document.body.scrollHeight)) + yCoordinate
      : yCoordinate

  await page.mainFrame().evaluate((coord) => {
    window.scrollTo(0, coord)
  }, targetY)
}
