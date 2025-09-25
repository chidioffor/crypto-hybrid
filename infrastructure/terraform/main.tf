terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags = {
    Name = "${var.project}-vpc"
  }
}

resource "aws_subnet" "private" {
  count                   = 2
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 4, count.index)
  availability_zone       = element(var.availability_zones, count.index)
  map_public_ip_on_launch = false
  tags = {
    Name = "${var.project}-private-${count.index}"
  }
}

resource "aws_security_group" "services" {
  name        = "${var.project}-services"
  description = "Allow internal service communication"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "Intra VPC traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = [var.vpc_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project}-services"
  }
}

resource "aws_db_subnet_group" "postgres" {
  name       = "${var.project}-postgres-subnets"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_rds_cluster" "postgres" {
  cluster_identifier      = "${var.project}-postgres"
  engine                  = "aurora-postgresql"
  engine_mode             = "provisioned"
  database_name           = var.postgres_db
  master_username         = var.postgres_user
  master_password         = var.postgres_password
  vpc_security_group_ids  = [aws_security_group.services.id]
  db_subnet_group_name    = aws_db_subnet_group.postgres.name
  backup_retention_period = 7
  preferred_backup_window = "04:00-05:00"
  deletion_protection     = var.enable_deletion_protection
  storage_encrypted       = true
  apply_immediately       = true
}

resource "aws_msk_serverless_cluster" "kafka" {
  count             = var.enable_kafka ? 1 : 0
  cluster_name      = "${var.project}-kafka"
  vpc_config {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.services.id]
  }
  client_authentication {
    sasl {
      iam = true
    }
  }
  tags = {
    Environment = var.environment
  }
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id          = "${var.project}-redis"
  replication_group_description = "Redis cache for ${var.project}"
  node_type                     = var.redis_node_type
  number_cache_clusters         = 2
  automatic_failover_enabled    = true
  subnet_group_name             = aws_elasticache_subnet_group.redis.name
  security_group_ids            = [aws_security_group.services.id]
  transit_encryption_enabled    = true
  at_rest_encryption_enabled    = true
}

resource "aws_elasticache_subnet_group" "redis" {
  name       = "${var.project}-redis-subnets"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_acm_certificate" "ingress" {
  domain_name       = var.primary_domain
  validation_method = "DNS"
  subject_alternative_names = var.additional_domains

  tags = {
    Name = "${var.project}-ingress"
  }
}

resource "aws_backup_vault" "main" {
  name = "${var.project}-backups"
}

resource "aws_backup_plan" "main" {
  name = "${var.project}-plan"

  rule {
    rule_name         = "daily-backups"
    target_vault_name = aws_backup_vault.main.name
    schedule          = "cron(0 3 * * ? *)"
    lifecycle {
      delete_after = 30
    }
  }
}

resource "aws_backup_selection" "database" {
  iam_role_arn = var.backup_role_arn
  name         = "${var.project}-rds-selection"
  plan_id      = aws_backup_plan.main.id

  resources = [aws_rds_cluster.postgres.arn]
}

resource "aws_backup_selection" "redis" {
  iam_role_arn = var.backup_role_arn
  name         = "${var.project}-redis-selection"
  plan_id      = aws_backup_plan.main.id

  resources = [aws_elasticache_replication_group.redis.arn]
}
