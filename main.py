from datetime import date
from fastapi import FastAPI, BackgroundTasks,Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import ValidationError
from google import genai
import dotenv
import os
import json
import pandas as pd
import asyncio
import tempfile
from models import *

dotenv.load_dotenv()

app = FastAPI()

client = genai.Client(
    api_key=os.getenv("GEMINI_API_KEY")
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000","http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)
MAX_WORKERS = int(os.getenv("MAX_WORKERS"))

ticket_dict = {}
processed_jobs = {}
jobs = {}
human_check = {}
failed = {}
j_id = 0

def json_to_ticket_dict():
    with open("data/tickets.jsonl", "r", encoding="utf-8") as f:
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
            "response_schema": TicketResponse.model_json_schema()
        }
    )
    return json.loads(response.text)

def extract_ticket(ticket: Ticket):
    for attempt in range(2):
        try:
            response_data = gemini_agent_for_ticket(ticket)
            record = TicketResponse.model_validate(response_data)
            return record, response_data

        except (ValidationError, json.JSONDecodeError) as error:
            validation_error = str(error)

            print(
                f"Validation error for {ticket.id}, "
                f"attempt {attempt + 1}"
            )

            if attempt == 0:
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
                        "response_mime_type": "application/json",
                        "response_schema": TicketResponse.model_json_schema()
                    }
                )

                try:
                    response_data = json.loads(response.text)
                    record = TicketResponse.model_validate(response_data)
                    return record, response_data

                except (ValidationError, json.JSONDecodeError):
                    return None, json.loads(response.text)

    return None, None

async def process_ticket(
    ticket: Ticket,
    job_id: int,
    semaphore: asyncio.Semaphore
):
    async with semaphore:
        jobs[job_id]["items"][ticket.id] = {
            "status": "running"
        }

        record, ai_output = await asyncio.to_thread(
            extract_ticket,
            ticket
        )

        if record is None:
            review = HumanReview(
                ticket_id=ticket.id,
                ticket=ticket,
                ai_output=ai_output,
                reason="AI output failed schema validation after retry"
            )

            failed[ticket.id] = review

            jobs[job_id]["items"][ticket.id] = {
                "status": "needs_review"
            }

        else:
            if record.uncertain_fields:
                review = HumanReview(
                    ticket_id=ticket.id,
                    ticket=ticket,
                    ai_output=ai_output,
                    reason=(
                        "AI returned uncertain fields: "
                        + ", ".join(record.uncertain_fields)
                    )
                )

                human_check[ticket.id] = review

                jobs[job_id]["items"][ticket.id] = {
                    "status": "needs_review"
                }

            else:
                d = record.model_dump()
                d["id"] = ticket.id
                d["modified"] = []

                processed_record = ProcessedTicket(**d)

                processed_jobs[ticket.id] = processed_record

                jobs[job_id]["records"].append(ticket.id)

                jobs[job_id]["items"][ticket.id] = {
                    "status": "done"
                }

        jobs[job_id]["completed"] += 1

async def process_job(ticket_list: list[Ticket], job_id: int):
    semaphore = asyncio.Semaphore(MAX_WORKERS)

    jobs[job_id]["state"] = "running"

    tasks = []

    for ticket in ticket_list:
        task = asyncio.create_task(
            process_ticket(
                ticket,
                job_id,
                semaphore
            )
        )
        tasks.append(task)

    await asyncio.gather(*tasks)

    jobs[job_id]["state"] = "done"

    print("Job completed:", job_id)


@app.get("/tickets")
async def get_tickets():
    return {"tickets":ticket_dict}

@app.post("/api/jobs", status_code=202)
async def create_job(
    request: JobRequest,
    background_tasks: BackgroundTasks
):
    global j_id

    ticket_list = []

    for ticket_id in request.tickets:
        if ticket_id not in ticket_dict:
            continue

        ticket_list.append(ticket_dict[ticket_id])

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

    return {"job_id": job_id}

@app.get("/api/jobs")
async def get_jobs():
    return {"jobs": jobs}

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

    for record_id in jobs[job_id]["records"]:
        record = processed_jobs.get(record_id)

        if record:
            results.append(
                record.model_dump(mode="json")
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
        record = processed_jobs.get(record_id)

        if record:
            records.append(
                record.model_dump(mode="json")
            )

    if not records:
        return {
            "error": "No records found for this job"
        }

    df = pd.DataFrame(records)

    file_name = f"{job_id}_export.csv"
    with tempfile.NamedTemporaryFile(mode="w+",delete=True) as tmp:
        df.to_csv(tmp.name, index=False)
        return FileResponse(
            tmp.name,
            media_type="text/csv",
            filename=f"job_{job_id}.csv"
        )

@app.get("/api/records/read/{id}")
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

@app.get("/api/records")
async def get_records():
    return {
        "successful": processed_jobs,
        "failed": failed,
        "human_check": human_check
    }

@app.patch("/api/records/{id}")
async def update_record(id:str,request:Request):
    data=await request.json()
    modified_records=data["records"]

    if id in processed_jobs:
        record=processed_jobs[id]
        record_data=record.model_dump()
        modified=record.modified.copy()

        for field,value in modified_records.items():
            if field in record_data:
                record_data[field]=value
                if field not in modified:
                    modified.append(field)

        record_data["modified"]=modified
        updated_record=ProcessedTicket(**record_data)
        processed_jobs[id]=updated_record

        return updated_record.model_dump(mode="json")

    if id in human_check:
        review=human_check[id]
        record_data=review.ai_output.copy()

        for field,value in modified_records.items():
            record_data[field]=value

        record_data["id"]=id
        record_data["modified"]=list(modified_records.keys())

        updated_record=ProcessedTicket(**record_data)
        processed_jobs[id]=updated_record

        del human_check[id]

        return updated_record.model_dump(mode="json")

    if id in failed:
        review=failed[id]
        record_data=review.ai_output.copy()

        for field,value in modified_records.items():
            record_data[field]=value

        record_data["id"]=id
        record_data["modified"]=list(modified_records.keys())

        updated_record=ProcessedTicket(**record_data)
        processed_jobs[id]=updated_record

        del failed[id]
        return updated_record.model_dump(mode="json")
    return {"error":"Record not found"}
