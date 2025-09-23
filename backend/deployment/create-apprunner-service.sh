
ECR_URI="587449398095.dkr.ecr.ap-south-1.amazonaws.com/created-nicobar/nicobar-analytics-project:v1.0.0"
AWS_REGION="ap-south-1"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text)


aws iam create-role \
  --role-name AppRunnerECRAccessRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": { "Service": "build.apprunner.amazonaws.com" },
        "Action": "sts:AssumeRole"
      }
    ]
  }'


aws iam put-role-policy \
  --role-name AppRunnerECRAccessRole \
  --policy-name AppRunnerECRPullPolicy \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage"
        ],
        "Resource": "*"
      }
    ]
  }'


# aws apprunner create-service \
#   --service-name nicobar-project \
#   --source-configuration "ImageRepository={ImageIdentifier=${ECR_URI},ImageRepositoryType=ECR,ImageConfiguration={Port=8000}},AuthenticationConfiguration={AccessRoleArn=arn:aws:iam::${AWS_ACCOUNT_ID}:role/AppRunnerECRAccessRole}" \
#   --region ${AWS_REGION}
aws apprunner create-service \
  --service-name nicobar-project-2 \
  --source-configuration "ImageRepository={ImageIdentifier=${ECR_URI},ImageRepositoryType=ECR,ImageConfiguration={Port=8000}},AuthenticationConfiguration={AccessRoleArn=arn:aws:iam::${AWS_ACCOUNT_ID}:role/AppRunnerECRAccessRole}" \
  --region ${AWS_REGION} \
  --health-check-configuration "Protocol=HTTP,Path=/health,Interval=5,Timeout=2,HealthyThreshold=1,UnhealthyThreshold=5"