import type { ExerciseFile } from "@/util/stateInterfaces"
import { comparePaths } from "@/util/studentFiles"

const BLOCK_SIZE = 512
const NAME_FIELD_SIZE = 100
/** The fixed mtime of the Rust `tar` crate's deterministic headers (2006-07-24T01:21:28Z). */
const DETERMINISTIC_MTIME = 1153704088
const LONG_NAME_ENTRY = "././@LongLink"

const encoder = new TextEncoder()

/** Loaded once: each load instantiates the wasm module again. */
let zstdModule: Promise<import("@hpcc-js/wasm-zstd").Zstd> | null = null

/** One file to pack, at its path inside the exercise. */
export interface ArchiveEntry {
  /** Relative to the exercise root, `/`-separated. */
  path: string
  contents: Uint8Array
}

/** A numeric header field: zero-padded octal, NUL-terminated, filling `width` bytes. */
function octal(value: number, width: number): string {
  return value.toString(8).padStart(width - 1, "0") + "\0"
}

function header(name: Uint8Array, size: number, typeflag: "0" | "L", mtime: number): Uint8Array {
  const block = new Uint8Array(BLOCK_SIZE)
  const put = (offset: number, text: string) => block.set(encoder.encode(text), offset)
  block.set(name.subarray(0, NAME_FIELD_SIZE), 0)
  put(100, octal(0o644, 8))
  put(108, octal(0, 8))
  put(116, octal(0, 8))
  put(124, octal(size, 12))
  put(136, octal(mtime, 12))
  block.fill(0x20, 148, 156)
  put(156, typeflag)
  put(257, "ustar  \0")
  // GNU long-name entries leave the device numbers empty.
  if (typeflag === "0") {
    put(329, octal(0, 8))
    put(337, octal(0, 8))
  }
  const checksum = block.reduce((sum, byte) => sum + byte, 0)
  put(148, octal(checksum, 8))
  return block
}

function padToBlock(contents: Uint8Array): Uint8Array {
  const padded = new Uint8Array(Math.ceil(contents.length / BLOCK_SIZE) * BLOCK_SIZE)
  padded.set(contents)
  return padded
}

/**
 * The tar of a student's files laid out as tmc-langs' `compress-project --deterministic` lays out a
 * student-file archive: entries `<prefix>/<path>` in path order, GNU headers with fixed metadata,
 * no directory entries. Hand-written because tar-stream writes PAX long names where langs writes
 * GNU ones; the golden test compares the output byte for byte against the langs CLI.
 */
export function tarStudentFiles(prefix: string, entries: readonly ArchiveEntry[]): Uint8Array {
  const chunks: Uint8Array[] = []
  for (const { path, contents } of entries.toSorted((a, b) => comparePaths(a.path, b.path))) {
    const name = encoder.encode(`${prefix}/${path}`)
    if (name.length > NAME_FIELD_SIZE) {
      const longName = new Uint8Array(name.length + 1)
      longName.set(name)
      chunks.push(
        header(encoder.encode(LONG_NAME_ENTRY), longName.length, "L", 0),
        padToBlock(longName),
      )
    }
    chunks.push(header(name, contents.length, "0", DETERMINISTIC_MTIME), padToBlock(contents))
  }
  chunks.push(new Uint8Array(2 * BLOCK_SIZE))
  const tar = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0))
  let offset = 0
  for (const chunk of chunks) {
    tar.set(chunk, offset)
    offset += chunk.length
  }
  return tar
}

/** The mime the host records for answer archives; it names exported entries `.tar.zst` from it. */
const ARCHIVE_MIME = "application/x-zstd-compressed-tar"
/** The name answer archives are stored under, as tmc-langs uploads them from VS Code. */
const ARCHIVE_NAME = "submission.tar.zst"

/**
 * Packs the student's files into the `.tar.zst` a browser answer consists of, laid out like a
 * VS Code submission of the same files. `files` must already be only student files.
 */
export async function packAnswerArchive(
  prefix: string,
  files: readonly ExerciseFile[],
): Promise<File> {
  const tar = tarStudentFiles(
    prefix,
    files.map((file) => ({ path: file.filepath, contents: encoder.encode(file.contents) })),
  )
  zstdModule ??= import("@hpcc-js/wasm-zstd")
    .then(({ Zstd }) => Zstd.load())
    .catch((e: unknown) => {
      // A failed load is not cached, so the next save can try again.
      zstdModule = null
      throw e
    })
  const zstd = await zstdModule
  const compressed = zstd.compress(tar)
  return new File([new Uint8Array(compressed)], ARCHIVE_NAME, { type: ARCHIVE_MIME })
}
