use crate::{course_module_completions, prelude::*};

#[derive(Clone, PartialEq, Deserialize, Serialize)]
pub struct CourseModuleCompletionRegisteredToStudyRegistry {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub course_id: Uuid,
    pub course_module_completion_id: Uuid,
    pub course_module_id: Uuid,
    pub study_registry_registrar_id: Uuid,
    pub user_id: Uuid,
    pub real_student_number: String,
}

#[derive(Clone, PartialEq, Deserialize, Serialize)]
pub struct NewCourseModuleCompletionRegisteredToStudyRegistry {
    pub course_id: Uuid,
    pub course_module_completion_id: Uuid,
    pub course_module_id: Uuid,
    pub study_registry_registrar_id: Uuid,
    pub user_id: Uuid,
    pub real_student_number: String,
}

pub async fn insert(
    conn: &mut PgConnection,
    pkey_policy: PKeyPolicy<Uuid>,
    new_completion_registration: &NewCourseModuleCompletionRegisteredToStudyRegistry,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO course_module_completion_registered_to_study_registries (
    id,
    course_id,
    course_module_completion_id,
    course_module_id,
    study_registry_registrar_id,
    user_id,
    real_student_number
  )
VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7
  )
RETURNING id
        ",
        pkey_policy.into_uuid(),
        new_completion_registration.course_id,
        new_completion_registration.course_module_completion_id,
        new_completion_registration.course_module_id,
        new_completion_registration.study_registry_registrar_id,
        new_completion_registration.user_id,
        new_completion_registration.real_student_number,
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

pub async fn insert_bulk(
    conn: &mut PgConnection,
    new_completion_registrations: Vec<NewCourseModuleCompletionRegisteredToStudyRegistry>,
) -> ModelResult<Vec<Uuid>> {
    if new_completion_registrations.is_empty() {
        return Ok(vec![]);
    }

    // Create separate vectors for each column
    let ids: Vec<Uuid> = (0..new_completion_registrations.len())
        .map(|_| Uuid::new_v4())
        .collect();
    let course_ids: Vec<Uuid> = new_completion_registrations
        .iter()
        .map(|r| r.course_id)
        .collect();
    let completion_ids: Vec<Uuid> = new_completion_registrations
        .iter()
        .map(|r| r.course_module_completion_id)
        .collect();
    let module_ids: Vec<Uuid> = new_completion_registrations
        .iter()
        .map(|r| r.course_module_id)
        .collect();
    let registrar_ids: Vec<Uuid> = new_completion_registrations
        .iter()
        .map(|r| r.study_registry_registrar_id)
        .collect();
    let user_ids: Vec<Uuid> = new_completion_registrations
        .iter()
        .map(|r| r.user_id)
        .collect();
    let student_numbers: Vec<String> = new_completion_registrations
        .iter()
        .map(|r| r.real_student_number.clone())
        .collect();

    let res = sqlx::query!(
        r#"
INSERT INTO course_module_completion_registered_to_study_registries (
    id,
    course_id,
    course_module_completion_id,
    course_module_id,
    study_registry_registrar_id,
    user_id,
    real_student_number
)
SELECT * FROM UNNEST(
    $1::uuid[],
    $2::uuid[],
    $3::uuid[],
    $4::uuid[],
    $5::uuid[],
    $6::uuid[],
    $7::text[]
)
RETURNING id
        "#,
        &ids[..],
        &course_ids[..],
        &completion_ids[..],
        &module_ids[..],
        &registrar_ids[..],
        &user_ids[..],
        &student_numbers[..],
    )
    .fetch_all(conn)
    .await?;

    Ok(res.into_iter().map(|r| r.id).collect())
}

#[derive(Clone, PartialEq, Eq, Deserialize, Serialize, Debug)]
/// An object representing that a completion has been registered to a study registry.
pub struct RegisteredCompletion {
    /// Id of the completion that was registered to the study registry.
    pub completion_id: Uuid,
    /// The student number the completion was registed to.
    pub student_number: String,
    /// The registration date that is visible in the study registry for the user.
    pub registration_date: DateTime<Utc>,
}

pub async fn mark_completions_as_registered_to_study_registry(
    conn: &mut PgConnection,
    completions: Vec<RegisteredCompletion>,
    study_registry_registrar_id: Uuid,
) -> ModelResult<()> {
    if completions.is_empty() {
        return Ok(());
    }

    let ids: Vec<Uuid> = completions.iter().map(|x| x.completion_id).collect();
    let completions_by_id = course_module_completions::get_by_ids_as_map(conn, &ids).await?;

    // Validate all completions exist before proceeding
    for completion in &completions {
        if !completions_by_id.contains_key(&completion.completion_id) {
            return Err(ModelError::new(
                ModelErrorType::PreconditionFailed,
                format!(
                    "Cannot find completion with id: {}. This completion does not exist in the database.",
                    completion.completion_id
                ),
                None,
            ));
        }
    }

    let new_registrations: Vec<NewCourseModuleCompletionRegisteredToStudyRegistry> = completions
        .into_iter()
        .map(|completion| {
            let module_completion = completions_by_id.get(&completion.completion_id).unwrap();
            NewCourseModuleCompletionRegisteredToStudyRegistry {
                course_id: module_completion.course_id,
                course_module_completion_id: completion.completion_id,
                course_module_id: module_completion.course_module_id,
                study_registry_registrar_id,
                user_id: module_completion.user_id,
                real_student_number: completion.student_number,
            }
        })
        .collect();

    insert_bulk(conn, new_registrations).await?;

    // We soft-delete all duplicate registrations straight away, this way we can still see if the study registry keeps pushing the same completion multiple times
    delete_duplicate_registrations(conn).await?;

    Ok(())
}

pub async fn get_by_id(
    conn: &mut PgConnection,
    id: Uuid,
) -> ModelResult<CourseModuleCompletionRegisteredToStudyRegistry> {
    let res = sqlx::query_as!(
        CourseModuleCompletionRegisteredToStudyRegistry,
        "
SELECT *
FROM course_module_completion_registered_to_study_registries
WHERE id = $1
  AND deleted_at IS NULL
        ",
        id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn delete(conn: &mut PgConnection, id: Uuid) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE course_module_completion_registered_to_study_registries
SET deleted_at = now()
WHERE id = $1
        ",
        id
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Get the number of students that have completed the course
pub async fn get_count_of_distinct_users_with_registrations_by_course_id(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<i64> {
    let res = sqlx::query!(
        "
SELECT COUNT(DISTINCT user_id) as count
FROM course_module_completion_registered_to_study_registries
WHERE course_id = $1
  AND deleted_at IS NULL
",
        course_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res.count.unwrap_or(0))
}

pub async fn get_by_completion_id_and_registrar_id(
    conn: &mut PgConnection,
    completion_id: Uuid,
    study_registry_registrar_id: Uuid,
) -> ModelResult<Vec<CourseModuleCompletionRegisteredToStudyRegistry>> {
    let registrations = sqlx::query_as!(
        CourseModuleCompletionRegisteredToStudyRegistry,
        r#"
        SELECT *
        FROM course_module_completion_registered_to_study_registries
        WHERE course_module_completion_id = $1 AND study_registry_registrar_id = $2
        AND deleted_at IS NULL
        "#,
        completion_id,
        study_registry_registrar_id
    )
    .fetch_all(conn)
    .await?;

    Ok(registrations)
}

/// Deletes duplicate completion registrations, keeping only the oldest registration for each completion.
/// Returns the number of deleted duplicate registrations.
pub async fn delete_duplicate_registrations(conn: &mut PgConnection) -> ModelResult<i64> {
    let res = sqlx::query!(
        r#"
WITH duplicate_rows AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY course_module_completion_id
      ORDER BY created_at ASC -- Keep the oldest, delete the rest
    ) AS rn
  FROM course_module_completion_registered_to_study_registries
  WHERE deleted_at IS NULL
)
UPDATE course_module_completion_registered_to_study_registries
SET deleted_at = NOW()
WHERE id IN (
    SELECT id
    FROM duplicate_rows
    WHERE rn > 1
  )
RETURNING id
        "#
    )
    .fetch_all(conn)
    .await?;

    Ok(res.len() as i64)
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::{course_module_completions::CourseModuleCompletionGranter, test_helper::*};

    #[tokio::test]
    async fn bulk_insert_works() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);

        let registrar_id = crate::study_registry_registrars::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            "Test Registrar",
            "test_123131231231231231231231231231238971283718927389172893718923712893129837189273891278317892378193971289",
        )
        .await
        .unwrap();

        let new_completion_id = crate::course_module_completions::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            &crate::course_module_completions::NewCourseModuleCompletion {
                course_id: course,
                course_module_id: course_module.id,
                user_id: user,
                course_instance_id: instance.id,
                completion_date: Utc::now(),
                completion_registration_attempt_date: None,
                completion_language: "en-US".to_string(),
                eligible_for_ects: true,
                email: "test@example.com".to_string(),
                grade: Some(10),
                passed: true,
            },
            CourseModuleCompletionGranter::User(user),
        )
        .await
        .unwrap();

        let registrations = vec![
            NewCourseModuleCompletionRegisteredToStudyRegistry {
                course_id: course,
                course_module_completion_id: new_completion_id.id,
                course_module_id: course_module.id,
                study_registry_registrar_id: registrar_id,
                user_id: user,
                real_student_number: "12345".to_string(),
            },
            NewCourseModuleCompletionRegisteredToStudyRegistry {
                course_id: course,
                course_module_completion_id: new_completion_id.id,
                course_module_id: course_module.id,
                study_registry_registrar_id: registrar_id,
                user_id: user,
                real_student_number: "67890".to_string(),
            },
        ];

        let inserted_ids = insert_bulk(tx.as_mut(), registrations).await.unwrap();
        assert_eq!(inserted_ids.len(), 2);

        // Verify both records were inserted correctly
        for id in inserted_ids {
            let registration = get_by_id(tx.as_mut(), id).await.unwrap();
            assert_eq!(registration.course_id, course);
            assert_eq!(
                registration.course_module_completion_id,
                new_completion_id.id
            );
            assert_eq!(registration.course_module_id, course_module.id);
            assert_eq!(registration.study_registry_registrar_id, registrar_id);
            assert_eq!(registration.user_id, user);
        }
    }

    #[tokio::test]
    async fn bulk_insert_empty_vec_works() {
        insert_data!(:tx);

        let empty_vec = vec![];
        let result = insert_bulk(tx.as_mut(), empty_vec).await.unwrap();
        assert!(result.is_empty());
    }

    #[tokio::test]
    async fn insert_completions_works() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);

        let registrar_id = crate::study_registry_registrars::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            "Test Registrar",
            "test_123131231231231231231231231231238971283718927389172893718923712893129837189273891278317892378193971289",
        )
        .await
        .unwrap();

        let completion = crate::course_module_completions::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            &crate::course_module_completions::NewCourseModuleCompletion {
                course_id: course,
                course_module_id: course_module.id,
                user_id: user,
                course_instance_id: instance.id,
                completion_date: Utc::now(),
                completion_registration_attempt_date: None,
                completion_language: "en-US".to_string(),
                eligible_for_ects: true,
                email: "test@example.com".to_string(),
                grade: Some(5),
                passed: true,
            },
            CourseModuleCompletionGranter::User(user),
        )
        .await
        .unwrap();

        let registered_completions = vec![RegisteredCompletion {
            completion_id: completion.id,
            student_number: "12345".to_string(),
            registration_date: Utc::now(),
        }];

        mark_completions_as_registered_to_study_registry(
            tx.as_mut(),
            registered_completions,
            registrar_id,
        )
        .await
        .unwrap();

        let registrations =
            get_by_completion_id_and_registrar_id(tx.as_mut(), completion.id, registrar_id)
                .await
                .unwrap();

        assert_eq!(registrations.len(), 1);
        assert_eq!(registrations[0].course_id, course);
        assert_eq!(registrations[0].course_module_id, course_module.id);
        assert_eq!(registrations[0].user_id, user);
        assert_eq!(registrations[0].real_student_number, "12345");
    }

    #[tokio::test]
    async fn insert_completions_with_invalid_completion_id_fails() {
        insert_data!(:tx);

        let registrar_id = crate::study_registry_registrars::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            "Test Registrar",
            "test_123131231231231231231231231231238971283718927389172893718923712893129837189273891278317892378193971289",
        )
        .await
        .unwrap();

        let invalid_uuid = Uuid::new_v4(); // This UUID doesn't correspond to any completion
        let registered_completions = vec![RegisteredCompletion {
            completion_id: invalid_uuid,
            student_number: "12345".to_string(),
            registration_date: Utc::now(),
        }];

        // Attempt to insert the completions should fail
        let result = mark_completions_as_registered_to_study_registry(
            tx.as_mut(),
            registered_completions,
            registrar_id,
        )
        .await;

        assert!(result.is_err());
        let error = result.unwrap_err();
        assert_eq!(*error.error_type(), ModelErrorType::PreconditionFailed);
        assert!(error.message().contains("Cannot find completion with id"));
        assert!(error.message().contains(&invalid_uuid.to_string()));
    }

    #[tokio::test]
    async fn delete_duplicate_registrations_works() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);

        let registrar_id = crate::study_registry_registrars::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            "Test Registrar",
            "test_123131231231231231231231231231238971283718927389172893718923712893129837189273891278317892378193971289",
        )
        .await
        .unwrap();

        let completion = crate::course_module_completions::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            &crate::course_module_completions::NewCourseModuleCompletion {
                course_id: course,
                course_module_id: course_module.id,
                user_id: user,
                course_instance_id: instance.id,
                completion_date: Utc::now(),
                completion_registration_attempt_date: None,
                completion_language: "en-US".to_string(),
                eligible_for_ects: true,
                email: "test@example.com".to_string(),
                grade: Some(5),
                passed: true,
            },
            CourseModuleCompletionGranter::User(user),
        )
        .await
        .unwrap();

        // Create first registration
        let first_registration = NewCourseModuleCompletionRegisteredToStudyRegistry {
            course_id: course,
            course_module_completion_id: completion.id,
            course_module_id: course_module.id,
            study_registry_registrar_id: registrar_id,
            user_id: user,
            real_student_number: "12345".to_string(),
        };
        let first_id = insert(tx.as_mut(), PKeyPolicy::Generate, &first_registration)
            .await
            .unwrap();

        // Create additional registrations in a separate bulk insert so that we get a different created_at timestamp
        let later_registrations = vec![
            NewCourseModuleCompletionRegisteredToStudyRegistry {
                course_id: course,
                course_module_completion_id: completion.id,
                course_module_id: course_module.id,
                study_registry_registrar_id: registrar_id,
                user_id: user,
                real_student_number: "67890".to_string(),
            },
            NewCourseModuleCompletionRegisteredToStudyRegistry {
                course_id: course,
                course_module_completion_id: completion.id,
                course_module_id: course_module.id,
                study_registry_registrar_id: registrar_id,
                user_id: user,
                real_student_number: "54321".to_string(),
            },
        ];
        insert_bulk(tx.as_mut(), later_registrations).await.unwrap();

        let before_registrations =
            get_by_completion_id_and_registrar_id(tx.as_mut(), completion.id, registrar_id)
                .await
                .unwrap();
        assert_eq!(before_registrations.len(), 3);

        let deleted_count = delete_duplicate_registrations(tx.as_mut()).await.unwrap();
        assert_eq!(deleted_count, 2); // Should delete 2 out of 3 registrations

        let after_registrations =
            get_by_completion_id_and_registrar_id(tx.as_mut(), completion.id, registrar_id)
                .await
                .unwrap();
        assert_eq!(after_registrations.len(), 1);

        // The remaining registration should be the first one we created
        assert_eq!(after_registrations[0].id, first_id);
        assert_eq!(after_registrations[0].real_student_number, "12345");
    }

    #[tokio::test]
    async fn delete_duplicate_registrations_with_no_duplicates() {
        insert_data!(:tx, :user, :org, :course, :instance, :course_module);

        let registrar_id = crate::study_registry_registrars::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            "Test Registrar",
            "test_123131231231231231231231231231238971283718927389172893718923712893129837189273891278317892378193971289",
        )
        .await
        .unwrap();

        let completion1 = crate::course_module_completions::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            &crate::course_module_completions::NewCourseModuleCompletion {
                course_id: course,
                course_module_id: course_module.id,
                user_id: user,
                course_instance_id: instance.id,
                completion_date: Utc::now(),
                completion_registration_attempt_date: None,
                completion_language: "en-US".to_string(),
                eligible_for_ects: true,
                email: "test1@example.com".to_string(),
                grade: Some(5),
                passed: true,
            },
            CourseModuleCompletionGranter::User(user),
        )
        .await
        .unwrap();

        let completion2 = crate::course_module_completions::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            &crate::course_module_completions::NewCourseModuleCompletion {
                course_id: course,
                course_module_id: course_module.id,
                user_id: user,
                course_instance_id: instance.id,
                completion_date: Utc::now(),
                completion_registration_attempt_date: None,
                completion_language: "en-US".to_string(),
                eligible_for_ects: true,
                email: "test2@example.com".to_string(),
                grade: Some(4),
                passed: true,
            },
            CourseModuleCompletionGranter::User(user),
        )
        .await
        .unwrap();

        // Create one registration for each completion (no duplicates)
        let registrations = vec![
            NewCourseModuleCompletionRegisteredToStudyRegistry {
                course_id: course,
                course_module_completion_id: completion1.id,
                course_module_id: course_module.id,
                study_registry_registrar_id: registrar_id,
                user_id: user,
                real_student_number: "12345".to_string(),
            },
            NewCourseModuleCompletionRegisteredToStudyRegistry {
                course_id: course,
                course_module_completion_id: completion2.id,
                course_module_id: course_module.id,
                study_registry_registrar_id: registrar_id,
                user_id: user,
                real_student_number: "67890".to_string(),
            },
        ];
        insert_bulk(tx.as_mut(), registrations).await.unwrap();

        // Verify we have 1 registration for each completion
        let before_reg1 =
            get_by_completion_id_and_registrar_id(tx.as_mut(), completion1.id, registrar_id)
                .await
                .unwrap();
        let before_reg2 =
            get_by_completion_id_and_registrar_id(tx.as_mut(), completion2.id, registrar_id)
                .await
                .unwrap();
        assert_eq!(before_reg1.len(), 1);
        assert_eq!(before_reg2.len(), 1);

        // Delete duplicate registrations
        let deleted_count = delete_duplicate_registrations(tx.as_mut()).await.unwrap();
        assert_eq!(deleted_count, 0); // Should delete 0 registrations as there are no duplicates

        // Verify both registrations still exist
        let after_reg1 =
            get_by_completion_id_and_registrar_id(tx.as_mut(), completion1.id, registrar_id)
                .await
                .unwrap();
        let after_reg2 =
            get_by_completion_id_and_registrar_id(tx.as_mut(), completion2.id, registrar_id)
                .await
                .unwrap();
        assert_eq!(after_reg1.len(), 1);
        assert_eq!(after_reg2.len(), 1);
    }
}
