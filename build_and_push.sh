#!/usr/bin/env bash

gcloud config set project devops-229407
gcloud config set compute/zone europe-west1-b
gcloud auth configure-docker --quiet

docker build -t bb-pipeline-dashboard .
docker tag bb-pipeline-dashboard gcr.io/devops-229407/bb-pipeline-dashboard:1.0
docker push gcr.io/devops-229407/bb-pipeline-dashboard:1.0
