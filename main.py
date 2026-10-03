from datetime import date

from fastapi import FastAPI, BackgroundTasks
from fastapi.responses import FileResponse
from pydantic import BaseModel, ValidationError
from google import genai
from enum import Enum

import dotenv
import os
import json
import pandas as pd
import asyncio


dotenv.load_dotenv()

app = FastAPI()

client = genai.Client(
    api_key=os.getenv("GEMINI_API_KEY")
)



# Maximum number of AI requests running at the same time
MAX_WORKERS = int(os.getenv("MAX_WORKERS", "1"))

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

    # Same ID as the original ticket
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

    raw_output: str | None = None

    reason: str

    status: str = "needs_review"


ticket_dict = {}


processed_jobs = {}



jobs = {}


# Tickets where AI extraction was valid
# but requires human review.
human_check = {}


# Tickets where AI failed validation twice.
failed = {}


j_id = 0



def json_to_ticket_dict():

    with open(
        "data/tickets.jsonl",
        "r",
        encoding="utf-8"
    ) as f:

        for line in f:

            ticket = json.loads(line)

            t = Ticket(
                id=ticket["id"],
                subject=ticket["subject"],
                body=ticket["body"],
                received_at=ticket["received_at"],
                channel=ticket["channel"],
                attachments=ticket["attachments"],
                from_email=ticket["from_email"]
            )

            ticket_dict[t.id] = t


json_to_ticket_dict()



def gemini_agent_for_ticket(ticket: Ticket):

    response = client.models.generate_content(

        model="gemini-3.5-flash-lite",

        contents=f"""
        Extract structured information from the following
        customer support ticket.

        Ticket ID: {ticket.id}

        Subject:
        {ticket.subject}

        Body:
        {ticket.body}

        Received At:
        {ticket.received_at}

        From Email:
        {ticket.from_email}

        Channel:
        {ticket.channel}

        Attachments:
        {ticket.attachments}

        Return all required fields according to the
        provided schema.

        Do not invent any information.
        Use only information available in the ticket.
        """,

        config={
            "response_mime_type": "application/json",
            "response_schema":
                TicketResponse.model_json_schema(),
        }
    )

    return response.text


def extract_ticket(ticket: Ticket):

    validation_error = None

    for attempt in range(2):

        try:

            response_text = gemini_agent_for_ticket(
                ticket
            )

            record = TicketResponse.model_validate_json(
                response_text
            )

            return record, response_text

        except ValidationError as error:

            validation_error = str(error)

            print(
                f"Validation error for {ticket.id}, "
                f"attempt {attempt + 1}"
            )

            # Retry exactly once
            if attempt == 0:

                response = client.models.generate_content(

                    model="gemini-3.5-flash-lite",

                    contents=f"""
                    Extract structured information from the
                    following customer support ticket.

                    Ticket ID: {ticket.id}

                    Subject:
                    {ticket.subject}

                    Body:
                    {ticket.body}

                    Received At:
                    {ticket.received_at}

                    From Email:
                    {ticket.from_email}

                    Channel:
                    {ticket.channel}

                    Attachments:
                    {ticket.attachments}

                    Return all required fields according
                    to the provided schema.

                    Do not invent any information.
                    Use only information available in the ticket.

                    Your previous response failed validation.

                    Validation error:
                    {validation_error}

                    Correct the response and return valid JSON.
                    """,

                    config={
                        "response_mime_type":
                            "application/json",

                        "response_schema":
                            TicketResponse.model_json_schema(),
                    }
                )

                try:

                    record = TicketResponse.model_validate_json(
                        response.text
                    )

                    return record, response.text

                except ValidationError:

                    # AI failed twice.
                    # Human will handle this ticket.
                    return None, response.text

    return None, None



async def process_ticket(
    ticket: Ticket,
    job_id: int,
    semaphore: asyncio.Semaphore
):

    # Only MAX_WORKERS tickets can execute
    # this section simultaneously.
    async with semaphore:

        jobs[job_id]["items"][ticket.id] = {
            "status": "running"
        }

        # Gemini call is synchronous.
        #
        # to_thread() prevents the blocking Gemini
        # request from blocking FastAPI's event loop.
        record, raw_output = await asyncio.to_thread(
            extract_ticket,
            ticket
        )



        if record is None:

            review = HumanReview(

                ticket_id=ticket.id,

                ticket=ticket,

                raw_output=raw_output,

                reason=(
                    "AI output failed schema validation "
                    "after retry"
                )
            )

            # Store using the same schema as human_check
            failed[ticket.id] = review

            jobs[job_id]["items"][ticket.id] = {
                "status": "needs_review"
            }



        else:

            # If AI says some fields are uncertain,
            # human should review the raw ticket.
            if record.uncertain_fields:

                review = HumanReview(

                    ticket_id=ticket.id,

                    ticket=ticket,

                    raw_output=raw_output,

                    reason=(
                        "AI returned uncertain fields: "
                        + ", ".join(
                            record.uncertain_fields
                        )
                    )
                )

                human_check[ticket.id] = review

                jobs[job_id]["items"][ticket.id] = {
                    "status": "needs_review"
                }


            else:

                d = record.model_dump()

                # Keep original ticket ID
                d["id"] = ticket.id

                # No human modifications yet
                d["modified"] = []

                processed_record = ProcessedTicket(
                    **d
                )

                # Store actual processed record separately
                processed_jobs[ticket.id] = (
                    processed_record
                )

                # Store the record ID under its job
                jobs[job_id]["records"].append(
                    ticket.id
                )

                jobs[job_id]["items"][ticket.id] = {
                    "status": "done"
                }

        jobs[job_id]["completed"] += 1

async def process_job(
    ticket_list: list[Ticket],
    job_id: int
):

    # Limit concurrent AI calls
    semaphore = asyncio.Semaphore(
        MAX_WORKERS
    )

    jobs[job_id]["state"] = "running"

    tasks = []

    # Create a task for every ticket
    for ticket in ticket_list:

        task = asyncio.create_task(

            process_ticket(
                ticket,
                job_id,
                semaphore
            )

        )

        tasks.append(task)

    # Wait for all tickets to finish.
    #
    # Semaphore still makes sure that only
    # MAX_WORKERS run at the same time.
    await asyncio.gather(*tasks)

    jobs[job_id]["state"] = "done"

    print(
        "Job completed:",
        job_id
    )


@app.post(
    "/api/jobs",
    status_code=202
)
async def create_job(
    request: JobRequest,
    background_tasks: BackgroundTasks
):

    global j_id

    ticket_list = []

    for ticket_id in request.tickets:

        if ticket_id not in ticket_dict:
            continue

        ticket_list.append(
            ticket_dict[ticket_id]
        )

    job_id = j_id

    jobs[job_id] = {

        "state": "queued",

        "total": len(ticket_list),

        "completed": 0,

        "items": {},

        "records": []
    }

    j_id += 1

    background_tasks.add_task(
        process_job,
        ticket_list,
        job_id
    )

    return {
        "job_id": job_id
    }


@app.get("/api/jobs/{job_id}")
async def get_job(job_id: int):

    if job_id not in jobs:

        return {
            "error": "Job not found"
        }

    return jobs[job_id]


@app.get("/api/jobs/{job_id}/results")
async def get_results(job_id: int):

    if job_id not in jobs:

        return {
            "error": "Job not found"
        }

    results = []

    # Get record IDs belonging to this job
    for record_id in jobs[job_id]["records"]:

        record = processed_jobs.get(
            record_id
        )

        if record:

            results.append(
                record.model_dump(
                    mode="json"
                )
            )

    return {
        "results": results
    }


@app.get("/api/jobs/{job_id}/export.csv")
async def get_export_csv(job_id: int):

    if job_id not in jobs:

        return {
            "error": "Job not found"
        }

    records = []

    for record_id in jobs[job_id]["records"]:

        record = processed_jobs.get(
            record_id
        )

        if record:

            records.append(
                record.model_dump(
                    mode="json"
                )
            )

    if not records:

        return {
            "error": "No records found for this job"
        }

    df = pd.DataFrame(records)

    file_name = f"{job_id}_export.csv"

    df.to_csv(
        file_name,
        index=False
    )

    return FileResponse(
        file_name,
        media_type="text/csv",
        filename=f"job_{job_id}.csv"
    )

@app.get("/api/records/{id}")
async def get_record(id: str):

    if id in processed_jobs:

        return processed_jobs[id].model_dump(
            mode="json"
        )

    if id in human_check:

        return human_check[id].model_dump(
            mode="json"
        )

    if id in failed:

        return failed[id].model_dump(
            mode="json"
        )

    return {
        "error": "Record not found"
    }