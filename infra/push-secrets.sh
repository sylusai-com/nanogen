#!/bin/bash
echo "Adding .env.production to Secret Manager (nanogen-prod)..."

gcloud secrets versions add nanogen-env-production \
  --data-file=.env.production \
  --project=nanogen-prod

echo ".env.production added to Secret Manager successfully"
