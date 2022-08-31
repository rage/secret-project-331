/* eslint-disable */
import handler from '../../src/pages/api/grade'
import { ExerciseTaskGradingResult } from "../../src/shared-module/bindings";
import { isExerciseTaskGradingResult } from "../../src/shared-module/bindings.guard";
import { generateMultipleChoiceRequest } from "./utils/quizGenerator";
import testClient from './utils/testClient'

const client = testClient(handler)

describe('grade', () => {
  it('returns correct format', async () => {
    const data = generateMultipleChoiceRequest(4, 2, ['option-1'], "default")
    const response = await client.post('/api/grade').send(data)
    expect(isExerciseTaskGradingResult(JSON.parse(response.text)))
  })

  // Non multiple-choice
  it('returns full points for correct answer for single choice multiple-option quiz', async () => {
    const data = generateMultipleChoiceRequest(4, 1, ['option-1'], "default", false)
    const response = await client.post('/api/grade').send(data)
    const result = JSON.parse(response.text)
    expect(isExerciseTaskGradingResult(result))
    
    const gradingResult: ExerciseTaskGradingResult = result as ExerciseTaskGradingResult
    expect(gradingResult.score_given).toBe(1)
  })


  it('returns zero points for wrong answer for single choice multiple-option quiz', async () => {
    const data = generateMultipleChoiceRequest(4, 1, ['option-3'], "default", false)
    const response = await client.post('/api/grade').send(data)
    const result = JSON.parse(response.text)
    expect(isExerciseTaskGradingResult(result))
    
    const gradingResult: ExerciseTaskGradingResult = result as ExerciseTaskGradingResult
    expect(gradingResult.score_given).toBe(0)
  })

  it('does not allow multiple choice for single choice multiple-option quiz', async () => {
    const data = generateMultipleChoiceRequest(4, 1, ['option-1', 'option-3'], "default", false)
    await client.post('/api/grade').send(data).expect(500)
  })

  // Default, no points if all options aren't correct or all correct options are selected
  it('returns full points for correct answer in default', async () => {
    const data = generateMultipleChoiceRequest(4, 2, ['option-1','option-2'], "default")
    const response = await client.post('/api/grade').send(data)
    const result = JSON.parse(response.text)
    expect(isExerciseTaskGradingResult(result))
    
    const gradingResult: ExerciseTaskGradingResult = result as ExerciseTaskGradingResult
    expect(gradingResult.score_given).toBe(1)
  })

  it('returns zero points if a wrong answer is selected', async () => {
    const data = generateMultipleChoiceRequest(4, 2, ['option-1','option-3'], "default")
    const response = await client.post('/api/grade').send(data)
    const result = JSON.parse(response.text)
    expect(isExerciseTaskGradingResult(result))
    
    const gradingResult: ExerciseTaskGradingResult = result as ExerciseTaskGradingResult
    expect(gradingResult.score_given).toBe(0)
  })

  it('returns zero points if a wrong answer and all correct options are selected', async () => {
    const data = generateMultipleChoiceRequest(4, 2, ['option-1', 'option-2', 'option-3'], "default")
    const response = await client.post('/api/grade').send(data)
    const result = JSON.parse(response.text)
    expect(isExerciseTaskGradingResult(result))
    
    const gradingResult: ExerciseTaskGradingResult = result as ExerciseTaskGradingResult
    expect(gradingResult.score_given).toBe(0)
  })

  it('returns zero points if only wrong answers are selected', async () => {
    const data = generateMultipleChoiceRequest(4, 2, ['option-4','option-3'], "default")
    const response = await client.post('/api/grade').send(data)
    const result = JSON.parse(response.text)
    expect(isExerciseTaskGradingResult(result))
    
    const gradingResult: ExerciseTaskGradingResult = result as ExerciseTaskGradingResult
    expect(gradingResult.score_given).toBe(0)
  })

  // Points off incorrect answers
  it('returns full points for all correct options in points-off-incorrect-options', async () => {
    const data = generateMultipleChoiceRequest(4, 2, ['option-1','option-2'], "points-off-incorrect-options")
    const response = await client.post('/api/grade').send(data)
    const result = JSON.parse(response.text)
    expect(isExerciseTaskGradingResult(result))
    
    const gradingResult: ExerciseTaskGradingResult = result as ExerciseTaskGradingResult
    expect(gradingResult.score_given).toBe(1)
  })

  it('removes point for incorrect option in points-off-incorrect-options', async () => {
    const data = generateMultipleChoiceRequest(4, 2, ['option-1','option-2', 'option-3'], "points-off-incorrect-options")
    const response = await client.post('/api/grade').send(data)
    const result = JSON.parse(response.text)
    expect(isExerciseTaskGradingResult(result))
    
    const gradingResult: ExerciseTaskGradingResult = result as ExerciseTaskGradingResult
    expect(gradingResult.score_given).toBe(0.5)
  })

  it('returns zero if all options are selected in points-off-incorrect-options', async () => {
    const data = generateMultipleChoiceRequest(4, 2, ['option-1', 'option-2', 'option-3', 'option-4'], "points-off-incorrect-options")
    const response = await client.post('/api/grade').send(data)
    const result = JSON.parse(response.text)
    expect(isExerciseTaskGradingResult(result))
    
    const gradingResult: ExerciseTaskGradingResult = result as ExerciseTaskGradingResult
    expect(gradingResult.score_given).toBe(0)
  })

  // Points of unselected answers
  it('returns full points for correct answer in points-off-unselected-options', async () => {
    const data = generateMultipleChoiceRequest(4, 2, ['option-1','option-2'], "points-off-unselected-options")
    const response = await client.post('/api/grade').send(data)
    const result = JSON.parse(response.text)
    expect(isExerciseTaskGradingResult(result))
    
    const gradingResult: ExerciseTaskGradingResult = result as ExerciseTaskGradingResult
    expect(gradingResult.score_given).toBe(1)
  })

  it('removes a point if one correct option is not selected in points-off-unselected-options', async () => {
    const data = generateMultipleChoiceRequest(8, 4, ['option-1', 'option-2', 'option-3'], "points-off-unselected-options")
    const response = await client.post('/api/grade').send(data)
    const result = JSON.parse(response.text)
    expect(isExerciseTaskGradingResult(result))
    
    const gradingResult: ExerciseTaskGradingResult = result as ExerciseTaskGradingResult
    expect(gradingResult.score_given).toBe(0.5)
  })

  it('removes a point if incorrect option is selected in points-off-unselected-options', async () => {
    const data = generateMultipleChoiceRequest(8, 4, ['option-1', 'option-2', 'option-3', 'option-4', 'option-5'], "points-off-unselected-options")
    const response = await client.post('/api/grade').send(data)
    const result = JSON.parse(response.text)
    expect(isExerciseTaskGradingResult(result))
    
    const gradingResult: ExerciseTaskGradingResult = result as ExerciseTaskGradingResult
    expect(gradingResult.score_given).toBe(0.75)
  })

  it('removes a point if incorrect option is selected and correct option is not seleccted in points-off-unselected-options', async () => {
    const data = generateMultipleChoiceRequest(8, 4, ['option-1', 'option-2', 'option-3', 'option-5'], "points-off-unselected-options")
    const response = await client.post('/api/grade').send(data)
    const result = JSON.parse(response.text)
    expect(isExerciseTaskGradingResult(result))
    
    const gradingResult: ExerciseTaskGradingResult = result as ExerciseTaskGradingResult
    expect(gradingResult.score_given).toBe(0.25)
  })

})