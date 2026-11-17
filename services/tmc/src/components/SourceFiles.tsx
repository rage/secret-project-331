import { css } from "@emotion/css"

import { baseTheme, monospaceFont } from "@/shared-module/common/styles"
import type { ExerciseFile } from "@/util/stateInterfaces"

interface Props {
  files: ExerciseFile[]
  /** The files to show; every file when empty. */
  studentFilePaths: string[]
}

/** Read-only source files. Whitespace is kept as written: indentation is syntax in Python. */
const SourceFiles: React.FC<Props> = ({ files, studentFilePaths }) => {
  const studentPaths = new Set(studentFilePaths)
  const shown = studentPaths.size > 0 ? files.filter((f) => studentPaths.has(f.filepath)) : files
  return (
    <>
      {shown.map((f) => (
        <figure
          key={f.filepath}
          className={css`
            margin: 0 0 1rem;
          `}
        >
          <figcaption
            className={css`
              font-family: ${monospaceFont};
              font-weight: 600;
              margin-bottom: 0.25rem;
            `}
          >
            {f.filepath}
          </figcaption>
          <pre
            className={css`
              margin: 0;
              padding: 0.75rem;
              overflow-x: auto;
              white-space: pre;
              font-family: ${monospaceFont};
              font-size: 0.875rem;
              color: ${baseTheme.colors.gray[700]};
              background: ${baseTheme.colors.clear[100]};
              border: 1px solid ${baseTheme.colors.clear[300]};
              border-radius: 4px;
            `}
          >
            <code>{f.contents}</code>
          </pre>
        </figure>
      ))}
    </>
  )
}

export default SourceFiles
