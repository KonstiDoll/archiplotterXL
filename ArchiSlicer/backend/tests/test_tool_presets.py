"""Tests for tool presets API endpoints."""

import pytest


class TestToolPresetsAPI:
    """Test tool presets CRUD operations."""

    @pytest.fixture
    def sample_tool_configs(self):
        """Sample tool configurations for testing."""
        return [
            {"penType": "stabilo", "color": "#FF0000"},
            {"penType": "stabilo", "color": "#00FF00"},
            {"penType": "stabilo", "color": "#0000FF"},
            {"penType": "posca", "color": "#FFFF00"},
            {"penType": "posca", "color": "#FF00FF"},
            {"penType": "posca", "color": "#00FFFF"},
            {"penType": "fineliner", "color": "#000000"},
            {"penType": "fineliner", "color": "#FFFFFF"},
            {"penType": "marker", "color": "#808080"},
        ]

    def test_list_presets_empty(self, client):
        """Test listing presets when database is empty."""
        response = client.get("/api/tool-presets/")
        assert response.status_code == 200
        assert response.json() == []

    def test_create_preset(self, client, sample_tool_configs):
        """Test creating a new tool preset."""
        preset_data = {
            "name": "Test Preset",
            "tool_configs": sample_tool_configs,
        }

        response = client.post("/api/tool-presets/", json=preset_data)
        assert response.status_code == 201

        data = response.json()
        assert data["name"] == "Test Preset"
        assert data["id"] is not None
        assert len(data["tool_configs"]) == 9
        assert data["tool_configs"][0]["penType"] == "stabilo"
        assert data["tool_configs"][0]["color"] == "#FF0000"

    def test_create_preset_minimal(self, client):
        """Test creating a preset with minimal tools."""
        preset_data = {
            "name": "Minimal Preset",
            "tool_configs": [
                {"penType": "stabilo", "color": "#000000"},
            ],
        }

        response = client.post("/api/tool-presets/", json=preset_data)
        assert response.status_code == 201
        assert len(response.json()["tool_configs"]) == 1

    def test_create_duplicate_preset_name(self, client, sample_tool_configs):
        """Test creating a preset with duplicate name fails."""
        preset_data = {
            "name": "Duplicate Name",
            "tool_configs": sample_tool_configs,
        }

        response = client.post("/api/tool-presets/", json=preset_data)
        assert response.status_code == 201

        # Try to create again with same name
        response = client.post("/api/tool-presets/", json=preset_data)
        assert response.status_code == 400
        assert "already exists" in response.json()["detail"]

    def test_get_preset(self, client, sample_tool_configs):
        """Test getting a single preset by ID."""
        # Create first
        preset_data = {
            "name": "Get Test",
            "tool_configs": sample_tool_configs,
        }
        create_response = client.post("/api/tool-presets/", json=preset_data)
        preset_id = create_response.json()["id"]

        # Get it
        response = client.get(f"/api/tool-presets/{preset_id}")
        assert response.status_code == 200
        assert response.json()["name"] == "Get Test"
        assert response.json()["id"] == preset_id

    def test_get_preset_not_found(self, client):
        """Test getting a non-existent preset returns 404."""
        response = client.get("/api/tool-presets/99999")
        assert response.status_code == 404

    def test_update_preset_name(self, client, sample_tool_configs):
        """Test updating a preset name."""
        # Create first
        preset_data = {
            "name": "Original Name",
            "tool_configs": sample_tool_configs,
        }
        create_response = client.post("/api/tool-presets/", json=preset_data)
        preset_id = create_response.json()["id"]

        # Update name only
        response = client.put(f"/api/tool-presets/{preset_id}", json={"name": "Updated Name"})
        assert response.status_code == 200
        assert response.json()["name"] == "Updated Name"
        # Tool configs should remain unchanged
        assert len(response.json()["tool_configs"]) == 9

    def test_update_preset_configs(self, client, sample_tool_configs):
        """Test updating preset tool configs."""
        # Create first
        preset_data = {
            "name": "Config Update Test",
            "tool_configs": sample_tool_configs,
        }
        create_response = client.post("/api/tool-presets/", json=preset_data)
        preset_id = create_response.json()["id"]

        # Update configs
        new_configs = [
            {"penType": "brushpen", "color": "#123456"},
            {"penType": "brushpen", "color": "#654321"},
        ]
        response = client.put(f"/api/tool-presets/{preset_id}", json={"tool_configs": new_configs})
        assert response.status_code == 200
        assert len(response.json()["tool_configs"]) == 2
        assert response.json()["tool_configs"][0]["penType"] == "brushpen"

    def test_update_preset_name_conflict(self, client, sample_tool_configs):
        """Test updating preset to a name that already exists fails."""
        # Create two presets
        client.post(
            "/api/tool-presets/", json={"name": "First", "tool_configs": sample_tool_configs}
        )
        create_response = client.post(
            "/api/tool-presets/", json={"name": "Second", "tool_configs": sample_tool_configs}
        )
        second_id = create_response.json()["id"]

        # Try to rename second to first
        response = client.put(f"/api/tool-presets/{second_id}", json={"name": "First"})
        assert response.status_code == 400
        assert "already exists" in response.json()["detail"]

    def test_update_preset_not_found(self, client):
        """Test updating a non-existent preset returns 404."""
        response = client.put("/api/tool-presets/99999", json={"name": "Test"})
        assert response.status_code == 404

    def test_delete_preset(self, client, sample_tool_configs):
        """Test deleting a preset."""
        # Create first
        preset_data = {
            "name": "To Delete",
            "tool_configs": sample_tool_configs,
        }
        create_response = client.post("/api/tool-presets/", json=preset_data)
        preset_id = create_response.json()["id"]

        # Delete it
        response = client.delete(f"/api/tool-presets/{preset_id}")
        assert response.status_code == 204

        # Verify it's gone
        response = client.get(f"/api/tool-presets/{preset_id}")
        assert response.status_code == 404

    def test_delete_preset_not_found(self, client):
        """Test deleting a non-existent preset returns 404."""
        response = client.delete("/api/tool-presets/99999")
        assert response.status_code == 404

    def test_list_multiple_presets(self, client, sample_tool_configs):
        """Test listing multiple presets."""
        # Create several presets
        for i in range(3):
            preset_data = {
                "name": f"Preset {i}",
                "tool_configs": sample_tool_configs,
            }
            client.post("/api/tool-presets/", json=preset_data)

        response = client.get("/api/tool-presets/")
        assert response.status_code == 200
        assert len(response.json()) == 3

    def test_preset_tool_config_structure(self, client):
        """Test that tool configs maintain correct structure."""
        configs = [
            {"penType": "stabilo", "color": "#FF0000"},
            {"penType": "posca", "color": "#00FF00"},
        ]
        preset_data = {
            "name": "Structure Test",
            "tool_configs": configs,
        }

        response = client.post("/api/tool-presets/", json=preset_data)
        assert response.status_code == 201

        data = response.json()
        for i, config in enumerate(data["tool_configs"]):
            assert "penType" in config
            assert "color" in config
            assert config["penType"] == configs[i]["penType"]
            assert config["color"] == configs[i]["color"]


class TestHealthEndpoint:
    """Test health check endpoint."""

    def test_health_check(self, client):
        """Test the root health check endpoint."""
        response = client.get("/")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"
        assert response.json()["service"] == "ArchiSlicer API"
