from pydantic import BaseModel

class VerifyRequest(BaseModel):
    token: str

class ResendVerifyRequest(BaseModel):
    email: str