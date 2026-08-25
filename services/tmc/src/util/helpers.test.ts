import { randomBytes } from "node:crypto"
import { zstdCompressSync } from "node:zlib"

import tar from "tar-stream"
import { describe, expect, it } from "vitest"

import { extractTarZstd } from "./helpers"

/** Random text so the archive cannot compress down to something the first destination size fits. */
const incompressibleText = (bytes: number): string =>
  randomBytes(bytes).toString("base64").slice(0, bytes)

const packTarZstd = async (filepath: string, contents: string): Promise<Buffer> => {
  const pack = tar.pack()
  // extractTarZstd strips the project directory every tmc archive is rooted at.
  pack.entry({ name: `project/${filepath}` }, contents)
  pack.finalize()
  const chunks: Uint8Array[] = []
  for await (const chunk of pack) {
    chunks.push(chunk)
  }
  return Buffer.from(zstdCompressSync(Buffer.concat(chunks)))
}

describe("extractTarZstd", () => {
  it("fails loudly on an archive it cannot decompress instead of reporting no files", async () => {
    await expect(extractTarZstd(Buffer.from("not a zstd frame"))).rejects.toThrow(
      /Failed to decompress/,
    )
  })

  it("extracts an archive whose contents exceed the first destination size tried", async () => {
    const contents = incompressibleText(2 * 1024 * 1024)
    const archive = await packTarZstd("src/big.txt", contents)

    expect(await extractTarZstd(archive)).toEqual([{ filepath: "src/big.txt", contents }])
  })
})
