(function() {
    var implementors = Object.fromEntries([["headless_lms_server",[["impl&lt;S, B&gt; Service&lt;ServiceRequest&gt; for <a class=\"struct\" href=\"headless_lms_server/domain/rate_limit_middleware_builder/struct.RateLimitInner.html\" title=\"struct headless_lms_server::domain::rate_limit_middleware_builder::RateLimitInner\">RateLimitInner</a>&lt;S&gt;<div class=\"where\">where\n    S: Service&lt;ServiceRequest, Response = ServiceResponse&lt;B&gt;, Error = Error&gt; + 'static,\n    B: MessageBody + 'static,</div>"],["impl&lt;S, B&gt; Service&lt;ServiceRequest&gt; for <a class=\"struct\" href=\"headless_lms_server/domain/request_span_middleware/struct.RequestSpanMiddleware.html\" title=\"struct headless_lms_server::domain::request_span_middleware::RequestSpanMiddleware\">RequestSpanMiddleware</a>&lt;S&gt;<div class=\"where\">where\n    S: Service&lt;ServiceRequest, Response = ServiceResponse&lt;B&gt;, Error = Error&gt;,\n    S::Future: 'static,\n    B: 'static,</div>"]]]]);
    if (window.register_implementors) {
        window.register_implementors(implementors);
    } else {
        window.pending_implementors = implementors;
    }
})()
//{"start":57,"fragment_lengths":[939]}