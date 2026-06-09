# Reserve a Global Static IP address
resource "google_compute_global_address" "default" {
  name         = "${var.prefix}-ip"
  address_type = "EXTERNAL"
  ip_version   = "IPV4"
  project      = var.project_id
}

# Create a Serverless Network Endpoint Group (NEG) for Cloud Run
resource "google_compute_region_network_endpoint_group" "default" {
  name                  = "${var.prefix}-neg"
  network_endpoint_type = "SERVERLESS"
  region                = var.region
  project               = var.project_id

  cloud_run {
    service = var.service_name
  }
}
