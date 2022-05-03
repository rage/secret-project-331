use models::material_references::MaterialReference;

use crate::controllers::prelude::*;

#[generated_doc]
#[instrument(skip(pool))]
async fn get_material_reference_by_id(
    reference_id: web::Json<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<MaterialReference>> {
    let mut conn = pool.acquire().await?;

    let res = models::material_references::get_reference_by_id(&mut conn, reference_id.0).await?;
    Ok(web::Json(res))
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{id}", web::get().to(get_material_reference_by_id));
}
