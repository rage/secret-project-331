import styled from "@emotion/styled"
import { faArrowDown, faArrowUp, faTrash } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import React from "react"

import { PrivateSpecQuiz, PrivateSpecQuizItem } from "../../../../../../types/quizTypes/privateSpec"
import useQuizzesExerciseServiceOutputState from "../../../../../hooks/useQuizzesExerciseServiceOutputState"
import Button from "../../../../../shared-module/components/Button"

interface EditorCardProps {
  title: string
  quizItemId: string
}

const EditorWrapper = styled.div`
  border: 2px solid #e3e3e3;
`

const EditorTitle = styled.div`
  font-size: 20px;
  color: #333333;
  font-weight: bold;
  display: inline;
  margin-right: 16px;
`

const EditorSection = styled.div`
  padding: 16px;
  border-bottom: 2px solid #e3e3e3;
  width: 100%;
`

const CircleButton = styled(FontAwesomeIcon)`
  border: 1px solid #e3e3e3;
  height: 12px;
  width: 12px;
  padding: 4px;
  display: inline;
  border-radius: 50%;
  cursor: pointer;
  margin-left: 2px;

  :hover {
    border: 1px solid #ababab;
    background-color: #c9c9c9;
  }
`

const EditorContent = styled.div`
  padding: 16px;
`

const DeleteButtonContainer = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
`

const DeleteButton = styled(Button)`
  margin-bottom: 8px;
  margin-right: 8px;
`

const EditorCard: React.FC<React.PropsWithChildren<EditorCardProps>> = ({
  children,
  title,
  quizItemId,
}) => {
  const { selected, updateState } = useQuizzesExerciseServiceOutputState<PrivateSpecQuiz>(
    (quiz) => {
      // eslint-disable-next-line i18next/no-literal-string
      return quiz as PrivateSpecQuiz
    },
  )
  if (!selected) {
    return <></>
  }

  return (
    <EditorWrapper>
      <EditorSection>
        <EditorTitle>{title}</EditorTitle>
        <CircleButton
          onClick={() => {
            updateState((draft) => {
              if (!draft) {
                return
              }

              const currentItem = draft.items.find((item) => item.id === quizItemId)
              if (!currentItem) {
                return
              }
              removeDuplicateOrderNumbers(draft.items)
              console.info(`Moving ${currentItem.id} (order ${currentItem.order}) up`)
              const orders = draft.items.map((item) => item.order).sort()
              const minOrder = Math.min(...orders)

              if (currentItem.order !== minOrder) {
                /* NOP */
                let i = 0
                const currentOrder = currentItem.order
                let nextOrder = 0
                while (i < orders.length) {
                  if (orders[i] < currentItem.order) {
                    nextOrder = orders[i]
                    break
                  }
                  i++
                }
                draft.items = draft.items.map((item) => {
                  if (item.order == currentOrder) {
                    return {
                      ...item,
                      order: nextOrder,
                    }
                  } else if (item.order === nextOrder) {
                    return {
                      ...item,
                      order: currentOrder,
                    }
                  }
                  return item
                })
                draft.items = draft.items.sort((a, b) => a.order - b.order)
                console.info("New orders")
                for (const item of draft.items) {
                  console.info(item.id, item.order)
                }
              }
            })
          }}
          icon={faArrowUp}
        />
        <CircleButton
          onClick={() => {
            updateState((draft) => {
              if (!draft) {
                return
              }
              const currentItem = draft.items.find((item) => item.id === quizItemId)
              if (!currentItem) {
                return
              }
              removeDuplicateOrderNumbers(draft.items)
              console.info(`Moving ${currentItem.id} (order ${currentItem.order}) down`)
              const orders = draft.items.map((item) => item.order).sort()
              const maxOrder = Math.max(...orders)

              if (currentItem.order !== maxOrder) {
                let i = 0
                const currentOrder = currentItem.order
                let nextOrder = 0
                while (i < orders.length) {
                  if (orders[i] > currentItem.order) {
                    nextOrder = orders[i]
                    break
                  }
                  i++
                }
                draft.items = draft.items.map((item) => {
                  if (item.order == currentOrder) {
                    return {
                      ...item,
                      order: nextOrder,
                    }
                  } else if (item.order === nextOrder) {
                    return {
                      ...item,
                      order: currentOrder,
                    }
                  }
                  return item
                })
                draft.items = draft.items.sort((a, b) => a.order - b.order)
                console.info("New orders")
                for (const item of draft.items) {
                  console.info(item.id, item.order)
                }
              }
            })
          }}
          icon={faArrowDown}
        />
      </EditorSection>
      <EditorContent>{children}</EditorContent>
      <DeleteButtonContainer>
        <DeleteButton
          onClick={() => {
            updateState((draft) => {
              if (!draft) {
                return
              }
              draft.items = draft.items.filter((item) => item.id !== quizItemId)
            })
          }}
          size="medium"
          variant="outlined"
        >
          <FontAwesomeIcon icon={faTrash} />
        </DeleteButton>
      </DeleteButtonContainer>
    </EditorWrapper>
  )
}
/** Modifies the order numbers in the given items so that there will be no duplicate order numbers */
function removeDuplicateOrderNumbers(items: PrivateSpecQuizItem[]) {
  const sorted = items.sort((a, b) => a.order - b.order)
  for (let i = 0; i < sorted.length; i++) {
    sorted[i].order = i
  }
}

export default EditorCard
