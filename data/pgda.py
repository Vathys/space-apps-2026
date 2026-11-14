"""PGDA connector: high-resolution (5 m/px) LOLA DEMs for lunar south pole sites.

Source: https://pgda.gsfc.nasa.gov/products/78  (README: https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/README)
GeoTIFFs are south polar stereographic (meters, sphere R=1737.4 km), MOON_ME frame (DE421).

    uv run python -m data.pgda            # dump default sites/products to data/raw/pgda/
"""

from pathlib import Path

import numpy as np
import requests

BASE = "https://pgda.gsfc.nasa.gov/data/LOLA_5mpp"
RAW = Path(__file__).parent / "raw" / "pgda"

SITES = {
    "Site01": "Connecting ridge", "Site04": "Shackleton rim", "Site06": "Nobile rim 1",
    "Site07": "Peak near Shackleton", "Site11": "de Gerlache rim", "Site20": "Leibnitz beta plateau",
    "Site20v2": "Leibnitz beta plateau, extended", "Site23": "Malapert massif",
    "Site42": "de Gerlache-Kocher massif", "Haworth": "Haworth", "Shoemaker": "Shoemaker",
    "DM1": "Amundsen rim", "DM2": "Nobile rim 2", "SL2": "de Gerlache rim", "SL3": "Connecting ridge extension",
    "NPA": "Cabeus exterior wall 1", "NPB": "Amundsen 1", "NPC": "Idel'son L crater 1", "NPD": "Malapert crater 1",
    "LM1": "Shackleton Rim B", "LM2": "Shoemaker Rim A", "LM3": "Shoemaker Rim B", "LM4": "Shoemaker Rim C",
    "LM5": "Shoemaker Rim D", "LM6": "Shoemaker Rim E", "LM7": "Faustini Rim A", "LM8": "Shoemaker Rim F",
}

# surf=height (m), ldec=LOLA shots/pixel, slp=slope (deg), toterr=height RMS error (m), slperr=slope RMS error (deg)
RASTERS = ("surf", "ldec", "slp", "toterr", "slperr")
POLAR_STEREO = "+proj=stere +lat_0=-90 +lon_0=0 +k=1 +x_0=0 +y_0=0 +R=1737400 +units=m +no_defs"


def url(site: str, product: str) -> str:
    """product: one of RASTERS, 'xyzi', 'rois', or 'clone001'..'clone100'."""
    if site not in SITES:
        raise ValueError(f"unknown site {site!r}")
    if product in RASTERS:
        return f"{BASE}/{site}/{site}_final_adj_5mpp_{product}.tif"
    if product == "xyzi":
        return f"{BASE}/{site}/{site}_final_adj.xyzi"
    if product == "rois":  # only Site01/04/06/07/11 publish ROI shapefiles
        return f"{BASE}/{site}/{site}_ROIs.tgz"
    if product.startswith("clone"):
        return f"{BASE}/{site}/Clones/{site}_final_adj_5mpp_{int(product[5:]):04d}_err.tif"
    raise ValueError(f"unknown product {product!r}")


def download(site: str, product: str, dest: Path = RAW) -> Path:
    """Stream a file to dest/<site>/; skips files already fully downloaded."""
    u = url(site, product)
    out = dest / site / u.rsplit("/", 1)[1]
    with requests.get(u, stream=True, timeout=60) as r:
        r.raise_for_status()
        size = int(r.headers.get("Content-Length", -1))
        if out.exists() and out.stat().st_size == size:
            return out
        out.parent.mkdir(parents=True, exist_ok=True)
        tmp = out.with_suffix(out.suffix + ".part")  # never leave a truncated file under the real name
        with open(tmp, "wb") as f:
            for chunk in r.iter_content(1 << 20):
                f.write(chunk)
        tmp.replace(out)
    return out


def read_xyzi(path: Path) -> np.ndarray:
    """Point cloud: float64 columns x, y, z (polar stereographic, km) and rdr_id (LOLA RDR id, YYDOYHHMM)."""
    return np.fromfile(path, dtype=[("x", "<f8"), ("y", "<f8"), ("z", "<f8"), ("rdr_id", "<f8")])


def site_center_latlon(tif: Path) -> tuple[float, float]:
    """(lat, lon east) of a DEM's center pixel."""
    import rasterio
    from pyproj import Transformer

    with rasterio.open(tif) as ds:
        x, y = ds.xy(ds.height // 2, ds.width // 2)
    lon, lat = Transformer.from_crs(POLAR_STEREO, "+proj=longlat +R=1737400 +no_defs", always_xy=True).transform(x, y)
    return lat, lon % 360


if __name__ == "__main__":
    for site in ("Site01", "Site04"):
        for product in ("surf", "slp", "toterr", "ldec", "xyzi", "rois"):
            print(download(site, product))
