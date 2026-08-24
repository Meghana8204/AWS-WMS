"""
Central application configuration.

All values are overridable via environment variables (12-factor style).
See .env.example at the service root for the full list.
"""
from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "business-service/.env", "../business-service/.env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )


    service_name: str = "business-service"
    environment: str = Field(default="local")
    api_prefix: str = "/api"
    log_level: str = "INFO"
    log_json: bool = Field(default=False)


    database_url: str = Field(
        default="postgresql+asyncpg://ams_business:ams_business@localhost:5433/ams_business",
        description="Async SQLAlchemy URL for the business database (one DB per deployable unit).",
    )
    database_pool_size: int = 10
    database_max_overflow: int = 20
    database_echo: bool = False


    auth_service_base_url: str = Field(default="http://auth-service:8080")
    jwt_jwks_url: str = Field(
        default="http://auth-service:8080/.well-known/jwks.json",
        description="JWKS endpoint on the Java auth-service; fetched and cached, not called per-request.",
    )
    jwt_issuer: str = Field(default="ams-auth-service")
    jwt_audience: str = Field(default="ams-business-service")
    jwt_algorithm: str = Field(default="RS256")
    jwks_cache_ttl_seconds: int = Field(default=300)


    kafka_bootstrap_servers: str = Field(default="localhost:9092")
    kafka_client_id: str = Field(default="business-service")
    kafka_topic_prefix: str = Field(default="ams")
    kafka_consumer_group: str = Field(default="business-service-notification")
    kafka_security_protocol: str = Field(default="PLAINTEXT")


    redis_url: str = Field(default="redis://localhost:6379/0")


    outbox_poll_interval_seconds: int = Field(default=2)
    outbox_batch_size: int = Field(default=100)


    gemini_api_key: str = Field(default="")
    gemini_model: str = Field(default="gemini-3.1-flash-lite-preview")


    cors_allow_origins: List[str] = Field(default_factory=lambda: ["http://localhost:8080", "http://127.0.0.1:8080"])


    otel_exporter_otlp_endpoint: str = Field(default="http://otel-collector:4317")
    otel_enabled: bool = Field(default=False)
    prometheus_enabled: bool = Field(default=True)


    admin_username: str = Field(default="admin")
    admin_password: str = Field(default="admin")
    procurement_username: str = Field(default="procurement")
    procurement_password: str = Field(default="procurement")
    finance_username: str = Field(default="finance")
    finance_password: str = Field(default="finance")
    warehouse_username: str = Field(default="warehouse")
    warehouse_password: str = Field(default="warehouse")
    gate_security_username: str = Field(default="gate_entry")
    gate_security_password: str = Field(default="gate123")
    gate_entry_username: str = Field(default="gate_entry")
    gate_entry_password: str = Field(default="gate123")
    supplier_username: str = Field(default="supplier")
    supplier_password: str = Field(default="supplier123")


    email_host: str = Field(default="smtp.gmail.com")
    email_port: int = Field(default=587)
    email_host_user: str = Field(default="")
    email_host_password: str = Field(default="")
    email_from_name: str = Field(default="NexusWMS Procurement")


@lru_cache
def get_settings() -> Settings:
    return Settings()
