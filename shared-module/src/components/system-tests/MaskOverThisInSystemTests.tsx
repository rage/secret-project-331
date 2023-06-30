import { css } from "@emotion/css"

export interface MaskOverThisInSystemTestsProps {
  useDisplayBlockAndHideOverflow?: boolean
  children: React.ReactNode
}

const displayBlockAndHideOverflowStyle = css`
  display: block;
  overflow: hidden;
`

/** Wrap your component in this to mask it in system test screenshots.
 * See screenshot.ts for more details.
 */
const MaskOverThisInSystemTests: React.FC<MaskOverThisInSystemTestsProps> = ({
  children,
  useDisplayBlockAndHideOverflow = false,
}) => {
  return (
    <span
      className={useDisplayBlockAndHideOverflow ? displayBlockAndHideOverflowStyle : undefined}
      data-mask-over-this-in-system-tests="true"
    >
      {children}
    </span>
  )
}

export default MaskOverThisInSystemTests
