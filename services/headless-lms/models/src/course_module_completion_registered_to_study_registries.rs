use crate::{course_module_completions, error::missing_model_error, prelude::*};

#[derive(Clone, PartialEq, Deserialize, Serialize)]
pub struct CourseModuleCompletionRegisteredToStudyRegistry {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub course_id: Uuid,
    pub course_module_completion_id: Uuid,
    pub course_module_id: Uuid,
    /// Null when this platform registered the attainment itself instead of a third-party registrar.
    pub study_registry_registrar_id: Option<Uuid>,
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
RETURNING *
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

/// Like [insert], but a pre-existing registration for the same completion is left untouched
/// instead of erroring, for seeding scripts that may rerun against already-seeded data.
pub async fn insert_or_ignore(
    conn: &mut PgConnection,
    new_completion_registration: &NewCourseModuleCompletionRegisteredToStudyRegistry,
) -> ModelResult<()> {
    sqlx::query!(
        "
INSERT INTO course_module_completion_registered_to_study_registries (
    course_id,
    course_module_completion_id,
    course_module_id,
    study_registry_registrar_id,
    user_id,
    real_student_number
  )
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT DO NOTHING
        ",
        new_completion_registration.course_id,
        new_completion_registration.course_module_completion_id,
        new_completion_registration.course_module_id,
        new_completion_registration.study_registry_registrar_id,
        new_completion_registration.user_id,
        new_completion_registration.real_student_number,
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn insert_bulk(
    conn: &mut PgConnection,
    new_completion_registrations: Vec<NewCourseModuleCompletionRegisteredToStudyRegistry>,
) -> ModelResult<Vec<Uuid>> {
    if new_completion_registrations.is_empty() {
        return Ok(vec![]);
    }

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
-- Matches cmc_registered_to_study_registries_completion_registrar_idx, so a registrar's repeated
-- POST for a completion it already registered stays idempotent instead of erroring.
ON CONFLICT (course_module_completion_id, study_registry_registrar_id) WHERE deleted_at IS NULL DO NOTHING
RETURNING *
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

    let mut new_registrations = Vec::with_capacity(completions.len());
    for completion in completions {
        let module_completion = completions_by_id
            .get(&completion.completion_id)
            .ok_or_else(missing_model_error(
                ModelErrorType::PreconditionFailed,
                format!(
                    "Cannot find completion with id: {}. This completion does not exist in the database.",
                    completion.completion_id
                ),
            ))?;
        new_registrations.push(NewCourseModuleCompletionRegisteredToStudyRegistry {
            course_id: module_completion.course_id,
            course_module_completion_id: completion.completion_id,
            course_module_id: module_completion.course_module_id,
            study_registry_registrar_id,
            user_id: module_completion.user_id,
            real_student_number: completion.student_number,
        });
    }

    insert_bulk(conn, new_registrations).await?;

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

/// The row this platform registered itself for a completion, as opposed to one filed by a
/// third-party registrar: a null `study_registry_registrar_id` is what marks a row as ours.
pub async fn get_platform_registered_row_for_completion(
    conn: &mut PgConnection,
    completion_id: Uuid,
) -> ModelResult<Option<CourseModuleCompletionRegisteredToStudyRegistry>> {
    let res = sqlx::query_as!(
        CourseModuleCompletionRegisteredToStudyRegistry,
        "
SELECT *
FROM course_module_completion_registered_to_study_registries
WHERE course_module_completion_id = $1
  AND study_registry_registrar_id IS NULL
  AND deleted_at IS NULL
        ",
        completion_id,
    )
    .fetch_optional(conn)
    .await?;
    Ok(res)
}

pub async fn delete(conn: &mut PgConnection, id: Uuid) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE course_module_completion_registered_to_study_registries
SET deleted_at = now()
WHERE id = $1
AND deleted_at IS NULL
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

/// Returns non-deleted registrations for a registrar scoped to the given completion ids.
pub async fn get_by_registrar_id_and_completion_ids(
    conn: &mut PgConnection,
    study_registry_registrar_id: Uuid,
    completion_ids: &[Uuid],
) -> ModelResult<Vec<CourseModuleCompletionRegisteredToStudyRegistry>> {
    let registrations = sqlx::query_as!(
        CourseModuleCompletionRegisteredToStudyRegistry,
        r#"
SELECT *
FROM course_module_completion_registered_to_study_registries
WHERE study_registry_registrar_id = $1
  AND course_module_completion_id = ANY($2)
  AND deleted_at IS NULL
        "#,
        study_registry_registrar_id,
        completion_ids
    )
    .fetch_all(conn)
    .await?;

    Ok(registrations)
}

/// Of the given completions, the ones some registrar has already registered.
///
/// Rows this platform registered itself carry no registrar and are not counted, so a grade
/// improvement's second submission stays allowed.
pub async fn completion_ids_registered_by_a_registrar(
    conn: &mut PgConnection,
    completion_ids: &[Uuid],
) -> ModelResult<Vec<Uuid>> {
    let ids = sqlx::query_scalar!(
        r#"
SELECT DISTINCT course_module_completion_id
FROM course_module_completion_registered_to_study_registries
WHERE course_module_completion_id = ANY($1::uuid [])
  AND study_registry_registrar_id IS NOT NULL
  AND deleted_at IS NULL
        "#,
        completion_ids,
    )
    .fetch_all(conn)
    .await?;
    Ok(ids)
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::{course_module_completions::CourseModuleCompletionGranter, test_helper::*};

    #[tokio::test]
    async fn bulk_insert_works() {
        insert_data!(:tx, :user, :org, :course, instance: _instance, :course_module);

        let registrar_id = crate::study_registry_registrars::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            "Test Registrar",
            "test_123131231231231231231231231231238971283718927389172893718923712893129837189273891278317892378193971289",
        )
        .await
        .unwrap();

        let completion_1 = crate::course_module_completions::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            &crate::course_module_completions::NewCourseModuleCompletion {
                course_id: course,
                course_module_id: course_module.id,
                user_id: user,
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
        let completion_2 = crate::course_module_completions::insert(
            tx.as_mut(),
            PKeyPolicy::Generate,
            &crate::course_module_completions::NewCourseModuleCompletion {
                course_id: course,
                course_module_id: course_module.id,
                user_id: user,
                completion_date: Utc::now(),
                completion_registration_attempt_date: None,
                completion_language: "en-US".to_string(),
                eligible_for_ects: true,
                email: "test2@example.com".to_string(),
                grade: Some(9),
                passed: true,
            },
            CourseModuleCompletionGranter::User(user),
        )
        .await
        .unwrap();

        let registrations = vec![
            NewCourseModuleCompletionRegisteredToStudyRegistry {
                course_id: course,
                course_module_completion_id: completion_1.id,
                course_module_id: course_module.id,
                study_registry_registrar_id: registrar_id,
                user_id: user,
                real_student_number: "12345".to_string(),
            },
            NewCourseModuleCompletionRegisteredToStudyRegistry {
                course_id: course,
                course_module_completion_id: completion_2.id,
                course_module_id: course_module.id,
                study_registry_registrar_id: registrar_id,
                user_id: user,
                real_student_number: "67890".to_string(),
            },
        ];

        let inserted_ids = insert_bulk(tx.as_mut(), registrations).await.unwrap();
        assert_eq!(inserted_ids.len(), 2);

        let mut registered_completion_ids = Vec::new();
        for id in inserted_ids {
            let registration = get_by_id(tx.as_mut(), id).await.unwrap();
            assert_eq!(registration.course_id, course);
            assert_eq!(registration.course_module_id, course_module.id);
            assert_eq!(registration.study_registry_registrar_id, Some(registrar_id));
            assert_eq!(registration.user_id, user);
            registered_completion_ids.push(registration.course_module_completion_id);
        }
        registered_completion_ids.sort();
        let mut expected = vec![completion_1.id, completion_2.id];
        expected.sort();
        assert_eq!(registered_completion_ids, expected);
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
        insert_data!(:tx, :user, :org, :course, instance: _instance, :course_module);

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
}
