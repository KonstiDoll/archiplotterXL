"""Seed script to populate default pen types."""
from database import SessionLocal
from models import PenType

DEFAULT_PEN_TYPES = [
    {
        "id": "stabilo",
        "display_name": "Stabilo Point 88",
        "pen_up": 33,
        "pen_down": 13,
        "pump_distance_threshold": 0,
        "pump_height": 50,
    },
    {
        "id": "posca",
        "display_name": "POSCA Marker",
        "pen_up": 33,
        "pen_down": 13,
        "pump_distance_threshold": 0,
        "pump_height": 50,
    },
    {
        "id": "fineliner",
        "display_name": "Fineliner",
        "pen_up": 35,
        "pen_down": 15,
        "pump_distance_threshold": 0,
        "pump_height": 50,
    },
    {
        "id": "brushpen",
        "display_name": "Brushpen",
        "pen_up": 33,
        "pen_down": 8,
        "pump_distance_threshold": 0,
        "pump_height": 50,
    },
    {
        "id": "marker",
        "display_name": "Marker (dick)",
        "pen_up": 36,
        "pen_down": 11,
        "pump_distance_threshold": 0,
        "pump_height": 50,
    },
]


def seed_pen_types():
    """Insert default pen types if they don't exist."""
    db = SessionLocal()
    try:
        for pen_type_data in DEFAULT_PEN_TYPES:
            existing = db.query(PenType).filter(PenType.id == pen_type_data["id"]).first()
            if existing:
                print(f"Pen type '{pen_type_data['id']}' already exists, skipping.")
                continue

            pen_type = PenType(**pen_type_data)
            db.add(pen_type)
            print(f"Created pen type: {pen_type_data['id']}")

        db.commit()
        print("Seed complete!")
    finally:
        db.close()


if __name__ == "__main__":
    seed_pen_types()
