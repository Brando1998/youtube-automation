from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    database_url: str
    session_secret: str
    session_max_age_seconds: int = 60 * 60 * 24 * 14  # 14 días

    # Rutas donde viven los assets generados (en disco, no S3 — decisión de costo
    # del usuario, ver docs/EC2_SETUP.md). Cada tenant tiene su propia subcarpeta.
    data_dir: str = "./data"

    aws_region_anthropic: str = "us-east-1"
    aws_region_stability: str = "us-west-2"  # ver docs/EC2_SETUP.md: Stability solo existe ahí


settings = Settings()
