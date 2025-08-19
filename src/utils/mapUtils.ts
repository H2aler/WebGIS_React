import { transform } from 'ol/proj';

// 좌표 변환 (EPSG:4326 -> EPSG:3857)
export const transformToWebMercator = (lon: number, lat: number): [number, number] => {
  return transform([lon, lat], 'EPSG:4326', 'EPSG:3857') as [number, number];
};

// 좌표 변환 (EPSG:3857 -> EPSG:4326)
export const transformToWGS84 = (x: number, y: number): [number, number] => {
  return transform([x, y], 'EPSG:3857', 'EPSG:4326') as [number, number];
};

// 좌표 배열 변환
export const transformCoordinates = (coordinates: [number, number][]): [number, number][] => {
  return coordinates.map(coord => transformToWebMercator(coord[0], coord[1]));
};

// 기본 지도 설정
export const getDefaultMapConfig = () => ({
  center: transform([127.7669, 37.5665], 'EPSG:4326', 'EPSG:3857') as [number, number],
  zoom: 10,
  maxZoom: 18,
  minZoom: 3
});

// 레이어 URL 설정
export const getLayerUrls = () => ({
  satellite: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
  terrain: 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}'
});
