use actix_web::{
    Error, HttpResponse,
    body::{EitherBody, MessageBody},
    dev::{Service, ServiceRequest, ServiceResponse, Transform},
    http::{StatusCode, header},
};
use futures_util::future::{LocalBoxFuture, Ready, ready};
use governor::{
    Quota, RateLimiter,
    clock::{Clock, DefaultClock},
    state::keyed::DefaultKeyedStateStore,
};
use std::{
    num::NonZeroU32,
    sync::{
        Arc,
        atomic::{AtomicU64, Ordering},
    },
    task::{Context, Poll},
    time::Duration,
};

#[derive(Clone, Debug, Default)]
pub struct RateLimitConfig {
    pub per_minute: Option<u64>,
    pub per_hour: Option<u64>,
    pub per_day: Option<u64>,
    pub per_month: Option<u64>,
}

type Key = String;
type Limiter = RateLimiter<Key, DefaultKeyedStateStore<Key>, DefaultClock>;

#[derive(Clone)]
struct EndpointLimiters {
    month: Option<Arc<Limiter>>,
    day: Option<Arc<Limiter>>,
    hour: Option<Arc<Limiter>>,
    minute: Option<Arc<Limiter>>,
}

impl EndpointLimiters {
    fn from_config(cfg: &RateLimitConfig) -> Self {
        Self {
            month: cfg.per_month.and_then(|n| {
                build_custom_period_limiter(n, Duration::from_secs(30 * 24 * 60 * 60))
            }),
            day: cfg
                .per_day
                .and_then(|n| build_custom_period_limiter(n, Duration::from_secs(24 * 60 * 60))),
            hour: cfg.per_hour.and_then(|n| build_limiter(n, Quota::per_hour)),
            minute: cfg
                .per_minute
                .and_then(|n| build_limiter(n, Quota::per_minute)),
        }
    }

    fn iter(&self) -> impl Iterator<Item = &Arc<Limiter>> {
        self.month
            .iter()
            .chain(self.day.iter())
            .chain(self.hour.iter())
            .chain(self.minute.iter())
    }

    fn is_empty(&self) -> bool {
        self.minute.is_none() && self.hour.is_none() && self.day.is_none() && self.month.is_none()
    }
}

fn build_limiter<F>(n: u64, quota_fn: F) -> Option<Arc<Limiter>>
where
    F: FnOnce(NonZeroU32) -> Quota,
{
    let n32 = NonZeroU32::new(u32::try_from(n).ok()?)?;
    Some(Arc::new(RateLimiter::keyed(quota_fn(n32))))
}

fn build_custom_period_limiter(n: u64, period: Duration) -> Option<Arc<Limiter>> {
    let n32 = NonZeroU32::new(u32::try_from(n).ok()?)?;
    let quota = Quota::with_period(period)?.allow_burst(n32);
    Some(Arc::new(RateLimiter::keyed(quota)))
}

#[derive(Clone)]
pub struct RateLimit {
    limiters: Arc<EndpointLimiters>,
    calls: Arc<AtomicU64>,
}

impl RateLimit {
    pub fn new(cfg: RateLimitConfig) -> Self {
        Self {
            limiters: Arc::new(EndpointLimiters::from_config(&cfg)),
            calls: Arc::new(AtomicU64::new(0)),
        }
    }
}

impl<S, B> Transform<S, ServiceRequest> for RateLimit
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    B: MessageBody + 'static,
{
    type Response = ServiceResponse<EitherBody<B>>;
    type Error = Error;
    type InitError = ();
    type Transform = RateLimitInner<S>;
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(RateLimitInner {
            service,
            limiters: self.limiters.clone(),
            calls: self.calls.clone(),
        }))
    }
}

pub struct RateLimitInner<S> {
    service: S,
    limiters: Arc<EndpointLimiters>,
    calls: Arc<AtomicU64>,
}

impl<S, B> Service<ServiceRequest> for RateLimitInner<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    B: MessageBody + 'static,
{
    type Response = ServiceResponse<EitherBody<B>>;
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

    fn poll_ready(&self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        self.service.poll_ready(cx)
    }

    fn call(&self, req: ServiceRequest) -> Self::Future {
        if self.limiters.is_empty() {
            let fut = self.service.call(req);
            return Box::pin(async move { fut.await.map(|r| r.map_into_left_body()) });
        }

        const RETAIN_EVERY: u64 = 1024;
        const SHRINK_EVERY: u64 = 65_536;

        let n = self.calls.fetch_add(1, Ordering::Relaxed) + 1;
        if n.is_multiple_of(RETAIN_EVERY) {
            for limiter in self.limiters.iter() {
                limiter.retain_recent();
            }
            if n.is_multiple_of(SHRINK_EVERY) {
                for limiter in self.limiters.iter() {
                    limiter.shrink_to_fit();
                }
            }
        }

        let clock = DefaultClock::default();
        let key = extract_client_ip_key(&req);

        let mut retry_after: Option<Duration> = None;
        for limiter in self.limiters.iter() {
            if let Err(negative) = limiter.check_key(&key) {
                let wait = negative.wait_time_from(clock.now());
                retry_after = Some(retry_after.map_or(wait, |cur| cur.max(wait)));
            }
        }

        if let Some(wait) = retry_after {
            let secs = wait.as_secs().max(1);
            let resp = HttpResponse::build(StatusCode::TOO_MANY_REQUESTS)
                .insert_header((header::RETRY_AFTER, secs.to_string()))
                .content_type("application/json")
                .body(format!(
                    r#"{{"error":"too_many_requests","retry_after_seconds":{secs}}}"#
                ));
            return Box::pin(async move { Ok(req.into_response(resp).map_into_right_body()) });
        }

        let fut = self.service.call(req);
        Box::pin(async move { fut.await.map(|r| r.map_into_left_body()) })
    }
}

fn extract_client_ip_key(req: &ServiceRequest) -> String {
    if let Some(s) = req.connection_info().realip_remote_addr() {
        let s = s.trim();
        if !s.is_empty() {
            return s.to_string();
        }
    }

    if let Some(sa) = req.peer_addr() {
        return sa.ip().to_string();
    }

    format!("unknown:{}|{}", req.connection_info().host(), req.path())
}

#[cfg(test)]
mod tests {
    use super::*;
    use actix_http::Request;
    use actix_web::{
        App, HttpResponse,
        body::{BoxBody, EitherBody},
        dev::{Service, ServiceResponse},
        http::header,
        test, web,
    };
    use std::net::{IpAddr, Ipv4Addr, SocketAddr};

    fn mw(
        per_minute: Option<u64>,
        per_hour: Option<u64>,
        per_day: Option<u64>,
        per_month: Option<u64>,
    ) -> RateLimit {
        RateLimit::new(RateLimitConfig {
            per_minute,
            per_hour,
            per_day,
            per_month,
        })
    }

    async fn call_get<S>(
        app: &S,
        uri: &str,
        xff: Option<&str>,
        peer: Option<SocketAddr>,
    ) -> ServiceResponse<EitherBody<BoxBody>>
    where
        S: Service<Request, Response = ServiceResponse<EitherBody<BoxBody>>, Error = Error>,
    {
        let mut tr = test::TestRequest::get().uri(uri);
        if let Some(v) = xff {
            tr = tr.insert_header(("x-forwarded-for", v));
        }
        if let Some(p) = peer {
            tr = tr.peer_addr(p);
        }
        test::call_service(app, tr.to_request()).await
    }

    fn retry_after_secs(resp: &ServiceResponse<EitherBody<BoxBody>>) -> Option<u64> {
        resp.headers()
            .get(header::RETRY_AFTER)
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.parse::<u64>().ok())
    }

    async fn app(
        mw: RateLimit,
    ) -> impl Service<Request, Response = ServiceResponse<EitherBody<BoxBody>>, Error = Error> {
        test::init_service(
            App::new()
                .wrap(mw)
                .route("/", web::get().to(|| async { HttpResponse::Ok().finish() }))
                .route(
                    "/other",
                    web::get().to(|| async { HttpResponse::Ok().finish() }),
                ),
        )
        .await
    }

    #[actix_web::test]
    async fn key_trims_realip_value() {
        let req = test::TestRequest::get()
            .uri("/x")
            .insert_header(("x-forwarded-for", " 9.9.9.9 "))
            .to_srv_request();

        assert_eq!(super::extract_client_ip_key(&req), "9.9.9.9");
    }

    #[actix_web::test]
    async fn key_empty_realip_falls_back_to_peer_ip() {
        let peer = SocketAddr::new(IpAddr::V4(Ipv4Addr::new(1, 2, 3, 4)), 5555);
        let req = test::TestRequest::get()
            .uri("/x")
            .insert_header(("x-forwarded-for", "     "))
            .peer_addr(peer)
            .to_srv_request();

        assert_eq!(super::extract_client_ip_key(&req), "1.2.3.4");
    }

    #[actix_web::test]
    async fn key_no_realip_uses_peer_ip() {
        let peer = SocketAddr::new(IpAddr::V4(Ipv4Addr::new(10, 0, 0, 9)), 1234);
        let req = test::TestRequest::get()
            .uri("/x")
            .peer_addr(peer)
            .to_srv_request();
        assert_eq!(super::extract_client_ip_key(&req), "10.0.0.9");
    }

    #[actix_web::test]
    async fn key_no_realip_and_no_peer_uses_unknown_host_and_path() {
        let req = test::TestRequest::get().uri("/path123").to_srv_request();
        let k = super::extract_client_ip_key(&req);
        assert!(k.starts_with("unknown:"), "key={k}");
        assert!(k.contains("|/path123"), "key={k}");
    }

    #[actix_web::test]
    async fn passthrough_when_no_limits() {
        let app = app(mw(None, None, None, None)).await;

        let r1 = call_get(&app, "/", Some("1.2.3.4"), None).await;
        let r2 = call_get(&app, "/", Some("1.2.3.4"), None).await;

        assert_eq!(r1.status(), StatusCode::OK);
        assert_eq!(r2.status(), StatusCode::OK);
        assert!(r2.headers().get(header::RETRY_AFTER).is_none());
    }

    #[actix_web::test]
    async fn per_minute_zero_disables_window() {
        let app = app(mw(Some(0), None, None, None)).await;

        let r1 = call_get(&app, "/", Some("1.2.3.4"), None).await;
        let r2 = call_get(&app, "/", Some("1.2.3.4"), None).await;

        assert_eq!(r1.status(), StatusCode::OK);
        assert_eq!(r2.status(), StatusCode::OK);
    }

    #[actix_web::test]
    async fn per_minute_over_u32_disables_window() {
        let app = app(mw(Some(u64::from(u32::MAX) + 1), None, None, None)).await;

        let r1 = call_get(&app, "/", Some("1.2.3.4"), None).await;
        let r2 = call_get(&app, "/", Some("1.2.3.4"), None).await;

        assert_eq!(r1.status(), StatusCode::OK);
        assert_eq!(r2.status(), StatusCode::OK);
    }

    #[actix_web::test]
    async fn blocks_second_request_same_key() {
        let app = app(mw(Some(1), None, None, None)).await;

        let ok = call_get(&app, "/", Some("1.2.3.4"), None).await;
        assert_eq!(ok.status(), StatusCode::OK);

        let blocked = call_get(&app, "/", Some("1.2.3.4"), None).await;
        assert_eq!(blocked.status(), StatusCode::TOO_MANY_REQUESTS);

        let ra = retry_after_secs(&blocked).expect("missing Retry-After");
        assert!(ra >= 1);
    }

    #[actix_web::test]
    async fn retry_after_is_integer_seconds_and_body_is_json() {
        let app = app(mw(Some(1), None, None, None)).await;

        let _ = call_get(&app, "/", Some("1.2.3.4"), None).await;
        let blocked = call_get(&app, "/", Some("1.2.3.4"), None).await;

        assert_eq!(blocked.status(), StatusCode::TOO_MANY_REQUESTS);

        let ra_hdr = blocked.headers().get(header::RETRY_AFTER).unwrap();
        let ra_str = ra_hdr.to_str().unwrap();
        assert!(
            ra_str.parse::<u64>().is_ok(),
            "Retry-After not int: {ra_str}"
        );

        let bytes = test::read_body(blocked).await;
        let body = std::str::from_utf8(&bytes).unwrap();
        assert!(
            body.contains(r#""error":"too_many_requests""#),
            "body={body}"
        );
        let v: serde_json::Value = serde_json::from_str(body).unwrap();
        assert_eq!(v["error"], "too_many_requests");
        assert!(v["retry_after_seconds"].as_u64().is_some());
    }

    #[actix_web::test]
    async fn different_keys_independent() {
        let app = app(mw(Some(1), None, None, None)).await;

        let a1 = call_get(&app, "/", Some("10.0.0.1"), None).await;
        let b1 = call_get(&app, "/", Some("10.0.0.2"), None).await;
        assert_eq!(a1.status(), StatusCode::OK);
        assert_eq!(b1.status(), StatusCode::OK);

        let a2 = call_get(&app, "/", Some("10.0.0.1"), None).await;
        assert_eq!(a2.status(), StatusCode::TOO_MANY_REQUESTS);
    }

    #[actix_web::test]
    async fn same_key_shared_across_routes_in_same_app() {
        let app = app(mw(Some(1), None, None, None)).await;

        let r1 = call_get(&app, "/", Some("1.2.3.4"), None).await;
        assert_eq!(r1.status(), StatusCode::OK);

        let r2 = call_get(&app, "/other", Some("1.2.3.4"), None).await;
        assert_eq!(r2.status(), StatusCode::TOO_MANY_REQUESTS);
    }

    #[actix_web::test]
    async fn max_retry_after_prefers_longer_window() {
        let app = app(mw(Some(1), Some(1), None, None)).await;

        let r1 = call_get(&app, "/", Some("1.2.3.4"), None).await;
        assert_eq!(r1.status(), StatusCode::OK);

        let r2 = call_get(&app, "/", Some("1.2.3.4"), None).await;
        assert_eq!(r2.status(), StatusCode::TOO_MANY_REQUESTS);

        let ra = retry_after_secs(&r2).expect("missing Retry-After");
        // hour window should dominate minute window; be tolerant but meaningful
        assert!(ra >= 120, "expected hour-dominated Retry-After, got {ra}");
    }

    #[actix_web::test]
    async fn peer_addr_used_when_no_forwarded_headers() {
        let app = app(mw(Some(1), None, None, None)).await;

        let peer = SocketAddr::new(IpAddr::V4(Ipv4Addr::new(7, 7, 7, 7)), 9999);
        let r1 = call_get(&app, "/", None, Some(peer)).await;
        let r2 = call_get(&app, "/", None, Some(peer)).await;

        assert_eq!(r1.status(), StatusCode::OK);
        assert_eq!(r2.status(), StatusCode::TOO_MANY_REQUESTS);
    }

    #[actix_web::test]
    async fn empty_forwarded_header_does_not_create_empty_key_bucket() {
        let app = app(mw(Some(1), None, None, None)).await;

        let peer = SocketAddr::new(IpAddr::V4(Ipv4Addr::new(8, 8, 8, 8)), 1111);
        let r1 = call_get(&app, "/", Some("   "), Some(peer)).await;
        let r2 = call_get(&app, "/", Some("   "), Some(peer)).await;

        assert_eq!(r1.status(), StatusCode::OK);
        assert_eq!(r2.status(), StatusCode::TOO_MANY_REQUESTS);
    }

    #[actix_web::test]
    async fn unknown_bucket_includes_path_to_reduce_collisions() {
        let app = app(mw(Some(1), None, None, None)).await;

        let r1 = call_get(&app, "/", None, None).await;
        let r2 = call_get(&app, "/other", None, None).await;

        assert_eq!(r1.status(), StatusCode::OK);
        assert_eq!(r2.status(), StatusCode::OK);

        let r1b = call_get(&app, "/", None, None).await;
        assert_eq!(r1b.status(), StatusCode::TOO_MANY_REQUESTS);
    }

    #[actix_web::test]
    async fn housekeeping_retain_recent_path_executes() {
        // Trigger retain_recent() at 1024 calls; keep limit huge to avoid 429.
        let app = app(mw(Some(1_000_000), None, None, None)).await;

        for i in 0..=1024 {
            let ip = format!("192.0.2.{}", (i % 250) + 1);
            let resp = call_get(&app, "/", Some(&ip), None).await;
            assert_eq!(resp.status(), StatusCode::OK, "i={i} ip={ip}");
        }
    }

    #[actix_web::test]
    async fn keys_are_exact_strings_no_normalization_means_ports_are_distinct() {
        let app = app(mw(Some(1), None, None, None)).await;

        let a = call_get(&app, "/", Some("1.2.3.4"), None).await;
        let b = call_get(&app, "/", Some("1.2.3.4:12345"), None).await;

        assert_eq!(a.status(), StatusCode::OK);
        assert_eq!(b.status(), StatusCode::OK);

        let a2 = call_get(&app, "/", Some("1.2.3.4"), None).await;
        let b2 = call_get(&app, "/", Some("1.2.3.4:12345"), None).await;

        assert_eq!(a2.status(), StatusCode::TOO_MANY_REQUESTS);
        assert_eq!(b2.status(), StatusCode::TOO_MANY_REQUESTS);
    }
}
