import { useSetAtom } from "jotai"
import { useLayoutEffect } from "react"

import { isCourseMaterialAtom } from "./breadcrumbAtoms"

/** Registers that the current layout is course material for the duration of its lifecycle. */
export function useRegisterCourseMaterial() {
  const setIsCourseMaterial = useSetAtom(isCourseMaterialAtom)

  useLayoutEffect(() => {
    setIsCourseMaterial(true)
    return () => {
      setIsCourseMaterial(false)
    }
  }, [setIsCourseMaterial])
}
