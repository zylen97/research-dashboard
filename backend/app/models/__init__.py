from .database import (
    Base,
    engine,
    SessionLocal,
    get_db,
    create_tables,
    Collaborator,
    ResearchProject,
    Literature,
    CommunicationLog,
    AuditLog,
    User,
    SystemConfig,
    project_collaborators
)

from .schemas import (
    # Collaborator schemas
    CollaboratorBase,
    CollaboratorCreate,
    CollaboratorUpdate,
    Collaborator as CollaboratorSchema,

    # Research Project schemas
    ResearchProjectBase,
    ResearchProjectCreate,
    ResearchProjectUpdate,
    ResearchProject as ResearchProjectSchema,

    # Literature schemas
    LiteratureBase,
    LiteratureCreate,
    LiteratureUpdate,
    Literature as LiteratureSchema,


    # Communication Log schemas
    CommunicationLogBase,
    CommunicationLogCreate,
    CommunicationLogUpdate,
    CommunicationLog as CommunicationLogSchema,

    # User schemas
    UserBase,
    UserCreate,
    UserUpdate,
    UserLogin,
    User as UserSchema,

    # Auth schemas
    Token,

    # Utility schemas
    FileUploadResponse,
    ValidationRequest,
    ValidationResult,

    # System Config schemas
    SystemConfigBase,
    SystemConfigCreate,
    SystemConfigUpdate,
    SystemConfig as SystemConfigSchema,

    # AI Provider schemas
    AIProviderConfig,
    AITestRequest,
    AITestResponse,

    # Batch AI Matching schemas
    BatchMatchingRequest,
    MatchingResult,
    BatchMatchingResponse
)

__all__ = [
    "Base", "engine", "SessionLocal", "get_db", "create_tables",
    "Collaborator", "ResearchProject", "Literature", "CommunicationLog", "AuditLog", "User", "SystemConfig",
    "project_collaborators",
    "CollaboratorBase", "CollaboratorCreate", "CollaboratorUpdate", "CollaboratorSchema",
    "ResearchProjectBase", "ResearchProjectCreate", "ResearchProjectUpdate", "ResearchProjectSchema",
    "LiteratureBase", "LiteratureCreate", "LiteratureUpdate", "LiteratureSchema",
    "CommunicationLogBase", "CommunicationLogCreate", "CommunicationLogUpdate", "CommunicationLogSchema",
    "UserBase", "UserCreate", "UserUpdate", "UserLogin", "UserSchema",
    "Token",
    "FileUploadResponse", "ValidationRequest", "ValidationResult",
    "SystemConfigBase", "SystemConfigCreate", "SystemConfigUpdate", "SystemConfigSchema",
    "AIProviderConfig", "AITestRequest", "AITestResponse",
    "BatchMatchingRequest", "MatchingResult", "BatchMatchingResponse"
]
