import tar from "tar-stream"
import { ZSTDDecoder } from "zstddec"

import type { ExerciseFile } from "./stateInterfaces"

import type { RepositoryExercise } from "@/util/exerciseServiceApi"

export const buildArchiveName = (exercise: RepositoryExercise, identifier?: string): string => {
  if (identifier) {
    return exercise.part + "/" + exercise.name + "-" + identifier + ".tar.zst"
  }
  return exercise.part + "/" + exercise.name + ".tar.zst"
}

export const extractTarZstd = async (tarZstdArchive: Buffer): Promise<ExerciseFile[]> => {
  // unpack zstd
  const zstdDecoder = new ZSTDDecoder()
  await zstdDecoder.init()
  const tarArchive = zstdDecoder.decode(tarZstdArchive, 1024 * 1024)

  // unpack tar
  const files: ExerciseFile[] = []
  const extract = tar.extract({})
  extract.on("entry", function (header, stream, next) {
    // strip first component...
    const filepath = header.name.substring(header.name.indexOf("/") + 1)
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
