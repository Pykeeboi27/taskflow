"""Route test: GET / health check."""

import pytest


@pytest.mark.routes
async def test_health_check_returns_200_with_expected_body(client):
    response = await client.get("/")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "taskflow-api"
