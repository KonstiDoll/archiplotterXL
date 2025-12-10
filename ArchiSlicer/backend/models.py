from sqlalchemy import Column, String, Float, Integer, JSON
from database import Base


class PenType(Base):
    """
    Pen type configuration for the plotter.

    Attributes:
        id: Unique identifier (e.g., "stabilo", "posca")
        display_name: Human-readable name (e.g., "Stabilo Point 88")
        pen_up: Z height when pen is lifted (mm)
        pen_down: Z height when pen is drawing (mm)
        pump_distance_threshold: Drawing distance after which to pump (mm), 0 = disabled
        pump_height: Z height to move to for pump action (mm)
    """
    __tablename__ = "pen_types"

    id = Column(String, primary_key=True, index=True)
    display_name = Column(String, nullable=False)
    pen_up = Column(Float, nullable=False)
    pen_down = Column(Float, nullable=False)
    pump_distance_threshold = Column(Float, nullable=False, default=0)
    pump_height = Column(Float, nullable=False, default=50)


class ToolPreset(Base):
    """
    Saved tool configuration preset (all 9 tools).

    Attributes:
        id: Auto-increment primary key
        name: Human-readable preset name (e.g., "Posca Regenbogen", "Fineliner SW")
        tool_configs: JSON array of 9 tool configurations, each with penType and color
    """
    __tablename__ = "tool_presets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False, unique=True)
    # JSON array: [{"penType": "stabilo", "color": "#000000"}, ...]
    tool_configs = Column(JSON, nullable=False)
