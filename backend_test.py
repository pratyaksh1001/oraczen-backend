import json
from fastapi.testclient import TestClient
import main

client=TestClient(main.app)

def valid_output():
    return {
        "company":"Test Company",
        "product":"Zen Studio",
        "category":"bug",
        "severity":"high",
        "requested_action":"fix",
        "refund_amount":None,
        "deadline":None,
        "escalated":False,
        "uncertain_fields":[]
    }

class FakeResponse:
    def __init__(self,data):
        self.text=json.dumps(data)

def reset_state():
    main.jobs.clear()
    main.processed_jobs.clear()
    main.human_check.clear()
    main.failed.clear()

def get_ticket_ids(count):
    return list(main.ticket_dict.keys())[:count]

def test_malformed_output_retries(monkeypatch):
    reset_state()

    calls=[]

    responses=[
        FakeResponse({"company":"Test Company"}),
        FakeResponse(valid_output())
    ]

    def fake_generate_content(*args,**kwargs):
        calls.append(1)
        return responses.pop(0)

    monkeypatch.setattr(
        main.client.models,
        "generate_content",
        fake_generate_content
    )

    ticket_id=get_ticket_ids(1)[0]

    response=client.post(
        "/api/jobs",
        json={"tickets":[ticket_id]}
    )

    assert response.status_code==202

    job_id=response.json()["job_id"]

    job_response=client.get(
        f"/api/jobs/{job_id}"
    )

    assert job_response.status_code==200
    assert len(calls)==2
    assert job_response.json()["state"]=="done"
    assert job_response.json()["completed"]==1
    assert job_response.json()["records"]==[ticket_id]

def test_failed_twice_goes_to_needs_review_and_job_completes(monkeypatch):
    reset_state()

    calls=[]

    responses=[
        FakeResponse({"company":"Test Company"}),
        FakeResponse({"company":"Still Invalid"})
    ]

    def fake_generate_content(*args,**kwargs):
        calls.append(1)
        return responses.pop(0)

    monkeypatch.setattr(
        main.client.models,
        "generate_content",
        fake_generate_content
    )

    ticket_id=get_ticket_ids(1)[0]

    response=client.post(
        "/api/jobs",
        json={"tickets":[ticket_id]}
    )

    assert response.status_code==202

    job_id=response.json()["job_id"]

    job_response=client.get(
        f"/api/jobs/{job_id}"
    )

    assert job_response.status_code==200

    job=job_response.json()

    assert len(calls)==2
    assert job["completed"]==1
    assert job["total"]==1
    assert job["completed"]==job["total"]
    assert job["state"]=="done"
    assert job["items"][ticket_id]["status"]=="needs_review"
    assert ticket_id in main.failed
    assert main.failed[ticket_id].status=="needs_review"

def test_progress_and_job_done(monkeypatch):
    reset_state()

    def fake_generate_content(*args,**kwargs):
        return FakeResponse(valid_output())

    monkeypatch.setattr(
        main.client.models,
        "generate_content",
        fake_generate_content
    )

    ticket_ids=get_ticket_ids(3)

    response=client.post(
        "/api/jobs",
        json={"tickets":ticket_ids}
    )

    assert response.status_code==202

    job_id=response.json()["job_id"]

    job_response=client.get(
        f"/api/jobs/{job_id}"
    )

    assert job_response.status_code==200

    job=job_response.json()

    assert job["total"]==3
    assert job["completed"]==3
    assert job["completed"]<=job["total"]
    assert job["completed"]==job["total"]
    assert job["state"]=="done"

    for ticket_id in ticket_ids:
        assert job["items"][ticket_id]["status"]=="done"