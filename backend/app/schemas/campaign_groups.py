from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class GroupCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)


class GroupUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)


class GroupRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    created_at: datetime
    sequences_count: int = 0
