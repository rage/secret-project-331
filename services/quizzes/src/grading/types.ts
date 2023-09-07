export interface QuizItemAnswerGrading {
  /** The points for this quiz item will be multiplied with the correctness coefficient.
   *
   * For example, if this quiz item is worth 2 points and the correctness coefficient 0.75, the
   * user would get `2*0.75=1.5` points for this quiz item.
   *
   * * 0 will be regarded as an incorrect answer
   * * 0 < x < 1 will be regarded as a partially correct answer
   * * 1 will be regarded as a correct answer
   *
   */
  correctnessCoefficient: number
  quizItemId: string
}
