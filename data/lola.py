"""LOLA GDR connector: regional/global LOLA DEMs for terrain horizon masks around candidate ground-station sites.

Source: PDS LOLA GDR mirror at MIT, https://imbrium.mit.edu/DATA/LOLA_GDR/  (polar stereographic + cylindrical).
Products are PDS3 .IMG + .LBL; rasterio/GDAL opens the .LBL directly. Height (m) = DN * 0.5 above R = 1737.4 km.
PGDA 5 m site DEMs only reach ~10 km, but Earth and relays sit near the horizon at the pole, where terrain 100+ km
away (e.g. Malapert) sets the mask, so siting needs these wider DEMs.

    uv run python -m data.lola            # dump DEMS to data/raw/lola/
"""

from pathlib import Path

import requests

BASE = "https://imbrium.mit.edu/DATA/LOLA_GDR"
RAW = Path(__file__).parent / "raw" / "lola"

DEMS = {
    "LDEM_75S_120M": "POLAR/IMG",  # 75S-pole, 120 m/px, 116 MB: covers every Artemis III region and Chang'e-7
    "LDEM_16": "CYLINDRICAL/IMG",  # global, 16 px/deg (~1.9 km), 33 MB: whole-Moon screening, far side
    # Upgrades if needed: LDEM_80S_20M (POLAR, ~1.8 GB), LDEM_64 (CYLINDRICAL, 531 MB), SLDEM2015 (±60°, ~60 m).
}


def download(name: str, dest: Path = RAW) -> Path:
    """Fetch <name>.LBL and <name>.IMG into dest/; skips files already fully downloaded. Returns the .LBL path."""
    for ext in (".LBL", ".IMG"):
        url = f"{BASE}/{DEMS[name]}/{name}{ext}"
        out = dest / f"{name}{ext}"
        with requests.get(url, stream=True, timeout=60) as r:
            r.raise_for_status()
            if out.exists() and out.stat().st_size == int(r.headers.get("Content-Length", -1)):
                continue
            out.parent.mkdir(parents=True, exist_ok=True)
            tmp = out.with_suffix(ext + ".part")  # never leave a truncated file under the real name
            with open(tmp, "wb") as f:
                f.writelines(r.iter_content(1 << 20))
            tmp.replace(out)
    return dest / f"{name}.LBL"


if __name__ == "__main__":
    for name in DEMS:
        print(download(name))
