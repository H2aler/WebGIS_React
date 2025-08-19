// 지도 관련 타입
export interface MapConfig {
  center: [number, number];
  zoom: number;
  maxZoom: number;
  minZoom: number;
}

// 검색 결과 타입
export interface SearchResult {
  place_id: string;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  importance: number;
}

// 측정 결과 타입
export interface MeasurementResult {
  type: 'distance' | 'area' | 'marker';
  value: number;
  text: string;
  coordinates?: number[][];
  timestamp: string;
  distance?: number;
  area?: number;
}

// 즐겨찾기 타입
export interface Favorite {
  id: string;
  name: string;
  lat: number;
  lon: number;
  addedAt: string;
}

// 지도 레이어 타입
export type LayerType = 'osm' | 'satellite' | 'terrain';

// 측정 도구 타입
export type ToolType = 'distance' | 'area' | 'marker' | null;

// 테마 타입
export type Theme = 'light' | 'dark';

// 지도 기능 타입
export interface MapFeature {
  type: 'measurement' | 'marker';
  measurement?: 'distance' | 'area';
  value?: number;
  coordinates?: number[][];
}
