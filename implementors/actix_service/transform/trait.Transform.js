(function() {var implementors = {
"actix_extensible_rate_limit":[["impl&lt;S, B, BA, BI, BO, BE, F, O&gt; <a class=\"trait\" href=\"actix_service/transform/trait.Transform.html\" title=\"trait actix_service::transform::Transform\">Transform</a>&lt;S, <a class=\"struct\" href=\"actix_web/service/struct.ServiceRequest.html\" title=\"struct actix_web::service::ServiceRequest\">ServiceRequest</a>&gt; for <a class=\"struct\" href=\"actix_extensible_rate_limit/struct.RateLimiter.html\" title=\"struct actix_extensible_rate_limit::RateLimiter\">RateLimiter</a>&lt;BA, BO, F&gt;<span class=\"where fmt-newline\">where<br>&nbsp;&nbsp;&nbsp;&nbsp;S: <a class=\"trait\" href=\"actix_service/trait.Service.html\" title=\"trait actix_service::Service\">Service</a>&lt;<a class=\"struct\" href=\"actix_web/service/struct.ServiceRequest.html\" title=\"struct actix_web::service::ServiceRequest\">ServiceRequest</a>, Response = <a class=\"struct\" href=\"actix_web/service/struct.ServiceResponse.html\" title=\"struct actix_web::service::ServiceResponse\">ServiceResponse</a>&lt;B&gt;, Error = <a class=\"struct\" href=\"actix_web/error/error/struct.Error.html\" title=\"struct actix_web::error::error::Error\">Error</a>&gt; + 'static,<br>&nbsp;&nbsp;&nbsp;&nbsp;S::<a class=\"associatedtype\" href=\"actix_service/trait.Service.html#associatedtype.Future\" title=\"type actix_service::Service::Future\">Future</a>: 'static,<br>&nbsp;&nbsp;&nbsp;&nbsp;B: 'static,<br>&nbsp;&nbsp;&nbsp;&nbsp;BA: <a class=\"trait\" href=\"actix_extensible_rate_limit/backend/trait.Backend.html\" title=\"trait actix_extensible_rate_limit::backend::Backend\">Backend</a>&lt;BI, Output = BO, Error = BE&gt; + 'static,<br>&nbsp;&nbsp;&nbsp;&nbsp;BI: 'static,<br>&nbsp;&nbsp;&nbsp;&nbsp;BO: 'static,<br>&nbsp;&nbsp;&nbsp;&nbsp;BE: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.66.1/core/convert/trait.Into.html\" title=\"trait core::convert::Into\">Into</a>&lt;<a class=\"struct\" href=\"actix_web/error/error/struct.Error.html\" title=\"struct actix_web::error::error::Error\">Error</a>&gt; + <a class=\"trait\" href=\"https://doc.rust-lang.org/1.66.1/core/fmt/trait.Display.html\" title=\"trait core::fmt::Display\">Display</a> + 'static,<br>&nbsp;&nbsp;&nbsp;&nbsp;F: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.66.1/core/ops/function/trait.Fn.html\" title=\"trait core::ops::function::Fn\">Fn</a>(&amp;<a class=\"struct\" href=\"actix_web/service/struct.ServiceRequest.html\" title=\"struct actix_web::service::ServiceRequest\">ServiceRequest</a>) -&gt; O + 'static,<br>&nbsp;&nbsp;&nbsp;&nbsp;O: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.66.1/core/future/future/trait.Future.html\" title=\"trait core::future::future::Future\">Future</a>&lt;Output = <a class=\"enum\" href=\"https://doc.rust-lang.org/1.66.1/core/result/enum.Result.html\" title=\"enum core::result::Result\">Result</a>&lt;BI, <a class=\"struct\" href=\"actix_web/error/error/struct.Error.html\" title=\"struct actix_web::error::error::Error\">Error</a>&gt;&gt;,</span>"]],
"actix_service":[],
"actix_session":[["impl&lt;S, B, Store&gt; <a class=\"trait\" href=\"actix_service/transform/trait.Transform.html\" title=\"trait actix_service::transform::Transform\">Transform</a>&lt;S, <a class=\"struct\" href=\"actix_web/service/struct.ServiceRequest.html\" title=\"struct actix_web::service::ServiceRequest\">ServiceRequest</a>&gt; for <a class=\"struct\" href=\"actix_session/struct.SessionMiddleware.html\" title=\"struct actix_session::SessionMiddleware\">SessionMiddleware</a>&lt;Store&gt;<span class=\"where fmt-newline\">where<br>&nbsp;&nbsp;&nbsp;&nbsp;S: <a class=\"trait\" href=\"actix_service/trait.Service.html\" title=\"trait actix_service::Service\">Service</a>&lt;<a class=\"struct\" href=\"actix_web/service/struct.ServiceRequest.html\" title=\"struct actix_web::service::ServiceRequest\">ServiceRequest</a>, Response = <a class=\"struct\" href=\"actix_web/service/struct.ServiceResponse.html\" title=\"struct actix_web::service::ServiceResponse\">ServiceResponse</a>&lt;B&gt;, Error = <a class=\"struct\" href=\"actix_web/error/error/struct.Error.html\" title=\"struct actix_web::error::error::Error\">Error</a>&gt; + 'static,<br>&nbsp;&nbsp;&nbsp;&nbsp;S::<a class=\"associatedtype\" href=\"actix_service/trait.Service.html#associatedtype.Future\" title=\"type actix_service::Service::Future\">Future</a>: 'static,<br>&nbsp;&nbsp;&nbsp;&nbsp;B: <a class=\"trait\" href=\"actix_http/body/message_body/trait.MessageBody.html\" title=\"trait actix_http::body::message_body::MessageBody\">MessageBody</a> + 'static,<br>&nbsp;&nbsp;&nbsp;&nbsp;Store: <a class=\"trait\" href=\"actix_session/storage/trait.SessionStore.html\" title=\"trait actix_session::storage::SessionStore\">SessionStore</a> + 'static,</span>"]],
"actix_web":[["impl&lt;S, T, Req&gt; <a class=\"trait\" href=\"actix_web/dev/trait.Transform.html\" title=\"trait actix_web::dev::Transform\">Transform</a>&lt;S, Req&gt; for <a class=\"struct\" href=\"actix_web/middleware/struct.Compat.html\" title=\"struct actix_web::middleware::Compat\">Compat</a>&lt;T&gt;<span class=\"where fmt-newline\">where<br>&nbsp;&nbsp;&nbsp;&nbsp;S: <a class=\"trait\" href=\"actix_web/dev/trait.Service.html\" title=\"trait actix_web::dev::Service\">Service</a>&lt;Req&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;T: <a class=\"trait\" href=\"actix_web/dev/trait.Transform.html\" title=\"trait actix_web::dev::Transform\">Transform</a>&lt;S, Req&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;T::<a class=\"associatedtype\" href=\"actix_web/dev/trait.Transform.html#associatedtype.Future\" title=\"type actix_web::dev::Transform::Future\">Future</a>: 'static,<br>&nbsp;&nbsp;&nbsp;&nbsp;T::<a class=\"associatedtype\" href=\"actix_web/dev/trait.Transform.html#associatedtype.Response\" title=\"type actix_web::dev::Transform::Response\">Response</a>: MapServiceResponseBody,<br>&nbsp;&nbsp;&nbsp;&nbsp;T::<a class=\"associatedtype\" href=\"actix_web/dev/trait.Transform.html#associatedtype.Error\" title=\"type actix_web::dev::Transform::Error\">Error</a>: <a class=\"trait\" href=\"https://doc.rust-lang.org/1.66.1/core/convert/trait.Into.html\" title=\"trait core::convert::Into\">Into</a>&lt;<a class=\"struct\" href=\"actix_web/error/struct.Error.html\" title=\"struct actix_web::error::Error\">Error</a>&gt;,</span>"],["impl&lt;S, T, Req, BE, BD, Err&gt; <a class=\"trait\" href=\"actix_web/dev/trait.Transform.html\" title=\"trait actix_web::dev::Transform\">Transform</a>&lt;S, Req&gt; for <a class=\"struct\" href=\"actix_web/middleware/struct.Condition.html\" title=\"struct actix_web::middleware::Condition\">Condition</a>&lt;T&gt;<span class=\"where fmt-newline\">where<br>&nbsp;&nbsp;&nbsp;&nbsp;S: <a class=\"trait\" href=\"actix_web/dev/trait.Service.html\" title=\"trait actix_web::dev::Service\">Service</a>&lt;Req, Response = <a class=\"struct\" href=\"actix_web/dev/struct.ServiceResponse.html\" title=\"struct actix_web::dev::ServiceResponse\">ServiceResponse</a>&lt;BD&gt;, Error = Err&gt; + 'static,<br>&nbsp;&nbsp;&nbsp;&nbsp;T: <a class=\"trait\" href=\"actix_web/dev/trait.Transform.html\" title=\"trait actix_web::dev::Transform\">Transform</a>&lt;S, Req, Response = <a class=\"struct\" href=\"actix_web/dev/struct.ServiceResponse.html\" title=\"struct actix_web::dev::ServiceResponse\">ServiceResponse</a>&lt;BE&gt;, Error = Err&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;T::<a class=\"associatedtype\" href=\"actix_web/dev/trait.Transform.html#associatedtype.Future\" title=\"type actix_web::dev::Transform::Future\">Future</a>: 'static,<br>&nbsp;&nbsp;&nbsp;&nbsp;T::<a class=\"associatedtype\" href=\"actix_web/dev/trait.Transform.html#associatedtype.InitError\" title=\"type actix_web::dev::Transform::InitError\">InitError</a>: 'static,<br>&nbsp;&nbsp;&nbsp;&nbsp;T::<a class=\"associatedtype\" href=\"actix_web/dev/trait.Transform.html#associatedtype.Transform\" title=\"type actix_web::dev::Transform::Transform\">Transform</a>: 'static,</span>"],["impl&lt;S, B&gt; <a class=\"trait\" href=\"actix_web/dev/trait.Transform.html\" title=\"trait actix_web::dev::Transform\">Transform</a>&lt;S, <a class=\"struct\" href=\"actix_web/dev/struct.ServiceRequest.html\" title=\"struct actix_web::dev::ServiceRequest\">ServiceRequest</a>&gt; for <a class=\"struct\" href=\"actix_web/middleware/struct.DefaultHeaders.html\" title=\"struct actix_web::middleware::DefaultHeaders\">DefaultHeaders</a><span class=\"where fmt-newline\">where<br>&nbsp;&nbsp;&nbsp;&nbsp;S: <a class=\"trait\" href=\"actix_web/dev/trait.Service.html\" title=\"trait actix_web::dev::Service\">Service</a>&lt;<a class=\"struct\" href=\"actix_web/dev/struct.ServiceRequest.html\" title=\"struct actix_web::dev::ServiceRequest\">ServiceRequest</a>, Response = <a class=\"struct\" href=\"actix_web/dev/struct.ServiceResponse.html\" title=\"struct actix_web::dev::ServiceResponse\">ServiceResponse</a>&lt;B&gt;, Error = <a class=\"struct\" href=\"actix_web/error/struct.Error.html\" title=\"struct actix_web::error::Error\">Error</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;S::<a class=\"associatedtype\" href=\"actix_web/dev/trait.Service.html#associatedtype.Future\" title=\"type actix_web::dev::Service::Future\">Future</a>: 'static,</span>"],["impl&lt;S, B&gt; <a class=\"trait\" href=\"actix_web/dev/trait.Transform.html\" title=\"trait actix_web::dev::Transform\">Transform</a>&lt;S, <a class=\"struct\" href=\"actix_web/dev/struct.ServiceRequest.html\" title=\"struct actix_web::dev::ServiceRequest\">ServiceRequest</a>&gt; for <a class=\"struct\" href=\"actix_web/middleware/struct.ErrorHandlers.html\" title=\"struct actix_web::middleware::ErrorHandlers\">ErrorHandlers</a>&lt;B&gt;<span class=\"where fmt-newline\">where<br>&nbsp;&nbsp;&nbsp;&nbsp;S: <a class=\"trait\" href=\"actix_web/dev/trait.Service.html\" title=\"trait actix_web::dev::Service\">Service</a>&lt;<a class=\"struct\" href=\"actix_web/dev/struct.ServiceRequest.html\" title=\"struct actix_web::dev::ServiceRequest\">ServiceRequest</a>, Response = <a class=\"struct\" href=\"actix_web/dev/struct.ServiceResponse.html\" title=\"struct actix_web::dev::ServiceResponse\">ServiceResponse</a>&lt;B&gt;, Error = <a class=\"struct\" href=\"actix_web/error/struct.Error.html\" title=\"struct actix_web::error::Error\">Error</a>&gt; + 'static,<br>&nbsp;&nbsp;&nbsp;&nbsp;S::<a class=\"associatedtype\" href=\"actix_web/dev/trait.Service.html#associatedtype.Future\" title=\"type actix_web::dev::Service::Future\">Future</a>: 'static,<br>&nbsp;&nbsp;&nbsp;&nbsp;B: 'static,</span>"],["impl&lt;S, B&gt; <a class=\"trait\" href=\"actix_web/dev/trait.Transform.html\" title=\"trait actix_web::dev::Transform\">Transform</a>&lt;S, <a class=\"struct\" href=\"actix_web/dev/struct.ServiceRequest.html\" title=\"struct actix_web::dev::ServiceRequest\">ServiceRequest</a>&gt; for <a class=\"struct\" href=\"actix_web/middleware/struct.Logger.html\" title=\"struct actix_web::middleware::Logger\">Logger</a><span class=\"where fmt-newline\">where<br>&nbsp;&nbsp;&nbsp;&nbsp;S: <a class=\"trait\" href=\"actix_web/dev/trait.Service.html\" title=\"trait actix_web::dev::Service\">Service</a>&lt;<a class=\"struct\" href=\"actix_web/dev/struct.ServiceRequest.html\" title=\"struct actix_web::dev::ServiceRequest\">ServiceRequest</a>, Response = <a class=\"struct\" href=\"actix_web/dev/struct.ServiceResponse.html\" title=\"struct actix_web::dev::ServiceResponse\">ServiceResponse</a>&lt;B&gt;, Error = <a class=\"struct\" href=\"actix_web/error/struct.Error.html\" title=\"struct actix_web::error::Error\">Error</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;B: <a class=\"trait\" href=\"actix_web/body/trait.MessageBody.html\" title=\"trait actix_web::body::MessageBody\">MessageBody</a>,</span>"],["impl&lt;S, B&gt; <a class=\"trait\" href=\"actix_web/dev/trait.Transform.html\" title=\"trait actix_web::dev::Transform\">Transform</a>&lt;S, <a class=\"struct\" href=\"actix_web/dev/struct.ServiceRequest.html\" title=\"struct actix_web::dev::ServiceRequest\">ServiceRequest</a>&gt; for <a class=\"struct\" href=\"actix_web/middleware/struct.NormalizePath.html\" title=\"struct actix_web::middleware::NormalizePath\">NormalizePath</a><span class=\"where fmt-newline\">where<br>&nbsp;&nbsp;&nbsp;&nbsp;S: <a class=\"trait\" href=\"actix_web/dev/trait.Service.html\" title=\"trait actix_web::dev::Service\">Service</a>&lt;<a class=\"struct\" href=\"actix_web/dev/struct.ServiceRequest.html\" title=\"struct actix_web::dev::ServiceRequest\">ServiceRequest</a>, Response = <a class=\"struct\" href=\"actix_web/dev/struct.ServiceResponse.html\" title=\"struct actix_web::dev::ServiceResponse\">ServiceResponse</a>&lt;B&gt;, Error = <a class=\"struct\" href=\"actix_web/error/struct.Error.html\" title=\"struct actix_web::error::Error\">Error</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;S::<a class=\"associatedtype\" href=\"actix_web/dev/trait.Service.html#associatedtype.Future\" title=\"type actix_web::dev::Service::Future\">Future</a>: 'static,</span>"],["impl&lt;S, B&gt; <a class=\"trait\" href=\"actix_web/dev/trait.Transform.html\" title=\"trait actix_web::dev::Transform\">Transform</a>&lt;S, <a class=\"struct\" href=\"actix_web/dev/struct.ServiceRequest.html\" title=\"struct actix_web::dev::ServiceRequest\">ServiceRequest</a>&gt; for <a class=\"struct\" href=\"actix_web/middleware/struct.Compress.html\" title=\"struct actix_web::middleware::Compress\">Compress</a><span class=\"where fmt-newline\">where<br>&nbsp;&nbsp;&nbsp;&nbsp;B: <a class=\"trait\" href=\"actix_web/body/trait.MessageBody.html\" title=\"trait actix_web::body::MessageBody\">MessageBody</a>,<br>&nbsp;&nbsp;&nbsp;&nbsp;S: <a class=\"trait\" href=\"actix_web/dev/trait.Service.html\" title=\"trait actix_web::dev::Service\">Service</a>&lt;<a class=\"struct\" href=\"actix_web/dev/struct.ServiceRequest.html\" title=\"struct actix_web::dev::ServiceRequest\">ServiceRequest</a>, Response = <a class=\"struct\" href=\"actix_web/dev/struct.ServiceResponse.html\" title=\"struct actix_web::dev::ServiceResponse\">ServiceResponse</a>&lt;B&gt;, Error = <a class=\"struct\" href=\"actix_web/error/struct.Error.html\" title=\"struct actix_web::error::Error\">Error</a>&gt;,</span>"]],
"headless_lms_server":[["impl&lt;S, B&gt; <a class=\"trait\" href=\"actix_service/transform/trait.Transform.html\" title=\"trait actix_service::transform::Transform\">Transform</a>&lt;S, <a class=\"struct\" href=\"actix_web/service/struct.ServiceRequest.html\" title=\"struct actix_web::service::ServiceRequest\">ServiceRequest</a>&gt; for <a class=\"struct\" href=\"headless_lms_server/domain/request_span_middleware/struct.RequestSpan.html\" title=\"struct headless_lms_server::domain::request_span_middleware::RequestSpan\">RequestSpan</a><span class=\"where fmt-newline\">where<br>&nbsp;&nbsp;&nbsp;&nbsp;S: <a class=\"trait\" href=\"actix_service/trait.Service.html\" title=\"trait actix_service::Service\">Service</a>&lt;<a class=\"struct\" href=\"actix_web/service/struct.ServiceRequest.html\" title=\"struct actix_web::service::ServiceRequest\">ServiceRequest</a>, Response = <a class=\"struct\" href=\"actix_web/service/struct.ServiceResponse.html\" title=\"struct actix_web::service::ServiceResponse\">ServiceResponse</a>&lt;B&gt;, Error = <a class=\"struct\" href=\"actix_web/error/error/struct.Error.html\" title=\"struct actix_web::error::error::Error\">Error</a>&gt;,<br>&nbsp;&nbsp;&nbsp;&nbsp;S::<a class=\"associatedtype\" href=\"actix_service/trait.Service.html#associatedtype.Future\" title=\"type actix_service::Service::Future\">Future</a>: 'static,<br>&nbsp;&nbsp;&nbsp;&nbsp;B: 'static,</span>"]]
};if (window.register_implementors) {window.register_implementors(implementors);} else {window.pending_implementors = implementors;}})()