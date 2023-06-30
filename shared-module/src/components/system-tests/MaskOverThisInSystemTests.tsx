/** Wrap your component in this to mask it in system test screenshots.
 * See screenshot.ts for more details.
 */
const MaskOverThisInSystemTests: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <span data-mask-over-this-in-system-tests="true">{children}</span>
}

export default MaskOverThisInSystemTests
