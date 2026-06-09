output "load_balancer_ip" {
  description = "The Global Static IP Address of the Load Balancer"
  value       = google_compute_global_address.default.address
}
