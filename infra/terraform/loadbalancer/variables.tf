variable "project_id" {
  description = "The GCP Project ID"
  type        = string
}

variable "region" {
  description = "The GCP region for the Serverless NEG"
  type        = string
  default     = "asia-south2"
}

variable "service_name" {
  description = "The name of the Cloud Run service to route traffic to"
  type        = string
}

variable "domain" {
  description = "The domain name for the SSL certificate and routing"
  type        = string
}

variable "prefix" {
  description = "Prefix for the created resources"
  type        = string
  default     = "nanogen-app"
}
