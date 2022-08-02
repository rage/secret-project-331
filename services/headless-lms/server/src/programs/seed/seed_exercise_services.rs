use headless_lms_models::exercise_services;
use sqlx::{Pool, Postgres};

pub async fn seed_exercise_services(db_pool: &Pool<Postgres>) -> anyhow::Result<()> {
    info!("inserting exercise services");
    let mut conn = db_pool.acquire().await?;

    let _example_exercise_exercise_service = exercise_services::insert_exercise_service(
    &mut conn,
    &exercise_services::ExerciseServiceNewOrUpdate {
        name: "Example Exercise".to_string(),
        slug: "example-exercise".to_string(),
        public_url: "http://project-331.local/example-exercise/api/service-info".to_string(),
        internal_url: Some("http://example-exercise.default.svc.cluster.local:3002/example-exercise/api/service-info".to_string()),
        max_reprocessing_submissions_at_once: 5,
    }
)
.await?;

    exercise_services::insert_exercise_service(
        &mut conn,
        &exercise_services::ExerciseServiceNewOrUpdate {
            name: "Quizzes".to_string(),
            slug: "quizzes".to_string(),
            public_url: "http://project-331.local/quizzes/api/service-info".to_string(),
            internal_url: Some(
                "http://quizzes.default.svc.cluster.local:3004/quizzes/api/service-info"
                    .to_string(),
            ),
            max_reprocessing_submissions_at_once: 5,
        },
    )
    .await?;
    Ok(())
}
