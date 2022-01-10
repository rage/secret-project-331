type Points = {
  chapter_points: Array<ChapterScore>
  users: Array<User>
  user_chapter_points: Record<string, PointMap>
}
