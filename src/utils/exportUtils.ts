import { MeasurementResult, Favorite } from '../types';

// GeoJSON 유사 포맷으로 데이터 내보내기
export const exportToGeoJSON = (measurements: MeasurementResult[], favorites: Favorite[]) => {
  const features: any[] = [];
  
  // 측정 결과를 GeoJSON 피처로 변환
  measurements.forEach((measurement, index) => {
    if (measurement.type === 'distance' && measurement.coordinates) {
      // 거리 측정은 LineString으로 변환
      features.push({
        type: 'Feature',
        properties: {
          id: `measurement_${index}`,
          type: 'distance',
          value: measurement.value,
          timestamp: measurement.timestamp,
          description: '거리 측정'
        },
        geometry: {
          type: 'LineString',
          coordinates: measurement.coordinates.map(coord => [coord[0], coord[1]])
        }
      });
    } else if (measurement.type === 'area' && measurement.coordinates) {
      // 면적 측정은 Polygon으로 변환
      features.push({
        type: 'Feature',
        properties: {
          id: `measurement_${index}`,
          type: 'area',
          value: measurement.value,
          timestamp: measurement.timestamp,
          description: '면적 측정'
        },
        geometry: {
          type: 'Polygon',
          coordinates: [measurement.coordinates.map(coord => [coord[0], coord[1]])]
        }
      });
    } else if ((measurement.type as string) === 'marker' && measurement.coordinates) {
      // 마커는 Point로 변환
      features.push({
        type: 'Feature',
        properties: {
          id: `measurement_${index}`,
          type: 'marker',
          value: measurement.value,
          timestamp: measurement.timestamp,
          description: '마커'
        },
        geometry: {
          type: 'Point',
          coordinates: [measurement.coordinates[0][0], measurement.coordinates[0][1]]
        }
      });
    }
  });
  
  // 즐겨찾기를 GeoJSON 피처로 변환
  favorites.forEach((favorite, index) => {
    features.push({
      type: 'Feature',
      properties: {
        id: `favorite_${index}`,
        type: 'favorite',
        name: favorite.name,
        addedAt: favorite.addedAt,
        description: '즐겨찾기 위치'
      },
      geometry: {
        type: 'Point',
        coordinates: [favorite.lon, favorite.lat]
      }
    });
  });
  
  const geojson = {
    type: 'FeatureCollection',
    properties: {
      name: 'WebGIS Export',
      description: 'WebGIS에서 내보낸 데이터',
      timestamp: new Date().toISOString(),
      totalMeasurements: measurements.length,
      totalFavorites: favorites.length
    },
    features
  };
  
  return geojson;
};

// CSV 형식으로 데이터 내보내기
export const exportToCSV = (measurements: MeasurementResult[], favorites: Favorite[]) => {
  let csv = 'Type,Value,Latitude,Longitude,Timestamp,Description\n';
  
  // 측정 결과 추가
  measurements.forEach(measurement => {
    if (measurement.coordinates && measurement.coordinates.length > 0) {
      const coord = measurement.coordinates[0];
      csv += `${measurement.type},${measurement.value},${coord[1]},${coord[0]},${new Date(measurement.timestamp).toISOString()},${measurement.type === 'distance' ? '거리 측정' : measurement.type === 'area' ? '면적 측정' : '마커'}\n`;
    }
  });
  
  // 즐겨찾기 추가
  favorites.forEach(favorite => {
    csv += `favorite,${favorite.name},${favorite.lat},${favorite.lon},${new Date(favorite.addedAt).toISOString()},즐겨찾기\n`;
  });
  
  return csv;
};

// 파일 다운로드 함수
export const downloadFile = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// JSON 형식으로 데이터 내보내기
export const exportToJSON = (measurements: MeasurementResult[], favorites: Favorite[]) => {
  const data = {
    metadata: {
      name: 'WebGIS Export',
      description: 'WebGIS에서 내보낸 데이터',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    },
    measurements,
    favorites,
    summary: {
      totalMeasurements: measurements.length,
      totalFavorites: favorites.length,
      measurementTypes: {
        distance: measurements.filter(m => m.type === 'distance').length,
        area: measurements.filter(m => m.type === 'area').length,
        marker: measurements.filter(m => (m.type as string) === 'marker').length
      }
    }
  };
  
  return JSON.stringify(data, null, 2);
};
