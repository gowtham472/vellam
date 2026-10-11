import L from 'leaflet';
import { useEffect, useRef } from 'react';
import type { Level, PlaceSummary, Point, WaterReport } from '../../../engine/src/core/types.ts';
import { LEVEL } from '../level.ts';

const CHENNAI: [number, number] = [13.02, 80.2];

interface Props {
  readonly places?: readonly PlaceSummary[];
  /** A single place to centre on and mark, for the place page. */
  readonly focus?: { point: Point; level: Level };
  readonly reports?: readonly WaterReport[];
  readonly onPick: (point: Point) => void;
}

/**
 * The map is Leaflet driven directly, without a React wrapper: there is one map, its
 * layers are rebuilt when the data changes, and that is all the lifecycle it needs.
 */
export function CityMap({ places, focus, reports, onPick }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const pick = useRef(onPick);
  pick.current = onPick;

  useEffect(() => {
    if (container.current === null) return;
    const created = L.map(container.current, { zoomControl: true, attributionControl: true }).setView(CHENNAI, 11);
    // OpenStreetMap's own tiles need no key. Their usage policy asks for attribution and
    // light use, which a hackathon dashboard is; heavier traffic would need a tile provider.
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(created);
    created.on('click', (event: L.LeafletMouseEvent) => {
      pick.current({ lat: event.latlng.lat, lon: event.latlng.lng });
    });
    layer.current = L.layerGroup().addTo(created);
    map.current = created;
    return () => {
      created.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const group = layer.current;
    if (group === null || map.current === null) return;
    group.clearLayers();
    for (const place of places ?? []) {
      L.circleMarker([place.point.lat, place.point.lon], {
        radius: 9,
        color: '#ffffff',
        weight: 2,
        fillColor: LEVEL[place.level].colour,
        fillOpacity: 0.95,
      })
        .bindTooltip(`${place.name}: ${place.level}`, { direction: 'top' })
        .on('click', (event: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(event);
          pick.current(place.point);
        })
        .addTo(group);
    }
    for (const report of reports ?? []) {
      L.circleMarker([report.point.lat, report.point.lon], {
        radius: 6,
        color: '#1c232b',
        weight: 2,
        fillColor: report.depth === 'NONE' ? '#ffffff' : '#1c7ed6',
        fillOpacity: 1,
      })
        .bindTooltip(`Reported: ${report.depth.toLowerCase()}`, { direction: 'top' })
        .addTo(group);
    }
    if (focus !== undefined) {
      L.circleMarker([focus.point.lat, focus.point.lon], {
        radius: 13,
        color: '#1c232b',
        weight: 3,
        fillColor: LEVEL[focus.level].colour,
        fillOpacity: 0.95,
      }).addTo(group);
      map.current.setView([focus.point.lat, focus.point.lon], 15);
    }
  }, [places, focus, reports]);

  return <div ref={container} className="map" role="application" aria-label="Map of Chennai" />;
}
