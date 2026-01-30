"""API endpoints for infill generation and path optimization."""

import time
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from services.centerline import CenterlineService, get_centerline_service
from services.geometry import calculate_line_length
from services.infill import InfillService, get_infill_service
from services.optimization import PathOptimizerService, get_path_optimizer_service

router = APIRouter(prefix="/api/infill", tags=["infill"])


# --- Pydantic Models ---


class Point2D(BaseModel):
    """2D point coordinate."""

    x: float
    y: float


class PolygonWithHoles(BaseModel):
    """Polygon with outer boundary and optional holes."""

    outer: list[Point2D] = Field(..., min_length=3)
    holes: list[list[Point2D]] = Field(default_factory=list)


class LineSegment(BaseModel):
    """Line segment with start and end points."""

    start: Point2D
    end: Point2D


class Polyline(BaseModel):
    """Continuous path (sequence of connected points)."""

    points: list[Point2D] = Field(..., min_length=2)


class InfillRequest(BaseModel):
    """Request to generate infill pattern."""

    polygons: list[PolygonWithHoles] = Field(..., min_length=1)
    pattern: Literal["lines", "grid", "concentric", "crosshatch", "zigzag"] = "lines"
    density: float = Field(default=2.0, gt=0, le=100, description="Spacing between lines in mm")
    angle: float = Field(default=45.0, ge=0, le=360, description="Angle in degrees")
    outline_offset: float = Field(
        default=0.0, ge=0, le=50, description="Inward offset from edge in mm"
    )
    optimize_path: bool = Field(default=False, description="Apply TSP path optimization")
    timeout_seconds: int = Field(
        default=300, gt=0, le=600, description="TSP optimization timeout in seconds"
    )


class InfillMetadata(BaseModel):
    """Metadata about generated infill."""

    total_length_mm: float
    num_segments: int
    num_polylines: int = 0
    pattern_type: str
    optimization_applied: bool = False
    travel_length_mm: float | None = None
    num_pen_lifts: int | None = None


class InfillResponse(BaseModel):
    """Response containing generated infill lines and polylines."""

    lines: list[LineSegment]
    polylines: list[Polyline] = Field(default_factory=list)
    metadata: InfillMetadata


class PathOptimizationRequest(BaseModel):
    """Request to optimize path order."""

    lines: list[LineSegment]
    start_point: Point2D | None = None
    timeout_seconds: int = Field(
        default=300, gt=0, le=600, description="Optimization timeout in seconds"
    )


class PolylineOptimizationRequest(BaseModel):
    """Request to optimize polyline path order."""

    polylines: list[Polyline]
    start_point: Point2D | None = None
    timeout_seconds: int = Field(
        default=300, gt=0, le=600, description="Optimization timeout in seconds"
    )


class PathOptimizationResponse(BaseModel):
    """Response with optimized path."""

    ordered_lines: list[LineSegment]
    total_drawing_length_mm: float
    total_travel_length_mm: float
    num_pen_lifts: int
    optimization_method: str = "greedy"


class PolylineOptimizationResponse(BaseModel):
    """Response with optimized polyline path."""

    ordered_polylines: list[Polyline]
    total_drawing_length_mm: float
    total_travel_length_mm: float
    num_pen_lifts: int
    optimization_method: str = "greedy"


class CenterlineRequest(BaseModel):
    """Request to extract centerlines from polygons."""

    polygons: list[PolygonWithHoles] = Field(..., min_length=1)
    resolution: float = Field(
        default=0.02, gt=0, le=1.0, description="mm per pixel (lower = higher quality)"
    )
    min_length: float = Field(default=1.0, ge=0, description="Minimum centerline length in mm")
    simplify_tolerance: float = Field(
        default=0.02, ge=0, description="Douglas-Peucker simplification tolerance in mm"
    )
    merge_tolerance: float = Field(
        default=0.2, ge=0, le=2.0, description="Tolerance for merging nearby line endpoints in mm"
    )
    loop_threshold: float = Field(
        default=5.0, ge=0, le=20.0, description="Max gap to close as loop in mm"
    )
    chaikin_iterations: int = Field(
        default=2, ge=0, le=10, description="Number of Chaikin smoothing passes"
    )
    min_angle: float = Field(
        default=120.0, ge=0, le=180.0, description="Angles below this are smoothed (degrees)"
    )
    max_extend: float = Field(
        default=3.0, ge=0, le=20.0, description="Maximum endpoint extension distance in mm"
    )
    method: str = Field(
        default="skeleton", description="Extraction method: 'skeleton', 'voronoi' or 'offset'"
    )
    spoke_filter: float = Field(
        default=0,
        ge=0,
        le=10.0,
        description="Filter corner spokes shorter than this (mm), 0 = disabled",
    )


class CenterlineStats(BaseModel):
    """Statistics about extracted centerlines."""

    num_polygons: int
    num_polylines: int
    total_length_mm: float
    processing_time_ms: float
    resolution: float
    min_length: float


class CenterlineResponse(BaseModel):
    """Response containing extracted centerlines."""

    centerlines: list[list[Polyline]]  # Per polygon: list of polylines
    stats: CenterlineStats


# --- API Endpoints ---


@router.post("/generate", response_model=InfillResponse)
async def generate_infill(
    request: InfillRequest,
    infill_service: InfillService = Depends(get_infill_service),
    optimizer_service: PathOptimizerService = Depends(get_path_optimizer_service),
):
    """
    Generate infill pattern for the given polygons.

    Supports multiple pattern types:
    - **lines**: Parallel lines at specified angle
    - **grid**: Perpendicular line sets (like lines but at 90 degrees too)
    - **concentric**: Concentric rings from polygon boundary
    - **crosshatch**: Diagonal crossing lines

    The optional `optimize_path` flag will reorder the generated lines
    to minimize pen lift travel distance using TSP optimization.
    """
    total_start = time.perf_counter()
    timings = {}

    try:
        # Convert Pydantic models to dicts for internal processing
        t0 = time.perf_counter()
        polygons_data = [
            {
                "outer": [{"x": p.x, "y": p.y} for p in poly.outer],
                "holes": [[{"x": p.x, "y": p.y} for p in hole] for hole in poly.holes],
            }
            for poly in request.polygons
        ]
        timings["input_conversion"] = (time.perf_counter() - t0) * 1000

        # Generate infill (returns both line segments and polylines)
        t0 = time.perf_counter()
        segments, polylines = infill_service.generate_with_polylines(
            polygons=polygons_data,
            pattern_type=request.pattern,
            density=request.density,
            angle=request.angle,
            outline_offset=request.outline_offset,
        )
        timings["pattern_generation"] = (time.perf_counter() - t0) * 1000

        if not segments and not polylines:
            timings["total"] = (time.perf_counter() - total_start) * 1000
            print(f"[INFILL TIMING] Empty result - {timings}")
            return InfillResponse(
                lines=[],
                polylines=[],
                metadata=InfillMetadata(
                    total_length_mm=0,
                    num_segments=0,
                    num_polylines=0,
                    pattern_type=request.pattern,
                    optimization_applied=False,
                ),
            )

        # Optionally optimize path
        travel_length = None
        num_pen_lifts = None
        optimization_applied = False

        if request.optimize_path:
            t0 = time.perf_counter()

            # Optimize line segments if present
            if len(segments) > 1:
                segments, opt_stats = optimizer_service.optimize_segments(
                    segments, time_limit_seconds=request.timeout_seconds
                )
                optimization_applied = opt_stats.get("optimization_applied", False)
                travel_length = opt_stats.get("total_travel_length_mm")
                num_pen_lifts = opt_stats.get("num_pen_lifts")

            # Optimize polylines if present
            if len(polylines) > 1:
                polylines, polyline_opt_stats = optimizer_service.optimize_polylines(
                    polylines, time_limit_seconds=request.timeout_seconds
                )
                optimization_applied = optimization_applied or polyline_opt_stats.get(
                    "optimization_applied", False
                )

                # Combine stats from both optimizations
                if (
                    travel_length is not None
                    and polyline_opt_stats.get("total_travel_length_mm") is not None
                ):
                    travel_length += polyline_opt_stats.get("total_travel_length_mm")
                elif polyline_opt_stats.get("total_travel_length_mm") is not None:
                    travel_length = polyline_opt_stats.get("total_travel_length_mm")

                if (
                    num_pen_lifts is not None
                    and polyline_opt_stats.get("num_pen_lifts") is not None
                ):
                    num_pen_lifts += polyline_opt_stats.get("num_pen_lifts")
                elif polyline_opt_stats.get("num_pen_lifts") is not None:
                    num_pen_lifts = polyline_opt_stats.get("num_pen_lifts")

            timings["tsp_optimization"] = (time.perf_counter() - t0) * 1000
        else:
            timings["tsp_optimization"] = 0

        # Calculate total drawing length
        t0 = time.perf_counter()
        total_length = calculate_line_length(segments)

        # Add polyline lengths
        for polyline in polylines:
            for i in range(len(polyline) - 1):
                p1, p2 = polyline[i], polyline[i + 1]
                dx = p2[0] - p1[0]
                dy = p2[1] - p1[1]
                total_length += (dx * dx + dy * dy) ** 0.5

        timings["length_calculation"] = (time.perf_counter() - t0) * 1000

        # Convert to response format
        t0 = time.perf_counter()
        response_lines = [
            LineSegment(
                start=Point2D(x=seg[0][0], y=seg[0][1]), end=Point2D(x=seg[1][0], y=seg[1][1])
            )
            for seg in segments
        ]

        response_polylines = [
            Polyline(points=[Point2D(x=pt[0], y=pt[1]) for pt in polyline])
            for polyline in polylines
        ]

        timings["response_conversion"] = (time.perf_counter() - t0) * 1000

        timings["total"] = (time.perf_counter() - total_start) * 1000

        # Print timing summary
        print(
            f"[INFILL TIMING] pattern={request.pattern} polygons={len(request.polygons)} segments={len(segments)} polylines={len(polylines)}"
        )
        print(f"  input_conversion:    {timings['input_conversion']:7.2f} ms")
        print(f"  pattern_generation:  {timings['pattern_generation']:7.2f} ms")
        print(f"  tsp_optimization:    {timings['tsp_optimization']:7.2f} ms")
        print(f"  length_calculation:  {timings['length_calculation']:7.2f} ms")
        print(f"  response_conversion: {timings['response_conversion']:7.2f} ms")
        print(f"  TOTAL:               {timings['total']:7.2f} ms")

        return InfillResponse(
            lines=response_lines,
            polylines=response_polylines,
            metadata=InfillMetadata(
                total_length_mm=round(total_length, 2),
                num_segments=len(segments),
                num_polylines=len(polylines),
                pattern_type=request.pattern,
                optimization_applied=optimization_applied,
                travel_length_mm=round(travel_length, 2) if travel_length is not None else None,
                num_pen_lifts=num_pen_lifts,
            ),
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid input: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Infill generation failed: {str(e)}")


@router.post("/optimize-path", response_model=PathOptimizationResponse)
async def optimize_path(
    request: PathOptimizationRequest,
    optimizer_service: PathOptimizerService = Depends(get_path_optimizer_service),
):
    """
    Optimize the drawing order of line segments.

    Uses TSP (Traveling Salesman Problem) optimization to minimize
    the total pen-up travel distance between segments.

    Each segment can be drawn in either direction, and the optimizer
    will choose the best direction for each segment.
    """
    try:
        if len(request.lines) == 0:
            return PathOptimizationResponse(
                ordered_lines=[],
                total_drawing_length_mm=0,
                total_travel_length_mm=0,
                num_pen_lifts=0,
            )

        # Convert to internal format and filter out degenerate segments (start == end)
        segments = []
        for line in request.lines:
            start = (line.start.x, line.start.y)
            end = (line.end.x, line.end.y)
            # Skip null segments (start == end)
            if start != end:
                segments.append((start, end))
            else:
                print(f"  [FILTER] Skipping degenerate segment: {start} == {end}")

        if len(segments) == 0:
            return PathOptimizationResponse(
                ordered_lines=[],
                total_drawing_length_mm=0,
                total_travel_length_mm=0,
                num_pen_lifts=0,
            )

        start_point = None
        if request.start_point:
            start_point = (request.start_point.x, request.start_point.y)

        # Optimize
        optimized_segments, opt_stats = optimizer_service.optimize_segments(
            segments, start_point, time_limit_seconds=request.timeout_seconds
        )

        # Convert back to response format
        response_lines = [
            LineSegment(
                start=Point2D(x=seg[0][0], y=seg[0][1]), end=Point2D(x=seg[1][0], y=seg[1][1])
            )
            for seg in optimized_segments
        ]

        return PathOptimizationResponse(
            ordered_lines=response_lines,
            total_drawing_length_mm=round(opt_stats.get("total_drawing_length_mm", 0), 2),
            total_travel_length_mm=round(opt_stats.get("total_travel_length_mm", 0), 2),
            num_pen_lifts=opt_stats.get("num_pen_lifts", 0),
            optimization_method=opt_stats.get("method", "unknown"),
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Path optimization failed: {str(e)}")


@router.post("/optimize-polylines", response_model=PolylineOptimizationResponse)
async def optimize_polylines(
    request: PolylineOptimizationRequest,
    optimizer_service: PathOptimizerService = Depends(get_path_optimizer_service),
):
    """
    Optimize the drawing order of polylines (continuous paths).

    Uses greedy nearest-neighbor optimization to minimize pen-up travel distance.
    For closed polylines (like concentric rings), rotates them to start from
    the optimal point without reversing.
    """
    try:
        if len(request.polylines) == 0:
            return PolylineOptimizationResponse(
                ordered_polylines=[],
                total_drawing_length_mm=0,
                total_travel_length_mm=0,
                num_pen_lifts=0,
                optimization_method="none",
            )

        # Convert to internal format
        polylines = [[(pt.x, pt.y) for pt in polyline.points] for polyline in request.polylines]

        start_point = None
        if request.start_point:
            start_point = (request.start_point.x, request.start_point.y)

        # Optimize
        optimized_polylines, opt_stats = optimizer_service.optimize_polylines(
            polylines, start_point, time_limit_seconds=request.timeout_seconds
        )

        # Convert back to response format
        response_polylines = [
            Polyline(points=[Point2D(x=pt[0], y=pt[1]) for pt in polyline])
            for polyline in optimized_polylines
        ]

        return PolylineOptimizationResponse(
            ordered_polylines=response_polylines,
            total_drawing_length_mm=round(opt_stats.get("total_drawing_length_mm", 0), 2),
            total_travel_length_mm=round(opt_stats.get("total_travel_length_mm", 0), 2),
            num_pen_lifts=opt_stats.get("num_pen_lifts", 0),
            optimization_method=opt_stats.get("method", "unknown"),
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Polyline optimization failed: {str(e)}")


@router.get("/patterns")
async def list_patterns():
    """
    List available infill patterns with their descriptions.
    """
    return {
        "patterns": [
            {
                "id": "lines",
                "name": "Lines",
                "description": "Parallel lines at specified angle",
                "recommended_density_range": [1.0, 10.0],
            },
            {
                "id": "grid",
                "name": "Grid",
                "description": "Perpendicular line sets forming a grid pattern",
                "recommended_density_range": [2.0, 15.0],
            },
            {
                "id": "concentric",
                "name": "Concentric",
                "description": "Concentric rings from the polygon boundary",
                "recommended_density_range": [1.0, 5.0],
            },
            {
                "id": "crosshatch",
                "name": "Crosshatch",
                "description": "Diagonal crossing lines at +/- 45 degrees",
                "recommended_density_range": [2.0, 15.0],
            },
            {
                "id": "zigzag",
                "name": "Zigzag",
                "description": "Continuous zigzag lines with minimal pen lifts",
                "recommended_density_range": [1.0, 10.0],
            },
        ]
    }


@router.post("/centerline", response_model=CenterlineResponse)
async def extract_centerline(
    request: CenterlineRequest,
    centerline_service: CenterlineService = Depends(get_centerline_service),
):
    """
    Extract centerlines (medial axes) from closed polygons.

    Uses morphological thinning (Zhang-Suen algorithm) to extract
    the skeleton/centerline of shapes. This is useful for:
    - Text rendering (draw single line instead of outline)
    - Narrow shapes where outline would overlap

    The centerline is a single-stroke representation that runs through
    the middle of the shape.
    """
    total_start = time.perf_counter()

    try:
        # Convert Pydantic models to dicts
        polygons_data = [
            {
                "outer": [{"x": p.x, "y": p.y} for p in poly.outer],
                "holes": [[{"x": p.x, "y": p.y} for p in hole] for hole in poly.holes],
            }
            for poly in request.polygons
        ]

        # Extract centerlines
        centerlines_raw, stats = centerline_service.extract(
            polygons=polygons_data,
            resolution=request.resolution,
            min_length=request.min_length,
            simplify_tolerance=request.simplify_tolerance,
            merge_tolerance=request.merge_tolerance,
            loop_threshold=request.loop_threshold,
            chaikin_iterations=request.chaikin_iterations,
            min_angle=request.min_angle,
            max_extend=request.max_extend,
            method=request.method,
            spoke_filter=request.spoke_filter,
        )

        # Convert to response format
        # centerlines_raw: List[List[List[Tuple[float, float]]]]
        # Per polygon -> List of polylines -> List of (x, y) tuples
        response_centerlines: list[list[Polyline]] = []

        for polygon_centerlines in centerlines_raw:
            polygon_polylines: list[Polyline] = []
            for polyline_coords in polygon_centerlines:
                if len(polyline_coords) >= 2:
                    points = [Point2D(x=pt[0], y=pt[1]) for pt in polyline_coords]
                    polygon_polylines.append(Polyline(points=points))
            response_centerlines.append(polygon_polylines)

        total_time = (time.perf_counter() - total_start) * 1000

        print(
            f"[CENTERLINE API] {stats['num_polylines']} polylines extracted in {total_time:.1f}ms"
        )

        return CenterlineResponse(
            centerlines=response_centerlines,
            stats=CenterlineStats(
                num_polygons=stats["num_polygons"],
                num_polylines=stats["num_polylines"],
                total_length_mm=stats["total_length_mm"],
                processing_time_ms=stats["processing_time_ms"],
                resolution=stats["resolution"],
                min_length=stats["min_length"],
            ),
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid input: {str(e)}")
    except Exception as e:
        import traceback

        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Centerline extraction failed: {str(e)}")
