"""Team management endpoints for supervisors.

This module provides endpoints for supervisors to manage their team membership.
Supervisors can view available agents, add agents to their team, and remove agents.
"""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Path, status
from pydantic import BaseModel, EmailStr

from api.dependencies import get_current_user, get_supabase_client
from database.constants import Tables
from database.exceptions import DatabaseError, NotFoundError
from database.teams import add_agent_to_team
from database.users import get_user_by_id

router = APIRouter()


# =============================================================================
# Response Models
# =============================================================================


class AgentInfo(BaseModel):
    """Basic agent information for team management."""

    id: str
    email: EmailStr
    first_name: str | None
    last_name: str | None


class TeamMembersResponse(BaseModel):
    """Response containing list of team members."""

    members: list[AgentInfo]
    team_id: str


class AvailableAgentsResponse(BaseModel):
    """Response containing agents not assigned to any team."""

    agents: list[AgentInfo]


class AddMemberRequest(BaseModel):
    """Request to add an agent to the team."""

    agent_id: str


class MessageResponse(BaseModel):
    """Simple message response."""

    message: str


# =============================================================================
# Helper Functions
# =============================================================================


def _require_client(client: Any) -> Any:
    """Ensure the database client is available.

    Args:
        client: The Supabase client instance

    Returns:
        The validated client

    Raises:
        HTTPException: If client is None (503 Service Unavailable)
    """
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service unavailable",
        )
    return client


def _get_user_team_id(current_user: dict) -> str:
    """Extract team_id from current user.

    Args:
        current_user: User dict containing team_id

    Returns:
        The team ID string

    Raises:
        HTTPException: If user is not assigned to a team (403 Forbidden)
    """
    team_id = current_user.get("team_id")
    if not team_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not assigned to a team",
        )
    return team_id


def _require_supervisor_role(current_user: dict) -> None:
    """Ensure the current user is a supervisor.

    Args:
        current_user: User dict containing role

    Raises:
        HTTPException: If user is not a supervisor (403 Forbidden)
    """
    role = current_user.get("role")
    if role != "supervisor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This endpoint is only accessible to supervisors",
        )


# =============================================================================
# Endpoints
# =============================================================================


@router.get("/members", response_model=TeamMembersResponse)
def get_team_members(
    current_user: Annotated[dict, Depends(get_current_user)],
    client: Annotated[Any, Depends(get_supabase_client)],
) -> TeamMembersResponse:
    """Get all members of the supervisor's team.

    Returns a list of agents assigned to the supervisor's team.
    Only accessible to supervisors.

    Args:
        current_user: The authenticated supervisor user
        client: Supabase database client

    Returns:
        TeamMembersResponse containing list of team members and team ID

    Raises:
        HTTPException: 403 if not a supervisor or not assigned to a team
        HTTPException: 503 if database is unavailable
    """
    db_client = _require_client(client)
    _require_supervisor_role(current_user)
    team_id = _get_user_team_id(current_user)

    # Query all users in the team with role='agent'
    result = (
        db_client.table(Tables.USERS)
        .select("id, email, first_name, last_name")
        .eq("team_id", team_id)
        .eq("role", "agent")
        .execute()
    )

    members = [AgentInfo(**member) for member in result.data]

    return TeamMembersResponse(members=members, team_id=team_id)


@router.get("/available-agents", response_model=AvailableAgentsResponse)
def get_available_agents(
    current_user: Annotated[dict, Depends(get_current_user)],
    client: Annotated[Any, Depends(get_supabase_client)],
) -> AvailableAgentsResponse:
    """Get all agents not assigned to any team.

    Returns agents that are available to be added to a team.
    Only accessible to supervisors.

    Args:
        current_user: The authenticated supervisor user
        client: Supabase database client

    Returns:
        AvailableAgentsResponse containing list of unassigned agents

    Raises:
        HTTPException: 403 if not a supervisor
        HTTPException: 503 if database is unavailable
    """
    db_client = _require_client(client)
    _require_supervisor_role(current_user)

    # Query agents without a team_id
    result = (
        db_client.table(Tables.USERS)
        .select("id, email, first_name, last_name")
        .eq("role", "agent")
        .is_("team_id", "null")
        .execute()
    )

    agents = [AgentInfo(**agent) for agent in result.data]

    return AvailableAgentsResponse(agents=agents)


@router.post("/members", response_model=MessageResponse)
def add_team_member(
    request: AddMemberRequest,
    current_user: Annotated[dict, Depends(get_current_user)],
    client: Annotated[Any, Depends(get_supabase_client)],
) -> MessageResponse:
    """Add an agent to the supervisor's team.

    Assigns an unassigned agent to the supervisor's team.
    The agent must not already be on another team.

    Args:
        request: Request body containing agent_id to add
        current_user: The authenticated supervisor user
        client: Supabase database client

    Returns:
        MessageResponse confirming the addition

    Raises:
        HTTPException: 403 if not a supervisor or not assigned to a team
        HTTPException: 404 if agent not found
        HTTPException: 400 if agent already on a team
        HTTPException: 500 if database operation fails
        HTTPException: 503 if database is unavailable
    """
    db_client = _require_client(client)
    _require_supervisor_role(current_user)
    team_id = _get_user_team_id(current_user)

    try:
        # Verify the agent exists and is not already on a team
        agent = get_user_by_id(db_client, request.agent_id)

        if agent.get("role") != "agent":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User is not an agent",
            )

        if agent.get("team_id"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Agent is already assigned to a team",
            )

        # Add agent to team
        add_agent_to_team(db_client, request.agent_id, team_id)

        return MessageResponse(message="Agent added to team successfully")

    except NotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found",
        ) from exc
    except DatabaseError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add agent to team",
        ) from exc


@router.delete("/members/{agent_id}", response_model=MessageResponse)
def remove_team_member(
    agent_id: Annotated[str, Path(description="ID of the agent to remove")],
    current_user: Annotated[dict, Depends(get_current_user)],
    client: Annotated[Any, Depends(get_supabase_client)],
) -> MessageResponse:
    """Remove an agent from the supervisor's team.

    Unassigns an agent from the supervisor's team by setting their
    team_id to null. The agent must be on the supervisor's team.

    Args:
        agent_id: UUID of the agent to remove
        current_user: The authenticated supervisor user
        client: Supabase database client

    Returns:
        MessageResponse confirming the removal

    Raises:
        HTTPException: 403 if not a supervisor or not assigned to a team
        HTTPException: 404 if agent not found or not on supervisor's team
        HTTPException: 500 if database operation fails
        HTTPException: 503 if database is unavailable
    """
    db_client = _require_client(client)
    _require_supervisor_role(current_user)
    team_id = _get_user_team_id(current_user)

    try:
        # Verify the agent exists and is on this supervisor's team
        agent = get_user_by_id(db_client, agent_id)

        if agent.get("team_id") != team_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Agent not found on your team",
            )

        # Remove agent from team by setting team_id to null
        result = (
            db_client.table(Tables.USERS).update({"team_id": None}).eq("id", agent_id).execute()
        )

        if not result.data:
            raise DatabaseError("Failed to remove agent from team")

        return MessageResponse(message="Agent removed from team successfully")

    except NotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found",
        ) from exc
    except DatabaseError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to remove agent from team",
        ) from exc
