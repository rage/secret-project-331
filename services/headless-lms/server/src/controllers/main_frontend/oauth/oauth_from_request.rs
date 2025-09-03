#[macro_export]
macro_rules! impl_oauth_from_request {
    ($raw:ty => $out:ty) => {
        impl ::actix_web::FromRequest for $out
        where
            $raw: ::serde::de::DeserializeOwned
                + $crate::controllers::main_frontend::oauth::oauth_validate::OAuthValidate<Output = $out>
                + ::std::default::Default
                + 'static,
            $out: 'static,
        {
            type Error = ::actix_web::Error;
            type Future = ::futures_util::future::LocalBoxFuture<
                'static,
                ::std::result::Result<Self, Self::Error>
            >;

            fn from_request(
                req: &::actix_web::HttpRequest,
                payload: &mut ::actix_web::dev::Payload,
            ) -> Self::Future {
                let req = req.clone();
                let mut payload = payload.take();

                ::std::boxed::Box::pin(async move {
                    let raw: $raw = match *req.method() {
                        ::actix_web::http::Method::GET
                        | ::actix_web::http::Method::DELETE => {
                            match ::actix_web::web::Query::<$raw>::from_query(req.query_string()) {
                                ::std::result::Result::Ok(q) => q.into_inner(),
                                ::std::result::Result::Err(_) => <$raw as ::std::default::Default>::default(),
                            }
                        }
                        _ => match ::actix_web::web::Form::<$raw>::from_request(&req, &mut payload).await {
                            ::std::result::Result::Ok(f) => f.into_inner(),
                            ::std::result::Result::Err(_) => <$raw as ::std::default::Default>::default(),
                        },
                    };

                    let out: $out = <$raw as $crate::controllers::main_frontend::oauth::oauth_validate::OAuthValidate>::validate(&raw)?;
                    ::std::result::Result::Ok(out)
                })
            }
        }
    };
}
