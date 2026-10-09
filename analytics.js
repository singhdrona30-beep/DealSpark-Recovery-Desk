// DealSpark privacy-friendly first-party analytics.
// Collects only event type, page path, referrer URL, destination URL and a random session ID.
// Never collects IP addresses, names, emails, or form contents.
(function () {
  "use strict";
  var endpoint = "https://dealspark-api.singhdrona30.workers.dev/analytics";
  try {
    var sid = sessionStorage.getItem("ds_sid");
    if (!sid) {
      sid = (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
      sessionStorage.setItem("ds_sid", sid);
    }
    function send(eventName, target) {
      var payload = JSON.stringify({
        event: eventName,
        session_id: sid,
        page: location.pathname,
        referrer: document.referrer || "",
        target: String(target || "").slice(0, 1000)
      });
      // text/plain is a CORS-safelisted content type and avoids a failing JSON preflight.
      if (navigator.sendBeacon) {
        navigator.sendBeacon(endpoint, new Blob([payload], { type: "text/plain;charset=UTF-8" }));
      } else {
        fetch(endpoint, {
          method: "POST",
          mode: "cors",
          credentials: "omit",
          headers: { "content-type": "text/plain;charset=UTF-8" },
          body: payload,
          keepalive: true
        }).catch(function () {});
      }
    }
    send("page_view", location.pathname);
    document.addEventListener("click", function (event) {
      var link = event.target && event.target.closest ? event.target.closest("a") : null;
      if (!link) return;
      var href = link.href || "";
      if (/signup\.html|buy\.stripe\.com|checkout\.stripe\.com|mailto:|^tel:/i.test(href) || link.dataset.dealsparkLead === "true") {
        send("lead_click", href);
      } else if (/chatbot\.html|ops-lab\/.*demo|product-suite\.html/i.test(href) || link.dataset.dealsparkDemo === "true") {
        send("demo_click", href);
      }
    }, { passive: true });
  } catch (error) {
    // Analytics must never break the customer-facing page.
  }
})();
