"""
Downloads the lakes, wetlands, rivers and canals of the Chennai metropolitan area from
OpenStreetMap through the Overpass API and writes them as a compact list of points sampled
along each feature. The engine measures the distance from a place to the nearest point.

Overpass servers time out on large areas, so the region is fetched as tiles, each retried
across mirrors. Run once; the output is committed.

  python scripts/fetch-water.py
"""
import json
import math
import time
import urllib.parse
import urllib.request

SOUTH, WEST, NORTH, EAST = 12.78, 79.98, 13.28, 80.35
TILES = 3
MIRRORS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]
SPACING_M = 120
OUT = 'engine/src/data/chennai-water.json'


def query(s, w, n, e):
    box = f'({s},{w},{n},{e})'
    return f'''[out:json][timeout:90];
(way["natural"="water"]{box};
 way["natural"="wetland"]{box};
 way["waterway"~"^(river|canal)$"]{box};);
out tags geom;'''


def fetch(q):
    for attempt in range(6):
        for host in MIRRORS:
            try:
                req = urllib.request.Request(
                    host,
                    data=urllib.parse.urlencode({'data': q}).encode(),
                    headers={'User-Agent': 'vellam/0.1 (student hackathon project)', 'Accept': 'application/json'},
                )
                return json.loads(urllib.request.urlopen(req, timeout=120).read())['elements']
            except Exception as error:  # noqa: BLE001 - any failure moves to the next mirror
                print('  ', host.split('/')[2], 'failed:', str(error)[:80], flush=True)
        time.sleep(10 * (attempt + 1))
    raise SystemExit('every mirror failed')


def metres(a, b):
    lat = math.radians((a[0] + b[0]) / 2)
    return math.hypot((a[0] - b[0]) * 111_320, (a[1] - b[1]) * 111_320 * math.cos(lat))


def sample(geometry):
    """Points along a line roughly SPACING_M apart, always including the first."""
    points = [(g['lat'], g['lon']) for g in geometry]
    out = [points[0]]
    travelled = 0.0
    for previous, current in zip(points, points[1:]):
        travelled += metres(previous, current)
        if travelled >= SPACING_M:
            out.append(current)
            travelled = 0.0
    return out


def kind_of(tags):
    if tags.get('natural') == 'wetland':
        return 'wetland'
    if tags.get('waterway') in ('river', 'canal'):
        return tags['waterway']
    return tags.get('water', 'lake') if tags.get('water') in ('river', 'canal', 'reservoir', 'pond') else 'lake'


def main():
    features = {}
    lat_step = (NORTH - SOUTH) / TILES
    lon_step = (EAST - WEST) / TILES
    for i in range(TILES):
        for j in range(TILES):
            s, w = SOUTH + i * lat_step, WEST + j * lon_step
            print(f'tile {i * TILES + j + 1}/{TILES * TILES}', flush=True)
            for element in fetch(query(round(s, 4), round(w, 4), round(s + lat_step, 4), round(w + lon_step, 4))):
                if 'geometry' in element:
                    features[element['id']] = element

    names, kinds, points = [], [], []
    for element in features.values():
        tags = element.get('tags', {})
        # Unnamed ponds smaller than a few sample points are mostly temple tanks and
        # quarry pits; they add size without changing the nearest-water answer much.
        sampled = sample(element['geometry'])
        name = tags.get('name:en') or tags.get('name') or ''
        if not name and len(sampled) < 3:
            continue
        kind = kind_of(tags)
        if name not in names:
            names.append(name)
        if kind not in kinds:
            kinds.append(kind)
        for lat, lon in sampled:
            points.append([round(lat, 5), round(lon, 5), names.index(name), kinds.index(kind)])

    with open(OUT, 'w', encoding='utf-8') as handle:
        json.dump({
            'source': 'OpenStreetMap contributors, ODbL, via Overpass API',
            'fetched': time.strftime('%Y-%m-%d'),
            'bounds': [SOUTH, WEST, NORTH, EAST],
            'names': names,
            'kinds': kinds,
            'points': points,
        }, handle, ensure_ascii=False, separators=(',', ':'))
    print(f'{len(features)} features, {len(points)} points, {len(names)} names -> {OUT}')


main()
