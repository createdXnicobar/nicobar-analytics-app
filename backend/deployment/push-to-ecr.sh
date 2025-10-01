#!/bin/bash

# TODO: set more verbose error boundaries
set -e

AWS_REGION="ap-south-1"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text)
REPO_NAME="created-nicobar/nicobar-analytics-project"
IMAGE_TAG=${1:-latest}

ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${REPO_NAME}:${IMAGE_TAG}"

# Build Docker image
docker build --platform linux/amd64 -f ../Dockerfile -t ${REPO_NAME}:${IMAGE_TAG} ..


docker tag ${REPO_NAME}:${IMAGE_TAG} ${ECR_URI}


aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com


aws ecr describe-repositories --repository-names ${REPO_NAME} --region ${AWS_REGION} >/dev/null 2>&1 || \
aws ecr create-repository --repository-name ${REPO_NAME} --region ${AWS_REGION}


# Push image
docker push ${ECR_URI}

echo "Image pushed to: ${ECR_URI}"