use actix_web::{FromRequest, HttpRequest, dev::Payload, web};
use futures_util::future::LocalBoxFuture;
use serde::Deserialize;
use std::future::Future;
use std::pin::Pin;

pub trait ExtractFallback: Default + for<'de> Deserialize<'de> {}

impl<T> ExtractFallback for T where T: Default + for<'de> Deserialize<'de> {}

type AsyncPin<'a, O> = Pin<Box<dyn Future<Output = O> + 'a>>;

#[derive(Debug)]
pub struct SafeExtractor<T>(pub T);

impl<T> SafeExtractor<T>
where
    T: ExtractFallback + 'static,
{
    pub fn from_form<'a>(req: &'a HttpRequest, payload: &'a mut Payload) -> AsyncPin<'a, Self> {
        Box::pin(async move {
            match web::Form::<T>::from_request(req, payload).await {
                Ok(form) => SafeExtractor(form.into_inner()),
                Err(_) => SafeExtractor(T::default()),
            }
        })
    }
}

impl<T> FromRequest for SafeExtractor<T>
where
    T: ExtractFallback + 'static,
{
    type Error = actix_web::Error;
    type Future = LocalBoxFuture<'static, Result<Self, Self::Error>>;

    fn from_request(req: &HttpRequest, payload: &mut Payload) -> Self::Future {
        let mut payload = payload.take(); // take ownership of payload
        let req = req.clone();

        Box::pin(async move {
            match *req.method() {
                actix_web::http::Method::GET | actix_web::http::Method::DELETE => {
                    match actix_web::web::Query::<T>::from_query(req.query_string()) {
                        Ok(q) => Ok(SafeExtractor(q.into_inner())),
                        Err(_) => Ok(SafeExtractor(T::default())),
                    }
                }
                _ => match actix_web::web::Form::<T>::from_request(&req, &mut payload).await {
                    Ok(f) => Ok(SafeExtractor(f.into_inner())),
                    Err(_) => Ok(SafeExtractor(T::default())),
                },
            }
        })
    }
}

impl<T> SafeExtractor<T>
where
    T: ExtractFallback + 'static,
{
    pub fn extract<'a>(req: &'a HttpRequest, payload: &'a mut Payload) -> AsyncPin<'a, Self> {
        Box::pin(async move {
            match *req.method() {
                actix_web::http::Method::GET | actix_web::http::Method::DELETE => {
                    match web::Query::<T>::from_query(req.query_string()) {
                        Ok(query) => SafeExtractor(query.into_inner()),
                        Err(_) => SafeExtractor(T::default()),
                    }
                }
                _ => match web::Form::<T>::from_request(req, payload).await {
                    Ok(form) => SafeExtractor(form.into_inner()),
                    Err(_) => SafeExtractor(T::default()),
                },
            }
        })
    }
}
