-- rename non-unique chatbot names before adding the unique constraint
UPDATE chatbot_configurations c
SET chatbot_name = c.chatbot_name || ' ' || y.row_num
FROM (
    SELECT *
    FROM (
        SELECT chatbot_name,
          id,
          course_id,
          created_at,
          ROW_NUMBER() OVER (
            PARTITION by chatbot_name,
            course_id
            ORDER BY created_at,
              id
          ) AS row_num
        FROM chatbot_configurations
        WHERE deleted_at IS NULL
      ) AS x
    WHERE row_num <> 1
  ) AS y
WHERE c.id = y.id;

-- chatbot_name unique constraint
ALTER TABLE chatbot_configurations
ADD CONSTRAINT unique_chatbot_names_within_course UNIQUE NULLS NOT DISTINCT (chatbot_name, course_id, deleted_at);
