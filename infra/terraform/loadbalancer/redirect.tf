# URL Map to redirect HTTP to HTTPS
resource "google_compute_url_map" "http_redirect" {
  name    = "${var.prefix}-http-redirect"
  project = var.project_id

  default_url_redirect {
    redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
    https_redirect         = true
    strip_query            = false
  }
}

# Target HTTP Proxy
resource "google_compute_target_http_proxy" "http" {
  name    = "${var.prefix}-http-proxy"
  url_map = google_compute_url_map.http_redirect.id
  project = var.project_id
}

# Global Forwarding Rule for HTTP (Port 80)
resource "google_compute_global_forwarding_rule" "http" {
  name                  = "${var.prefix}-http-rule"
  target                = google_compute_target_http_proxy.http.id
  port_range            = "80"
  ip_address            = google_compute_global_address.default.id
  load_balancing_scheme = "EXTERNAL"
  project               = var.project_id
}
