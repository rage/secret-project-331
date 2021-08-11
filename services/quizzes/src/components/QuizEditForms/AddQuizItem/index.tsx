import React from "react"
import styled from "styled-components"

import AddQuizItemButton from "./AddQuizItemButton"

const AddQuizItemWrapper = styled.div`
  display: flex;
  margin-top: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  justify-content: space-around;
`

const TypeContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  width: 100%;
  margin-top: 1rem;
  margin-bottom: 1rem;
`

const types = [
  "essay",
  "scale",
  "open",
  "multiple-choice",
  "checkbox",
  "custom-frontend-accept-data",
  "multiple-choice-dropdown",
  "clickable-multiple-choice",
]

export const AddQuizItem: React.FC = () => {
  return (
    <>
      <AddQuizItemWrapper>
        <h3>Add new Quiz item</h3>
        <TypeContainer>
          {types.map((type) => (
            <AddQuizItemButton key={type} type={type} />
          ))}
        </TypeContainer>
      </AddQuizItemWrapper>
    </>
  )
}

export default AddQuizItem
