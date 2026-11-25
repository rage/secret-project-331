/** Answers upload as a zip, recognised by this extension, or as the `.tar.zst` an editor packs. */
export const ZIP_ARCHIVE_EXTENSION = ".zip"
export const ACCEPTED_ARCHIVE_EXTENSIONS = [".zst", ZIP_ARCHIVE_EXTENSION] as const
