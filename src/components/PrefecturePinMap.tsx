import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { RaceEvent, EventCategory } from '../types';
import {
  CATEGORY_LABELS,
  ENTRY_STATUS_CONFIG,
  formatEventDateSlash,
  getGoogleMapsUrl,
} from '../utils/helpers';
import { Layers, MapPin, Navigation } from 'lucide-react';

export type MapTileStyle = 'gsi-pale' | 'gsi-std' | 'osm';

interface PrefecturePinMapProps {
  events: RaceEvent[];
  title: string;
  isOverseas?: boolean;
  fallbackCenter: [number, number];
  fallbackZoom: number;
  selectedEventId: string | null;
  onSelectPin: (eventId: string) => void;
  onOpenEventDetail: (event: RaceEvent) => void;
}

const CATEGORY_PIN_COLOR: Record<EventCategory, string> = {
  trail: '#0d9488',     // ティール
  cycling: '#0284c7',   // スカイ
  marathon: '#4f46e5',  // インディゴ
  adventure: '#d97706', // アンバー
};

const CATEGORY_PIN_EMOJI: Record<EventCategory, string> = {
  trail: '⛰',
  cycling: '🚲',
  marathon: '🏃',
  adventure: '🧭',
};

const TILE_CONFIG: Record<
  MapTileStyle,
  { label: string; url: string; attribution: string; maxZoom: number }
> = {
  'gsi-pale': {
    label: '淡色地図(地理院)',
    url: 'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png',
    attribution:
      '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener noreferrer">国土地理院</a>',
    maxZoom: 18,
  },
  'gsi-std': {
    label: '地形・標準(地理院)',
    url: 'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png',
    attribution:
      '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener noreferrer">国土地理院</a>',
    maxZoom: 18,
  },
  osm: {
    label: 'OpenStreetMap',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
    maxZoom: 19,
  },
};

function escapeHtml(text: string): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface PositionedEvent {
  event: RaceEvent;
  lat: number;
  lng: number;
  isClusteredOffset: boolean;
}

export const PrefecturePinMap: React.FC<PrefecturePinMapProps> = ({
  events,
  title,
  isOverseas = false,
  fallbackCenter,
  fallbackZoom,
  selectedEventId,
  onSelectPin,
  onOpenEventDetail,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const markerMapRef = useRef<Map<string, L.Marker>>(new Map());

  // コールバックの最新参照を保持（useEffectの不要な再実行を防止）
  const onSelectPinRef = useRef(onSelectPin);
  onSelectPinRef.current = onSelectPin;
  const onOpenEventDetailRef = useRef(onOpenEventDetail);
  onOpenEventDetailRef.current = onOpenEventDetail;

  const [tileStyle, setTileStyle] = useState<MapTileStyle>(isOverseas ? 'osm' : 'gsi-pale');

  // 国内↔海外が切り替わったら見やすいタイルへ自動切替
  useEffect(() => {
    setTileStyle(isOverseas ? 'osm' : 'gsi-pale');
  }, [isOverseas]);

  // 同一座標の重なりを防ぐため、同座標の複数大会を表示用スパイラルに微小分散する
  const positionedEvents = useMemo<PositionedEvent[]>(() => {
    const groups = new Map<string, RaceEvent[]>();
    for (const ev of events) {
      const lat = typeof ev.venue?.lat === 'number' ? ev.venue.lat : fallbackCenter[0];
      const lng = typeof ev.venue?.lng === 'number' ? ev.venue.lng : fallbackCenter[1];
      const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
      const list = groups.get(key) || [];
      list.push(ev);
      groups.set(key, list);
    }

    const result: PositionedEvent[] = [];
    for (const list of groups.values()) {
      if (list.length === 1) {
        const ev = list[0];
        const lat = typeof ev.venue?.lat === 'number' ? ev.venue.lat : fallbackCenter[0];
        const lng = typeof ev.venue?.lng === 'number' ? ev.venue.lng : fallbackCenter[1];
        result.push({ event: ev, lat, lng, isClusteredOffset: false });
      } else {
        const baseRadius = isOverseas ? 0.35 : 0.012;
        list.forEach((ev, idx) => {
          const baseLat = typeof ev.venue?.lat === 'number' ? ev.venue.lat : fallbackCenter[0];
          const baseLng = typeof ev.venue?.lng === 'number' ? ev.venue.lng : fallbackCenter[1];
          const angle = (2 * Math.PI * idx) / list.length;
          const ringScale = 1 + Math.floor(idx / 8) * 0.65;
          result.push({
            event: ev,
            lat: baseLat + Math.sin(angle) * baseRadius * ringScale,
            lng: baseLng + Math.cos(angle) * baseRadius * ringScale * 1.15,
            isClusteredOffset: true,
          });
        });
      }
    }
    return result;
  }, [events, fallbackCenter, isOverseas]);

  // 1. Leafletマップ本体の初期化と確実なクリーンアップ
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const map = L.map(el, {
      center: fallbackCenter,
      zoom: fallbackZoom,
      zoomControl: true,
      scrollWheelZoom: true,
    });

    const markersLayer = L.layerGroup().addTo(map);
    mapRef.current = map;
    markersLayerRef.current = markersLayer;

    // ポップアップ内の「大会詳細を見る」ボタンへイベントを接続
    const handlePopupOpen = (e: L.PopupEvent) => {
      const popupEl = e.popup.getElement();
      if (!popupEl) return;
      const btn = popupEl.querySelector('[data-open-event-id]') as HTMLButtonElement | null;
      if (btn) {
        btn.onclick = () => {
          const id = btn.getAttribute('data-open-event-id');
          if (!id) return;
          const found = events.find((item) => item.id === id);
          if (found) {
            onOpenEventDetailRef.current(found);
          }
        };
      }
    };
    map.on('popupopen', handlePopupOpen);

    return () => {
      map.off('popupopen', handlePopupOpen);
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      markersLayerRef.current = null;
      markerMapRef.current.clear();
    };
    // events 参照更新は ref と別 effect で扱うため初回のみ生成
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ポップアップ内のイベント検索が常に最新 events を見るように更新
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handlePopupOpen = (e: L.PopupEvent) => {
      const popupEl = e.popup.getElement();
      if (!popupEl) return;
      const btn = popupEl.querySelector('[data-open-event-id]') as HTMLButtonElement | null;
      if (btn) {
        btn.onclick = () => {
          const id = btn.getAttribute('data-open-event-id');
          if (!id) return;
          const found = events.find((item) => item.id === id);
          if (found) onOpenEventDetailRef.current(found);
        };
      }
    };
    map.off('popupopen');
    map.on('popupopen', handlePopupOpen);
  }, [events]);

  // 2. タイルレイヤー切り替え
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }
    const cfg = TILE_CONFIG[tileStyle];
    const layer = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: cfg.maxZoom,
    });
    layer.addTo(map);
    tileLayerRef.current = layer;
  }, [tileStyle]);

  // 3. ピン描画＆fitBounds（エリア変更・絞り込み変更時）
  useEffect(() => {
    const map = mapRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    markerMapRef.current.clear();

    const latLngs: L.LatLngExpression[] = [];

    for (const item of positionedEvents) {
      const { event, lat, lng } = item;
      const isSelected = selectedEventId === event.id;
      const isOpen = event.entry_status === 'open' || event.entry_status === 'closing_soon';
      const color = CATEGORY_PIN_COLOR[event.category] || '#0f766e';
      const emoji = CATEGORY_PIN_EMOJI[event.category] || '📍';

      const iconHtml = `
        <div class="race-pin ${isSelected ? 'race-pin-selected' : ''}" style="--pin-color:${color}">
          <span class="race-pin-emoji">${emoji}</span>
          ${isOpen ? '<span class="race-pin-open-dot" title="受付中"></span>' : ''}
        </div>
      `;

      const icon = L.divIcon({
        html: iconHtml,
        className: 'race-pin-wrapper',
        iconSize: isSelected ? [38, 38] : [30, 30],
        iconAnchor: isSelected ? [19, 19] : [15, 15],
        popupAnchor: [0, -16],
      });

      const marker = L.marker([lat, lng], {
        icon,
        zIndexOffset: isSelected ? 1000 : isOpen ? 200 : 0,
      });

      const catInfo = CATEGORY_LABELS[event.category];
      const statusCfg = ENTRY_STATUS_CONFIG[event.entry_status];
      const dateLabel = formatEventDateSlash(event.date, event.end_date);
      const venueName = event.venue?.name || event.prefecture;
      const isPrefApprox = event.venue?.coordPrecision === 'prefecture';
      const gmapUrl = getGoogleMapsUrl(event);

      const popupHtml = `
        <div class="race-popup-card">
          <div class="race-popup-badges">
            <span class="race-popup-cat" style="background:${color}">${escapeHtml(catInfo.shortLabel)}</span>
            <span class="race-popup-status ${isOpen ? 'is-open' : ''}">${escapeHtml(statusCfg.label)}</span>
          </div>
          <div class="race-popup-title">${escapeHtml(event.title)}</div>
          <div class="race-popup-meta">
            <div>📅 ${escapeHtml(dateLabel)} ／ 📏 ${Math.round(event.distance_km)}km${event.elevation_m > 0 ? ` ／ ⛰️ +${event.elevation_m.toLocaleString()}m` : ''}</div>
            <div>📍 ${escapeHtml(venueName)}</div>
            ${isPrefApprox ? '<div class="race-popup-approx">※広域開催・会場詳細未定のため代表地点に表示</div>' : ''}
          </div>
          <div class="race-popup-actions">
            <button type="button" data-open-event-id="${escapeHtml(event.id)}" class="race-popup-btn-primary">
              大会詳細を見る
            </button>
            <a href="${escapeHtml(gmapUrl)}" target="_blank" rel="noopener noreferrer" class="race-popup-btn-secondary">
              Googleマップ ↗
            </a>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml, { maxWidth: 290, minWidth: 220 });
      marker.on('click', () => {
        onSelectPinRef.current(event.id);
      });

      marker.addTo(layer);
      markerMapRef.current.set(event.id, marker);
      latLngs.push([lat, lng]);
    }

    if (latLngs.length > 1) {
      const bounds = L.latLngBounds(latLngs);
      map.fitBounds(bounds, {
        padding: [40, 40],
        maxZoom: isOverseas ? 4 : 11,
        animate: true,
      });
    } else if (latLngs.length === 1) {
      map.setView(latLngs[0], isOverseas ? 5 : Math.max(fallbackZoom, 10), { animate: true });
    } else {
      map.setView(fallbackCenter, fallbackZoom, { animate: true });
    }
    // selectedEventId 変更だけで fitBounds し直さないように positionedEvents 等を依存にする
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positionedEvents, fallbackCenter, fallbackZoom, isOverseas]);

  // 4. 選択中ピン（selectedEventId）が変わった時のアイコン更新とパン＆ポップアップ
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const item of positionedEvents) {
      const marker = markerMapRef.current.get(item.event.id);
      if (!marker) continue;
      const isSelected = selectedEventId === item.event.id;
      const isOpen =
        item.event.entry_status === 'open' || item.event.entry_status === 'closing_soon';
      const color = CATEGORY_PIN_COLOR[item.event.category] || '#0f766e';
      const emoji = CATEGORY_PIN_EMOJI[item.event.category] || '📍';

      marker.setIcon(
        L.divIcon({
          html: `
            <div class="race-pin ${isSelected ? 'race-pin-selected' : ''}" style="--pin-color:${color}">
              <span class="race-pin-emoji">${emoji}</span>
              ${isOpen ? '<span class="race-pin-open-dot" title="受付中"></span>' : ''}
            </div>
          `,
          className: 'race-pin-wrapper',
          iconSize: isSelected ? [38, 38] : [30, 30],
          iconAnchor: isSelected ? [19, 19] : [15, 15],
          popupAnchor: [0, -16],
        })
      );
      marker.setZIndexOffset(isSelected ? 1000 : isOpen ? 200 : 0);

      if (isSelected) {
        map.panTo(marker.getLatLng(), { animate: true });
        if (!marker.isPopupOpen()) {
          marker.openPopup();
        }
      }
    }
  }, [selectedEventId, positionedEvents]);

  const approxCount = useMemo(
    () => events.filter((e) => e.venue?.coordPrecision === 'prefecture').length,
    [events]
  );

  return (
    <div className="space-y-2.5">
      {/* 地図上部：コントロール＆凡例 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 text-xs font-black text-slate-800 dark:text-slate-200">
            <Navigation className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>{title}の開催地ピンマップ</span>
          </span>
          <div className="flex items-center gap-2 text-[11px] font-bold text-slate-600 dark:text-slate-300">
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-600" />
              トレイル
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-600" />
              サイクル
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
              マラソン
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-600" />
              AR・ロゲ
            </span>
          </div>
        </div>

        {/* 地図タイル切替 */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-300 dark:border-slate-700">
          <Layers className="w-3.5 h-3.5 text-slate-500 ml-1.5 mr-0.5 shrink-0" />
          {(Object.keys(TILE_CONFIG) as MapTileStyle[])
            .filter((k) => (!isOverseas ? true : k === 'osm'))
            .map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setTileStyle(key)}
                className={`px-2 py-1 rounded-lg text-[10px] sm:text-xs font-black transition-all cursor-pointer ${
                  tileStyle === key
                    ? 'bg-white dark:bg-slate-700 text-slate-950 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-950'
                }`}
              >
                {TILE_CONFIG[key].label}
              </button>
            ))}
        </div>
      </div>

      {/* Leaflet マップ本体（z-0 isolate でヘッダーやモーダルとの重なりを安全に隔離） */}
      <div className="relative z-0 isolate rounded-2xl overflow-hidden border-2 border-slate-200 dark:border-slate-700 shadow-sm bg-slate-100 dark:bg-slate-900">
        <div
          ref={containerRef}
          className="w-full h-[320px] sm:h-[420px] lg:h-[460px]"
          aria-label={`${title}の開催地インタラクティブマップ`}
        />

        {events.length === 0 && (
          <div className="absolute inset-0 z-[500] flex flex-col items-center justify-center bg-white/80 dark:bg-slate-950/80 backdrop-blur-[2px] p-4 text-center pointer-events-none">
            <MapPin className="w-8 h-8 text-slate-400 mb-2" />
            <p className="text-sm font-black text-slate-800 dark:text-slate-200">
              現在の絞り込み条件に一致する大会がありません
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              種目や「受付中のみ」などの条件を変更してみてください
            </p>
          </div>
        )}
      </div>

      {approxCount > 0 && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
          ※ ピンが重なる開催地はクリックしやすいように少しずつ分散表示しています。また、広域開催（ブルベ等）や会場詳細未定の {approxCount}件 は代表地点に表示しています。
        </p>
      )}
    </div>
  );
};
