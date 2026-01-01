from .database import (
    Base,
    engine,
    SessionLocal,
    get_db,
    create_tables,
    Collaborator,
    ResearchProject,
    CommunicationLog,
    AuditLog,
    SystemConfig,
    Idea,
    Tag,
    Journal,
    Paper,
    project_collaborators,
    journal_tags
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


    # Communication Log schemas
    CommunicationLogBase,
    CommunicationLogCreate,
    CommunicationLogUpdate,
    CommunicationLog as CommunicationLogSchema,

    # Utility schemas
    FileUploadResponse,

    # System Config schemas
    SystemConfigBase,
    SystemConfigCreate,
    SystemConfigUpdate,
    SystemConfig as SystemConfigSchema,

    # AI Provider schemas
    AIProviderConfig,
    AITestRequest,
    AITestResponse,

    # Idea schemas
    IdeaBase,
    IdeaCreate,
    IdeaUpdate,
    Idea as IdeaSchema,

    # Tag schemas
    TagBase,
    TagCreate,
    TagUpdate,
    Tag as TagSchema,

    # Journal schemas
    JournalBase,
    JournalCreate,
    JournalUpdate,
    Journal as JournalSchema,

    # Paper schemas
    PaperStatus,
    PaperBase,
    PaperCreate,
    PaperUpdate,
    Paper as PaperSchema,

)

__all__ = [
    "Base", "engine", "SessionLocal", "get_db", "create_tables",
    "Collaborator", "ResearchProject", "CommunicationLog", "AuditLog", "SystemConfig", "Idea", "Tag", "Journal", "Paper",
    "project_collaborators", "journal_tags",
    "CollaboratorBase", "CollaboratorCreate", "CollaboratorUpdate", "CollaboratorSchema",
    "ResearchProjectBase", "ResearchProjectCreate", "ResearchProjectUpdate", "ResearchProjectSchema",
    "CommunicationLogBase", "CommunicationLogCreate", "CommunicationLogUpdate", "CommunicationLogSchema",
    "FileUploadResponse",
    "SystemConfigBase", "SystemConfigCreate", "SystemConfigUpdate", "SystemConfigSchema",
    "AIProviderConfig", "AITestRequest", "AITestResponse",
    "IdeaBase", "IdeaCreate", "IdeaUpdate", "IdeaSchema",
    "TagBase", "TagCreate", "TagUpdate", "TagSchema",
    "JournalBase", "JournalCreate", "JournalUpdate", "JournalSchema",
    "PaperStatus", "PaperBase", "PaperCreate", "PaperUpdate", "PaperSchema",
]
