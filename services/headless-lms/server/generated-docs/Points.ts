type Points = {
  chapter_points: Array<ChapterScore>
  users: Array<UserDetail>
  user_chapter_points: Record<string, PointMap>
}
