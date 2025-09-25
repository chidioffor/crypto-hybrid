output "postgres_endpoint" {
  description = "Aurora cluster endpoint"
  value       = aws_rds_cluster.postgres.endpoint
}

output "kafka_bootstrap_brokers" {
  description = "Kafka bootstrap brokers"
  value       = try(aws_msk_serverless_cluster.kafka[0].cluster_arn, null)
}

output "redis_endpoint" {
  description = "Redis primary endpoint"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
}

output "backup_vault_arn" {
  description = "AWS Backup vault ARN"
  value       = aws_backup_vault.main.arn
}
