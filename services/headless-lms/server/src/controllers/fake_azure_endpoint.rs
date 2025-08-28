// create fake azure endpoint in controllers that returns azure api like data for parse chat requenst and send stream

use crate::prelude::*;

// GET /api/v0/idk/test
#[instrument(skip(pool))]
async fn fake_azure_endpoint(pool: web::Data<PgPool>) -> ControllerResult<web::Json<String>> {
    //let mut conn = pool.acquire().await?;
    println!("!!!!!!!!!!!!!!!!!!!!!!!GET to fake azure endpoint!!!!!!!!!!!!!!!!!!!!!!!!!!");
    let a = "EXxample text".to_string();
    let token = skip_authorize();
    token.authorized_ok(web::Json(a))
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/test", web::get().to(fake_azure_endpoint));
}
