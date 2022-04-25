import React, { useEffect, useRef } from "react"

export interface EditableComponenExtratProp {
  onChange: any
  children: React.ReactNode
}

const ERROR = "Can't have more than one child"

export type EditableComponentProps = React.HTMLAttributes<HTMLDivElement> &
  EditableComponenExtratProp

const EditableComponent: React.FC<EditableComponentProps> = ({ onChange, children }) => {
  const el = useRef<HTMLInputElement>()
  let elements: any = React.Children.toArray(children)
  if (elements.length > 1) {
    throw Error(ERROR)
  }
  const onMouseUp = () => {
    const value = el.current /* el.current?.value || el.current?.innerText */
    onChange(value)
  }
  useEffect(() => {
    const value = el.current /* el.current?.value || el.current?.innerText */
    onChange(value)
  }, [])
  elements = React.cloneElement(elements[0], {
    contentEditable: true,
    suppressContentEditableWarning: true,
    ref: el,
    onBlur: onMouseUp,
  })

  return elements
}

export default EditableComponent
