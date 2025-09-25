variable "project" {
  description = "Project name used for tagging"
  type        = string
  default     = "cryptohybrid"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "staging"
}

variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "us-east-1"
}

variable "availability_zones" {
  description = "Availability zones used for subnets"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b"]
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.20.0.0/16"
}

variable "postgres_db" {
  description = "Initial PostgreSQL database name"
  type        = string
  default     = "cryptohybridbank"
}

variable "postgres_user" {
  description = "PostgreSQL master username"
  type        = string
  default     = "cryptohybrid"
}

variable "postgres_password" {
  description = "PostgreSQL master password"
  type        = string
  sensitive   = true
}

variable "enable_deletion_protection" {
  description = "Protect RDS cluster from accidental deletions"
  type        = bool
  default     = true
}

variable "enable_kafka" {
  description = "Provision Kafka/MSK infrastructure"
  type        = bool
  default     = true
}

variable "redis_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t3.small"
}

variable "primary_domain" {
  description = "Primary domain for TLS certificate"
  type        = string
  default     = "bank.cryptohybrid.local"
}

variable "additional_domains" {
  description = "Subject alternative names for TLS certificate"
  type        = list(string)
  default     = []
}

variable "backup_role_arn" {
  description = "IAM role ARN used by AWS Backup"
  type        = string
}
