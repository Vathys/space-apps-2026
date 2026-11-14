"""Moon Trek connector: layer catalog search + WMTS tiles stitched into georeferenced GeoTIFFs.

API docs: https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=moon
Tiles are rendered PNGs (display products), not raw science values.

    uv run python -m data.trek            # dump catalogs + south-pole mosaics to data/raw/trek/
"""

import io
import json
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
import requests
from PIL import Image

SEARCH = "https://trek.nasa.gov/moon/TrekServices/ws/index/{kind}/searchItems"
TILES = "https://trek.nasa.gov/tiles/Moon/{proj}/{layer}/1.0.0"
STREAM = "https://trek.nasa.gov/moon/TrekWS/rest/cat/data/stream"
RAW = Path(__file__).parent / "raw" / "trek"
R_MOON = 1737400.0
PROJ = {  # projection key -> (Trek CRS urn, tile dir, PROJ string for the GeoTIFF)
    "eq": ("urn:ogc:def:crs:EPSG::104903", "EQ", f"+proj=longlat +R={R_MOON} +no_defs"),
    "np": ("urn:ogc:def:crs:IAU2000::30118", "NP", f"+proj=stere +lat_0=90 +lon_0=0 +k=1 +R={R_MOON} +units=m +no_defs"),
    "sp": ("urn:ogc:def:crs:IAU2000::30120", "SP", f"+proj=stere +lat_0=-90 +lon_0=0 +k=1 +R={R_MOON} +units=m +no_defs"),
}


def search_layers(proj: str = "sp") -> list[dict]:
    """All public product layers (title, productLabel, bbox, resolution, category, ...) for a projection."""
    r = requests.get(SEARCH.format(kind="eq" if proj == "eq" else "polar"), timeout=120, params={
        "start": 0, "rows": 100000, "proj": PROJ[proj][0], "facetKeys": "itemType", "facetValues": "product"})
    r.raise_for_status()
    return r.json()["response"]["docs"]


def capabilities(layer: str, proj: str = "sp") -> dict:
    """Parse a layer's WMTSCapabilities.xml into template, bbox and tile matrices (pixel size in CRS units)."""
    r = requests.get(f"{TILES.format(proj=PROJ[proj][1], layer=layer)}/WMTSCapabilities.xml", timeout=60)
    r.raise_for_status()
    root = ET.fromstring(r.content)
    lyr = root.find(".//{*}Contents/{*}Layer")
    bb = lyr.find("{*}BoundingBox")
    if bb is None:
        bb = lyr.find("{*}WGS84BoundingBox")
    lo = [float(v) for v in bb.find("{*}LowerCorner").text.split()]
    hi = [float(v) for v in bb.find("{*}UpperCorner").text.split()]
    matrices = []
    for tm in root.findall(".//{*}TileMatrixSet/{*}TileMatrix"):
        tlx, tly = (float(v) for v in tm.find("{*}TopLeftCorner").text.split())
        tile_px, cols = int(tm.find("{*}TileWidth").text), int(float(tm.find("{*}MatrixWidth").text))
        matrices.append({
            "id": tm.find("{*}Identifier").text,
            # EQ ScaleDenominators assume Earth's metres/degree, so derive degrees/px from the 360-degree width
            "pixel": 360 / (cols * tile_px) if proj == "eq"
                     else float(tm.find("{*}ScaleDenominator").text) * 0.00028,  # OGC 0.28 mm pixel
            "tl": (tlx, tly),
            "tile": tile_px,
            "cols": cols,
            "rows": int(float(tm.find("{*}MatrixHeight").text)),
        })
    return {
        "template": lyr.find("{*}ResourceURL").get("template"),
        "style": lyr.find("{*}Style/{*}Identifier").text,
        "tms": lyr.find("{*}TileMatrixSetLink/{*}TileMatrixSet").text,
        "bbox": (*lo, *hi),
        "matrices": matrices,
    }


def tile(cap: dict, zoom: int, row: int, col: int) -> Image.Image | None:
    """One tile, or None where the layer has no coverage."""
    u = (cap["template"].replace("{Style}", cap["style"]).replace("{TileMatrixSet}", cap["tms"])
         .replace("{TileMatrix}", cap["matrices"][zoom]["id"]).replace("{TileRow}", str(row)).replace("{TileCol}", str(col)))
    r = requests.get(u, timeout=60)
    if r.status_code == 404:
        return None
    r.raise_for_status()
    return Image.open(io.BytesIO(r.content)).convert("RGBA")


def download_raw(label: str, dest: Path = RAW / "raw_files") -> Path:
    """Original product file (Float32 GeoTIFF, GeoJSON, ...) with true values. Whole file only, up to ~250 MB."""
    with requests.get(STREAM, params={"label": label}, stream=True, timeout=120) as r:
        r.raise_for_status()
        name = r.headers.get("Content-Disposition", "").partition("filename=")[2].strip('"') or label
        out = dest / name
        out.parent.mkdir(parents=True, exist_ok=True)
        tmp = out.with_suffix(out.suffix + ".part")
        with open(tmp, "wb") as f:
            for chunk in r.iter_content(1 << 20):
                f.write(chunk)
        tmp.replace(out)
    return out


def mosaic(layer: str, proj: str = "sp", target_px: int = 2048, dest: Path = RAW) -> Path:
    """Stitch the tiles covering the layer's bbox at the coarsest zoom >= target_px wide into an RGBA GeoTIFF."""
    import rasterio
    from rasterio.transform import from_origin

    cap = capabilities(layer, proj)
    x0, y0, x1, y1 = cap["bbox"]
    zoom = next((i for i, m in enumerate(cap["matrices"]) if (x1 - x0) / m["pixel"] >= target_px),
                len(cap["matrices"]) - 1)
    m = cap["matrices"][zoom]
    span = m["tile"] * m["pixel"]
    c0, c1 = max(0, int((x0 - m["tl"][0]) // span)), min(m["cols"] - 1, int((x1 - m["tl"][0]) // span))
    r0, r1 = max(0, int((m["tl"][1] - y1) // span)), min(m["rows"] - 1, int((m["tl"][1] - y0) // span))
    cells = [(r, c) for r in range(r0, r1 + 1) for c in range(c0, c1 + 1)]
    with ThreadPoolExecutor(8) as pool:
        tiles = pool.map(lambda rc: tile(cap, zoom, *rc), cells)
    img = Image.new("RGBA", ((c1 - c0 + 1) * m["tile"], (r1 - r0 + 1) * m["tile"]))
    for (r, c), t in zip(cells, tiles):
        if t is not None:
            img.paste(t, ((c - c0) * m["tile"], (r - r0) * m["tile"]))
    arr = np.moveaxis(np.asarray(img), -1, 0)
    out = dest / proj / f"{layer}.tif"
    out.parent.mkdir(parents=True, exist_ok=True)
    origin = (m["tl"][0] + c0 * span, m["tl"][1] - r0 * span)
    with rasterio.open(out, "w", driver="GTiff", width=arr.shape[2], height=arr.shape[1], count=4, dtype="uint8",
                       crs=PROJ[proj][2], transform=from_origin(*origin, m["pixel"], m["pixel"]),
                       compress="deflate") as ds:
        ds.write(arr)
    return out


if __name__ == "__main__":
    RAW.mkdir(parents=True, exist_ok=True)
    for p in PROJ:
        docs = search_layers(p)
        (RAW / f"catalog_{p}.json").write_text(json.dumps(docs, indent=1))
        print(f"catalog_{p}.json", len(docs))
    for layer in ("AVGVISIB_65S_240M_201608_EARTH_SP",  # average Earth visibility
                  "SKYV_65S_240M_SP",  # sky visibility
                  "WAC_POLE_ILL_PCT_SOUTH_100M",  # % illumination
                  "LRO_LOLA_Illumination_SPole65S_240m",  # permanently shadowed regions
                  "LRO_LOLA_Shade_SPole875_5mp_v04",  # hillshade, poleward of 87.5S
                  "Site01_final_adj_5mpp_surf"):  # same DEM as PGDA Site01, for cross-checking
        print(mosaic(layer, "sp"))
