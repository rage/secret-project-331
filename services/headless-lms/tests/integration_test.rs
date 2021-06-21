mod helper;
use actix_web::test;
use headless_lms_actix::models::organizations::{self, Organization};
use helper::init_actix;

#[tokio::test]
async fn gets_organizations() {
    let (actix, pool) = init_actix().await;
    let mut conn = pool.acquire().await.unwrap();
    organizations::insert("slug", "org", &mut conn)
        .await
        .unwrap();
    let req = test::TestRequest::with_uri("/api/v0/main-frontend/organizations").to_request();
    let organizations: Vec<Organization> = test::read_response_json(&actix, req).await;
    assert_eq!(organizations.len(), 1);
}
