"""Tests for pen types API endpoints."""
import pytest


class TestPenTypesAPI:
    """Test pen types CRUD operations."""

    def test_list_pen_types_empty(self, client):
        """Test listing pen types when database is empty."""
        response = client.get("/api/pen-types/")
        assert response.status_code == 200
        assert response.json() == []

    def test_create_pen_type(self, client):
        """Test creating a new pen type."""
        pen_type_data = {
            "id": "test_pen",
            "display_name": "Test Pen",
            "pen_up": 35.0,
            "pen_down": 15.0,
            "pump_distance_threshold": 1000.0,
            "pump_height": 50.0,
        }

        response = client.post("/api/pen-types/", json=pen_type_data)
        assert response.status_code == 201

        data = response.json()
        assert data["id"] == "test_pen"
        assert data["display_name"] == "Test Pen"
        assert data["pen_up"] == 35.0
        assert data["pen_down"] == 15.0
        assert data["pump_distance_threshold"] == 1000.0
        assert data["pump_height"] == 50.0

    def test_create_pen_type_defaults(self, client):
        """Test creating a pen type with default pump values."""
        pen_type_data = {
            "id": "minimal_pen",
            "display_name": "Minimal Pen",
            "pen_up": 30.0,
            "pen_down": 10.0,
        }

        response = client.post("/api/pen-types/", json=pen_type_data)
        assert response.status_code == 201

        data = response.json()
        assert data["pump_distance_threshold"] == 0  # Default: disabled
        assert data["pump_height"] == 50  # Default height

    def test_create_duplicate_pen_type(self, client):
        """Test creating a pen type with duplicate ID fails."""
        pen_type_data = {
            "id": "duplicate_pen",
            "display_name": "First Pen",
            "pen_up": 30.0,
            "pen_down": 10.0,
        }

        response = client.post("/api/pen-types/", json=pen_type_data)
        assert response.status_code == 201

        # Try to create again with same ID
        pen_type_data["display_name"] = "Second Pen"
        response = client.post("/api/pen-types/", json=pen_type_data)
        assert response.status_code == 400
        assert "already exists" in response.json()["detail"]

    def test_get_pen_type(self, client):
        """Test getting a single pen type by ID."""
        # Create first
        pen_type_data = {
            "id": "get_test",
            "display_name": "Get Test",
            "pen_up": 33.0,
            "pen_down": 13.0,
        }
        client.post("/api/pen-types/", json=pen_type_data)

        # Get it
        response = client.get("/api/pen-types/get_test")
        assert response.status_code == 200
        assert response.json()["id"] == "get_test"
        assert response.json()["display_name"] == "Get Test"

    def test_get_pen_type_not_found(self, client):
        """Test getting a non-existent pen type returns 404."""
        response = client.get("/api/pen-types/nonexistent")
        assert response.status_code == 404

    def test_update_pen_type(self, client):
        """Test updating a pen type."""
        # Create first
        pen_type_data = {
            "id": "update_test",
            "display_name": "Original Name",
            "pen_up": 30.0,
            "pen_down": 10.0,
        }
        client.post("/api/pen-types/", json=pen_type_data)

        # Update it
        update_data = {
            "display_name": "Updated Name",
            "pen_up": 35.0,
            "pump_distance_threshold": 500.0,
        }
        response = client.put("/api/pen-types/update_test", json=update_data)
        assert response.status_code == 200

        data = response.json()
        assert data["display_name"] == "Updated Name"
        assert data["pen_up"] == 35.0
        assert data["pen_down"] == 10.0  # Unchanged
        assert data["pump_distance_threshold"] == 500.0

    def test_update_pen_type_not_found(self, client):
        """Test updating a non-existent pen type returns 404."""
        response = client.put("/api/pen-types/nonexistent", json={"display_name": "Test"})
        assert response.status_code == 404

    def test_delete_pen_type(self, client):
        """Test deleting a pen type."""
        # Create first
        pen_type_data = {
            "id": "delete_test",
            "display_name": "To Delete",
            "pen_up": 30.0,
            "pen_down": 10.0,
        }
        client.post("/api/pen-types/", json=pen_type_data)

        # Delete it
        response = client.delete("/api/pen-types/delete_test")
        assert response.status_code == 204

        # Verify it's gone
        response = client.get("/api/pen-types/delete_test")
        assert response.status_code == 404

    def test_delete_pen_type_not_found(self, client):
        """Test deleting a non-existent pen type returns 404."""
        response = client.delete("/api/pen-types/nonexistent")
        assert response.status_code == 404

    def test_list_multiple_pen_types(self, client):
        """Test listing multiple pen types."""
        # Create several pen types
        for i in range(3):
            pen_type_data = {
                "id": f"pen_{i}",
                "display_name": f"Pen {i}",
                "pen_up": 30.0 + i,
                "pen_down": 10.0 + i,
            }
            client.post("/api/pen-types/", json=pen_type_data)

        response = client.get("/api/pen-types/")
        assert response.status_code == 200
        assert len(response.json()) == 3

    def test_pump_settings_validation(self, client):
        """Test that pump settings are properly stored and retrieved."""
        pen_type_data = {
            "id": "pump_test",
            "display_name": "Pump Test Pen",
            "pen_up": 33.0,
            "pen_down": 13.0,
            "pump_distance_threshold": 1500.0,
            "pump_height": 75.0,
        }

        response = client.post("/api/pen-types/", json=pen_type_data)
        assert response.status_code == 201

        # Verify the pump settings
        data = response.json()
        assert data["pump_distance_threshold"] == 1500.0
        assert data["pump_height"] == 75.0

        # Update just the pump threshold
        response = client.put("/api/pen-types/pump_test", json={"pump_distance_threshold": 2000.0})
        assert response.status_code == 200
        assert response.json()["pump_distance_threshold"] == 2000.0
        assert response.json()["pump_height"] == 75.0  # Unchanged
