import { Dispatch, SetStateAction, useState } from "react"
import { useMemoOne } from "use-memo-one"

function useStateWithOnChange<S>(
  initialState: S | (() => S),
  onChange: (newState: S) => void,
): [S, Dispatch<SetStateAction<S>>] {
  const [get, set] = useState(initialState)

  const enchancedSet = useMemoOne(() => {
    const res: Dispatch<SetStateAction<S>> = (newState) => {
      if (typeof newState === "function") {
        // @ts-expect-error: newState is a function
        const res = newState(prevState)
        set(res)
        onChange(res)
        return
      }

      set(newState)
      onChange(newState)
    }
    return res
  }, [set, onChange])

  return [get, enchancedSet]
}

export default useStateWithOnChange
