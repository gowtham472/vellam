"""
Converts the streets residents marked as flooded during the December 2015 Chennai floods
into a compact list of points sampled along each street. The engine measures the distance
from a place to the nearest point.

Source: the osm-in/flood-map project (MIT licence), a crowd-sourced map built during the
floods. https://github.com/osm-in/flood-map

  curl -L https://raw.githubusercontent.com/osm-in/flood-map/gh-pages/data/chennai-flooded-streets-Dec31.geojson -o data/flooded-2015.geojson
  python scripts/build-flood-history.py
"""
import json
import math

SOURCE = 'data/flooded-2015.geojson'
OUT = 'engine/src/data/chennai-flooded-2015.json'
SPACING_M = 70
SOUTH, WEST, NORTH, EAST = 12.78, 79.98, 13.28, 80.35


def metres(a, b):
    lat = math.radians((a[1] + b[1]) / 2)
    return math.hypot((a[1] - b[1]) * 111_320, (a[0] - b[0]) * 111_320 * math.cos(lat))


def sample(line):
    out = [line[0]]
    travelled = 0.0
    for previous, current in zip(line, line[1:]):
        travelled += metres(previous, current)
        if travelled >= SPACING_M:
            out.append(current)
            travelled = 0.0
    if len(line) > 1 and out[-1] != line[-1]:
        out.append(line[-1])
    return out


features = json.load(open(SOURCE, encoding='utf-8'))['features']
points = set()
streets = 0
for feature in features:
    if not feature['properties'].get('is_flooded'):
        continue
    geometry = feature['geometry']
    lines = geometry['coordinates'] if geometry['type'] == 'MultiLineString' else [geometry['coordinates']]
    counted = False
    for line in lines:
        for lon, lat in sample(line):
            if SOUTH <= lat <= NORTH and WEST <= lon <= EAST:
                points.add((round(lat, 5), round(lon, 5)))
                counted = True
    streets += counted

ordered = sorted(points)
json.dump({
    'source': 'osm-in/flood-map, crowd-sourced during the December 2015 Chennai floods, MIT licence',
    'link': 'https://github.com/osm-in/flood-map',
    'streets': streets,
    'bounds': [SOUTH, WEST, NORTH, EAST],
    'points': [list(point) for point in ordered],
}, open(OUT, 'w', encoding='utf-8'), separators=(',', ':'))
print(f'{streets} flooded streets, {len(ordered)} points -> {OUT}')
