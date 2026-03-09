(function() {
    var implementors = Object.fromEntries([["headless_lms_server",[["impl&lt;S, B&gt; Transform&lt;S, ServiceRequest&gt; for <a class=\"struct\" href=\"headless_lms_server/domain/rate_limit_middleware_builder/struct.RateLimit.html\" title=\"struct headless_lms_server::domain::rate_limit_middleware_builder::RateLimit\">RateLimit</a><div class=\"where\">where\n    S: Service&lt;ServiceRequest, Response = ServiceResponse&lt;B&gt;, Error = Error&gt; + 'static,\n    B: MessageBody + 'static,</div>"],["impl&lt;S, B&gt; Transform&lt;S, ServiceRequest&gt; for <a class=\"struct\" href=\"headless_lms_server/domain/request_span_middleware/struct.RequestSpan.html\" title=\"struct headless_lms_server::domain::request_span_middleware::RequestSpan\">RequestSpan</a><div class=\"where\">where\n    S: Service&lt;ServiceRequest, Response = ServiceResponse&lt;B&gt;, Error = Error&gt;,\n    S::Future: 'static,\n    B: 'static,</div>"]]]]);
    if (window.register_implementors) {
        window.register_implementors(implementors);
    } else {
        window.pending_implementors = implementors;
    }
})()
//{"start":57,"fragment_lengths":[886]}