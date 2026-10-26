import uuid

from pydantic import BaseModel, EmailStr, Field


class SignupRequest(BaseModel):
    tenant_nombre: str = Field(min_length=1, max_length=200)
    nombre: str = Field(min_length=1, max_length=200)
    email: EmailStr
    password: str = Field(min_length=10, max_length=200)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UsuarioOut(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    email: EmailStr
    nombre: str
    rol: str

    model_config = {"from_attributes": True}
