#!/bin/bash

# TODO: set more verbose error boundaries
set -e

AWS_REGION="ap-south-1"
SERVICE_NAME="nicobar-project"
REPO_NAME="created-nicobar/nicobar-analytics-project"
IMAGE_TAG=${1:-latest}


AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text)
ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${REPO_NAME}:${IMAGE_TAG}"

# Build & push image to ECR
./push-to-ecr.sh ${IMAGE_TAG}


SERVICE_ARN=$(aws apprunner list-services \
  --query "ServiceSummaryList[?ServiceName=='${SERVICE_NAME}'].ServiceArn" \
  --output text --region ${AWS_REGION})


if [ -z "$SERVICE_ARN" ]; then
  echo "Error: App Runner service '${SERVICE_NAME}' not found. Cannot deploy."
  exit 1
fi


# Trigger deployment with the latest image
echo "🔹 Triggering deployment for App Runner service '${SERVICE_NAME}'..."
aws apprunner update-service \
  --service-arn ${SERVICE_ARN} \
  --source-configuration "ImageRepository={ImageIdentifier=${ECR_URI},ImageRepositoryType=ECR,ImageConfiguration={Port=8000}},AuthenticationConfiguration={AccessRoleArn=arn:aws:iam::${AWS_ACCOUNT_ID}:role/AppRunnerECRAccessRole}" \
  --region ${AWS_REGION}

echo "Deployment triggered for App Runner service '${SERVICE_NAME}' with image: ${ECR_URI}"