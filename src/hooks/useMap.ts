import { useEffect, useRef, useState, useCallback } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import { defaults as defaultControls, ScaleLine } from 'ol/control';
import { transformExtent } from 'ol/proj';
import { getDefaultMapConfig, getLayerUrls } from '../utils/mapUtils';
import { transformToWebMercator, transformToWGS84 } from '../utils/mapUtils';
import { LayerType } from '../types';

export const useMap = (mapId: string) => {
  const mapRef = useRef<Map | null>(null);
  const vectorSourceRef = useRef<VectorSource | null>(null);
  const [currentLayer, setCurrentLayer] = useState<LayerType>('osm');
  const [coordinates, setCoordinates] = useState<[number, number]>([127.7669, 37.5665]);

  // 지도 초기화
  const initializeMap = useCallback(() => {
    console.log('지도 초기화 시작:', mapId);
    
    if (mapRef.current) {
      console.log('지도가 이미 초기화되어 있습니다.');
      return mapRef.current;
    }

    const config = getDefaultMapConfig();
    const layerUrls = getLayerUrls();

    console.log('지도 설정:', config);

    // 기본 OSM 레이어
    const osmLayer = new TileLayer({
      source: new OSM()
    });

    // 위성 이미지 레이어
    const satelliteLayer = new TileLayer({
      source: new XYZ({
        url: layerUrls.satellite,
        crossOrigin: 'anonymous'
      }),
      visible: false
    });

    // 지형도 레이어
    const terrainLayer = new TileLayer({
      source: new XYZ({
        url: layerUrls.terrain,
        crossOrigin: 'anonymous'
      }),
      visible: false
    });

    // 벡터 소스 (측정, 마커 등)
    const vectorSource = new VectorSource();
    vectorSourceRef.current = vectorSource;

    const vectorLayer = new VectorLayer({
      source: vectorSource
    });

    // 지도 생성
    const map = new Map({
      target: mapId,
      layers: [osmLayer, satelliteLayer, terrainLayer, vectorLayer],
      view: new View({
        center: config.center,
        zoom: config.zoom,
        maxZoom: config.maxZoom,
        minZoom: config.minZoom
      }),
      controls: defaultControls({
        zoom: true,
        attribution: true
      }).extend([
        new ScaleLine({
          units: 'metric'
        })
      ])
    });

    // 레이어 참조 저장
    const layers = {
      osm: osmLayer,
      satellite: satelliteLayer,
      terrain: terrainLayer
    };

    // 마우스 이동 이벤트
    map.on('pointermove', (event) => {
      const coordinate = event.coordinate;
      const lonLat = transformToWGS84(coordinate[0], coordinate[1]);
      setCoordinates(lonLat);
    });

    mapRef.current = map;
    (mapRef.current as any).layers = layers;

    console.log('지도 초기화 완료');
    return map;
  }, [mapId]);

  // 레이어 전환
  const switchLayer = useCallback((layerType: LayerType) => {
    if (!mapRef.current) return;

    const map = mapRef.current;
    const layers = (map as any).layers;

    // 모든 레이어 숨기기
    Object.values(layers).forEach((layer: any) => {
      layer.setVisible(false);
    });

    // 선택된 레이어 보이기
    if (layers[layerType]) {
      layers[layerType].setVisible(true);
      setCurrentLayer(layerType);
    }
  }, []);

  // 줌 인
  const zoomIn = useCallback(() => {
    if (!mapRef.current) return;
    const view = mapRef.current.getView();
    const zoom = view.getZoom();
    if (zoom !== undefined) {
      view.animate({
        zoom: zoom + 1,
        duration: 250
      });
    }
  }, []);

  // 줌 아웃
  const zoomOut = useCallback(() => {
    if (!mapRef.current) return;
    const view = mapRef.current.getView();
    const zoom = view.getZoom();
    if (zoom !== undefined) {
      view.animate({
        zoom: zoom - 1,
        duration: 250
      });
    }
  }, []);

  // 전체 보기
  const fullExtent = useCallback(() => {
    if (!mapRef.current) return;
    const view = mapRef.current.getView();
    const extent4326 = [127.0, 37.0, 128.5, 38.0]; // 서울 지역
    const extent3857 = transformExtent(extent4326, 'EPSG:4326', 'EPSG:3857');
    view.fit(extent3857, {
      padding: [50, 50, 50, 50],
      duration: 1000
    });
  }, []);

  // 위치로 이동
  const goToLocation = useCallback((lat: number, lon: number) => {
    if (!mapRef.current) return;
    const coordinates = transformToWebMercator(lon, lat);
    mapRef.current.getView().animate({
      center: coordinates,
      zoom: 12,
      duration: 1000
    });
  }, []);

  // 컴포넌트 마운트 시 지도 초기화
  useEffect(() => {
    console.log('useMap useEffect 실행, mapId:', mapId);
    
    // DOM이 준비될 때까지 잠시 대기
    const timer = setTimeout(() => {
      const mapElement = document.getElementById(mapId);
      if (mapElement) {
        console.log('지도 요소 발견, 초기화 시작');
        const map = initializeMap();
        if (map) {
          console.log('지도 초기화 성공');
        }
      } else {
        console.error('지도 요소를 찾을 수 없습니다:', mapId);
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      if (mapRef.current) {
        console.log('지도 정리');
        mapRef.current.setTarget(undefined);
        mapRef.current = null;
      }
    };
  }, [mapId, initializeMap]);

  return {
    map: mapRef.current,
    vectorSource: vectorSourceRef.current,
    currentLayer,
    coordinates,
    switchLayer,
    zoomIn,
    zoomOut,
    fullExtent,
    goToLocation
  };
};
