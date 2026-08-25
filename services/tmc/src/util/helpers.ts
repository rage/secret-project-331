import tar from "tar-stream"
import { ZSTDDecoder } from "zstddec"

import type { RepositoryExercise } from "@/util/exerciseServiceApi"

import type { ExerciseFile } from "./stateInterfaces"

export const buildArchiveName = (exercise: RepositoryExercise, identifier?: string): string => {
  if (identifier) {
    return exercise.part + "/" + exercise.name + "-" + identifier + ".tar.zst"
  }
  return exercise.part + "/" + exercise.name + ".tar.zst"
}

/**
 * Destination sizes tried when decompressing, in bytes. zstddec cannot grow its destination and
 * returns nothing instead of failing when the archive does not fit, so a too-small first guess has
 * to be retried rather than mistaken for an empty archive.
 */
const DECOMPRESSED_SIZE_ATTEMPTS = [1024 * 1024, 32 * 1024 * 1024]

/** A tar always carries its trailing zero blocks, so nothing decompressed means the decode failed. */
const decompress = (decoder: ZSTDDecoder, tarZstdArchive: Buffer): Uint8Array => {
  for (const destinationSize of DECOMPRESSED_SIZE_ATTEMPTS) {
    const decompressed = decoder.decode(tarZstdArchive, destinationSize)
    if (decompressed.length > 0) {
      return decompressed
    }
  }
  throw new Error(
    `Failed to decompress a ${tarZstdArchive.length.toString()} byte archive: it is corrupt or larger than the supported maximum`,
  )
}

export const extractTarZstd = async (tarZstdArchive: Buffer): Promise<ExerciseFile[]> => {
  const zstdDecoder = new ZSTDDecoder()
  await zstdDecoder.init()
  const tarArchive = decompress(zstdDecoder, tarZstdArchive)

  const files: ExerciseFile[] = []
  const extract = tar.extract({})
  extract.on("entry", function (header, stream, next) {
    // strip first component...
    const filepath = header.name.slice(header.name.indexOf("/") + 1)
    const chunks: Uint8Array[] = []
    stream.on("data", (chunk) => {
      chunks.push(new Uint8Array(chunk))
    })
    stream.on("end", () => {
      if (header.type === "file") {
        const buf = Buffer.concat(chunks)
        files.push({ filepath, contents: buf.toString() })
      }
      next()
    })
    stream.resume()
  })
  const waitForExtract = new Promise((resolve, reject) => {
    extract.on("finish", resolve)
    extract.on("close", resolve)
    extract.on("error", reject)
  })
  extract.end(tarArchive)
  await waitForExtract
  return files
}
