# Create a Backend Service
resource "google_compute_backend_service" "default" {
  name                  = "${var.prefix}-backend"
  protocol              = "HTTPS"
  port_name             = "http"
  load_balancing_scheme = "EXTERNAL"
  enable_cdn            = false
  project               = var.project_id

  backend {
    group = google_compute_region_network_endpoint_group.default.id
  }
}
