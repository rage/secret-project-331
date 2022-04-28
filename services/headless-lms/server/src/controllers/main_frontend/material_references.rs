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
    authorize(&mut conn, Act::Edit, Some(user.id), Res::ExerciseService).await?;

    let res = models::material_references::get_reference_by_id(&mut conn, reference_id.0).await?;
    Ok(web::Json(res))
}

#[generated_doc]
#[instrument(skip(pool))]
async fn delete_material_reference_by_id(
    reference_id: web::Json<Uuid>,
    pool: web::Data<PgPool>,
    user: AuthUser,
) -> ControllerResult<web::Json<()>> {
    let mut conn = pool.acquire().await?;
    authorize(&mut conn, Act::Edit, Some(user.id), Res::ExerciseService).await?;

    let res = models::material_references::delete_reference(&mut conn, reference_id.0).await?;
    Ok(web::Json(res))
}

pub fn _add_routes(cfg: &mut ServiceConfig) {
    cfg.route("/{id}", web::get().to(get_material_reference_by_id))
        .route("/{id}", web::delete().to(delete_material_reference_by_id));
}
