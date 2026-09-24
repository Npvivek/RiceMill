"""Authenticated owner-only AI threads for a committed workbook."""

from datetime import datetime
from typing import Literal
from uuid import UUID

import psycopg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.exc import SQLAlchemyError

from app.v2.ai.conversations import ConversationFailure, ConversationService
from app.v2.ai.service import AnalysisFailure
from app.v2.auth import AuthenticatedUser, get_current_user
from app.v2.config import Settings, get_settings
from app.v2.db import runtime_engine

router = APIRouter()


class CreateConversationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    dataset_version_id: UUID
    mode: Literal["chat", "anomalies"]


class SendMessageRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    content: str = Field(min_length=1, max_length=2000)


class CitationSegmentResponse(BaseModel):
    text: str
    ref: str | None = None
    source_ref: UUID | None = None


class ConversationMessageResponse(BaseModel):
    id: UUID
    author_type: Literal["user", "assistant"]
    content: str
    segments: list[CitationSegmentResponse]
    response_kind: Literal["normal", "fallback", "abstained"]
    created_at: datetime


class StaticFindingResponse(BaseModel):
    title: str
    explanation: str


class ConversationResponse(BaseModel):
    id: UUID
    dataset_version_id: UUID
    mode: Literal["chat", "anomalies"]
    created_at: datetime
    messages: list[ConversationMessageResponse]
    fallback_findings: list[StaticFindingResponse] = Field(default_factory=list)


def get_conversation_service(settings: Settings = Depends(get_settings)) -> ConversationService:
    if not settings.runtime_database_url:
        raise HTTPException(status_code=503, detail="Conversation database is not configured.")
    try:
        engine = runtime_engine(settings.runtime_database_url, settings.app_environment)
    except ValueError as error:
        raise HTTPException(status_code=503, detail="Conversation database configuration is invalid.") from error
    return ConversationService(engine, settings.runtime_database_url, settings.openrouter_api_key)


def _response(service: ConversationService, user_id: UUID, record: dict) -> ConversationResponse:
    if record["messages"] and record["messages"][-1]["response_kind"] == "fallback":
        record["fallback_findings"] = service.static_findings(user_id, record["dataset_version_id"])
    return ConversationResponse.model_validate(record)


def _raise(error: ConversationFailure | AnalysisFailure) -> HTTPException:
    return HTTPException(status_code=error.status_code,
                         detail={"code": error.code, "message": error.message})


@router.post("/conversations", response_model=ConversationResponse, status_code=201)
def create_conversation(
    payload: CreateConversationRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    service: ConversationService = Depends(get_conversation_service),
) -> ConversationResponse:
    try:
        subject = UUID(user.id)
        return _response(service, subject, service.create(subject, payload.dataset_version_id, payload.mode))
    except (ConversationFailure, AnalysisFailure) as error:
        raise _raise(error) from error
    except (SQLAlchemyError, psycopg.Error, OSError) as error:
        raise HTTPException(status_code=503, detail="Conversations are temporarily unavailable.") from error


@router.post("/conversations/{thread_id}/messages", response_model=ConversationResponse)
def send_message(
    thread_id: UUID, payload: SendMessageRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    service: ConversationService = Depends(get_conversation_service),
) -> ConversationResponse:
    if not payload.content.strip():
        raise HTTPException(status_code=422, detail="Message cannot be blank.")
    try:
        subject = UUID(user.id)
        return _response(service, subject, service.post(subject, thread_id, payload.content.strip()))
    except (ConversationFailure, AnalysisFailure) as error:
        raise _raise(error) from error
    except (SQLAlchemyError, psycopg.Error, OSError) as error:
        raise HTTPException(status_code=503, detail="Conversations are temporarily unavailable.") from error


@router.get("/conversations/{thread_id}", response_model=ConversationResponse)
def get_conversation(
    thread_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    service: ConversationService = Depends(get_conversation_service),
) -> ConversationResponse:
    try:
        subject = UUID(user.id)
        return _response(service, subject, service.get(subject, thread_id))
    except (ConversationFailure, AnalysisFailure) as error:
        raise _raise(error) from error
    except (SQLAlchemyError, psycopg.Error, OSError) as error:
        raise HTTPException(status_code=503, detail="Conversations are temporarily unavailable.") from error
