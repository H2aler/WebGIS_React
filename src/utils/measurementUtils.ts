import { getLength, getArea } from 'ol/sphere';

// 거리 포맷팅
export const formatDistance = (length: number): string => {
  if (length < 1000) {
    return `거리: ${length.toFixed(1)} m`;
  } else if (length < 100000) {
    return `거리: ${(length / 1000).toFixed(3)} km`;
  } else {
    return `거리: ${(length / 1000).toFixed(1)} km`;
  }
};

// 면적 포맷팅
export const formatArea = (area: number): string => {
  if (area < 1000000) {
    return `면적: ${(area / 10000).toFixed(2)} ha`;
  } else {
    return `면적: ${(area / 1000000).toFixed(3)} km²`;
  }
};

// 거리 계산
export const calculateDistance = (coordinates: number[][]): number => {
  if (coordinates.length < 2) return 0;
  
  // LineString 생성 및 거리 계산
  const lineString = {
    getCoordinates: () => coordinates,
    getType: () => 'LineString'
  } as any;
  
  return getLength(lineString);
};

// 면적 계산
export const calculateArea = (coordinates: number[][]): number => {
  if (coordinates.length < 3) return 0;
  
  // Polygon 생성 및 면적 계산
  const polygon = {
    getCoordinates: () => [coordinates],
    getType: () => 'Polygon'
  } as any;
  
  return getArea(polygon);
};
