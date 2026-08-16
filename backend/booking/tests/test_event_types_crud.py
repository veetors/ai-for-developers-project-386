"""Owner CRUD on EventTypes + the duration==30 invariant."""

from __future__ import annotations


def test_create_list_get(client, make_event_type):
    created = make_event_type(name="Demo", description="Demo desc")
    assert created["id"] >= 1
    assert created["name"] == "Demo"
    assert created["duration_minutes"] == 30

    listing = client.get("/api/owner/event-types").json()
    assert any(et["id"] == created["id"] for et in listing)

    fetched = client.get(f"/api/owner/event-types/{created['id']}").json()
    assert fetched["id"] == created["id"]
    assert fetched["name"] == "Demo"


def test_update_event_type(client, make_event_type):
    created = make_event_type(name="Old", description="d")
    response = client.put(
        f"/api/owner/event-types/{created['id']}",
        json={"name": "New", "description": "new d", "duration_minutes": 30},
    )
    assert response.status_code == 200
    updated = response.json()
    assert updated["id"] == created["id"]
    assert updated["name"] == "New"
    assert updated["duration_minutes"] == 30


def test_delete_event_type_removes_it(client, make_event_type):
    created = make_event_type(name="Bye")
    response = client.delete(f"/api/owner/event-types/{created['id']}")
    assert response.status_code == 204
    response = client.get(f"/api/owner/event-types/{created['id']}")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "event_type_not_found"


def test_invalid_duration_rejected(client, make_event_type):
    _ = make_event_type  # ensure fixtures are initialised
    response = client.post(
        "/api/owner/event-types",
        json={"name": "Wrong", "description": "d", "duration_minutes": 15},
    )
    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "invalid_duration"
    payload = client.post(
        "/api/owner/event-types",
        json={"name": "Wrong", "description": "d", "duration_minutes": 60},
    )
    assert payload.status_code == 422
    assert payload.json()["error"]["code"] == "invalid_duration"


def test_public_lists_event_types(client, make_event_type):
    et = make_event_type(name="Public demo")
    response = client.get("/api/event-types").json()
    assert any(x["id"] == et["id"] for x in response)

    single = client.get(f"/api/event-types/{et['id']}").json()
    assert single["id"] == et["id"]

    missing = client.get("/api/event-types/9999")
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "event_type_not_found"


def test_public_get_after_owner_delete_returns_404(client, make_event_type):
    et = make_event_type(name="Soon deleted")
    assert client.get(f"/api/event-types/{et['id']}").status_code == 200
    client.delete(f"/api/owner/event-types/{et['id']}")
    missing = client.get(f"/api/event-types/{et['id']}")
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "event_type_not_found"
