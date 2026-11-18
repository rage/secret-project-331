import styled from "@emotion/styled"
import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"

import type { Alternative } from "@/util/stateInterfaces"
interface Props {
  item: Alternative
  index: number
  focusOnMount?: boolean
  onDelete: () => void
  onChange: (item: Alternative) => void
}

const StyledButtonEditor = styled.div`
  margin: 0 auto;
  margin-bottom: 1rem;
  width: 100%;
  border: 1px solid black;
  padding: 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
`

const Input = styled.input`
  padding: 0.5rem;
  width: 100%;
  margin: 0 auto;
  margin-right: 0.5rem;
`

const InputCheckbox = styled.input`
  margin: 0 auto;
  margin-right: 0.5rem;
  width: 1.5rem;
  height: 1.5rem;
`

const DeleteButton = styled.button`
  width: 2rem;
  height: 2rem;
`

const ButtonEditor: React.FC<React.PropsWithChildren<Props>> = ({
  item,
  index,
  focusOnMount,
  onDelete,
  onChange,
}) => {
  const { t } = useTranslation()
  const n = index + 1
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (focusOnMount) {
      inputRef.current?.focus()
    }
    // Only on mount: a newly added option takes focus once.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <StyledButtonEditor>
      <InputCheckbox
        type="checkbox"
        // oxlint-disable-next-line i18next/no-literal-string
        aria-label={`${t("mark-option-correct")} ${n}`}
        checked={item.correct || false}
        onChange={(e) => {
          onChange({ ...item, correct: e.target.checked })
        }}
      />
      <Input
        // oxlint-disable-next-line i18next/no-literal-string
        aria-label={`${t("input-placeholder-option-text")} ${n}`}
        ref={inputRef}
        placeholder={t("input-placeholder-option-text")}
        value={item.name}
        onChange={(e) => {
          onChange({ ...item, name: e.target.value })
        }}
      />
      <DeleteButton
        // oxlint-disable-next-line i18next/no-literal-string
        aria-label={`${t("delete-option")} ${n}`}
        onClick={onDelete}
      >
        {/* oxlint-disable-next-line i18next/no-literal-string */}
        <span aria-hidden="true">x</span>
      </DeleteButton>
    </StyledButtonEditor>
  )
}

export default ButtonEditor
