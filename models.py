from pydantic import BaseModel
from enum import Enum


class Product(str, Enum):
    orchestrator = "Zen Orchestrator"
    studio = "Zen Studio"
    connect = "Zen Connect"
    insights = "Zen Insights"
    vault = "Zen Vault"

class Category(str, Enum):
    outage = "outage"
    billing = "billing"
    bug = "bug"
    feature_request = "feature_request"
    how_to = "how_to"
    churn_risk = "churn_risk"

class Severity(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"

class RequestedAction(str, Enum):
    refund = "refund"
    credit = "credit"
    fix = "fix"
    callback = "callback"
    information = "information"
    none = "none"

class TicketResponse(BaseModel):
    company: str
    product: Product
    category: Category
    severity: Severity
    requested_action: RequestedAction
    refund_amount: float | None = None
    deadline: date | None = None
    escalated: bool
    uncertain_fields: list[str] = []

class ProcessedTicket(BaseModel):
    id: str
    company: str
    product: Product
    category: Category
    severity: Severity
    requested_action: RequestedAction
    refund_amount: float | None = None
    deadline: date | None = None
    escalated: bool
    uncertain_fields: list[str] = []
    modified: list[str] = []

class Ticket(BaseModel):
    id: str
    subject: str
    body: str
    received_at: str
    from_email: str
    channel: str
    attachments: int

class JobRequest(BaseModel):
    tickets: list[str]

class HumanReview(BaseModel):
    ticket_id: str
    ticket: Ticket
    ai_output: dict | None = None
    reason: str
    status: str = "needs_review"
