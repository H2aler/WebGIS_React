import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import VectorSource from 'ol/source/Vector';
import { transform } from 'ol/proj';
import { LayerType } from '../../types';
import './WebGISMap.css';

export interface WebGISMapRef {
  switchLayer: (layer: LayerType) => void;
  goToLocation: (lat: number, lon: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  goToHome: () => void;
  toggleFullscreen: () => void;
}

export interface WebGISMapProps {
  currentLayer: LayerType;
  onCoordinatesUpdate?: (coords: [number, number]) => void;
  vectorSource?: React.RefObject<VectorSource>;
}

const WebGISMap = forwardRef<WebGISMapRef, WebGISMapProps>(
  ({ currentLayer, onCoordinatesUpdate, vectorSource }, ref) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<Map | null>(null);
    const layersRef = useRef<{ [key in LayerType]: TileLayer<any> }>({} as any);
    const vectorLayerRef = useRef<VectorLayer<VectorSource> | null>(null);

    // 레이어 초기화
    useEffect(() => {
      if (!mapRef.current) return;

      // OSM 레이어
      const osmLayer = new TileLayer({
        source: new OSM()
      });

      // 위성 이미지 레이어
      const satelliteLayer = new TileLayer({
        source: new XYZ({
          url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
          crossOrigin: 'anonymous'
        }),
        visible: false
      });

      // 지형도 레이어
      const terrainLayer = new TileLayer({
        source: new XYZ({
          url: 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
          crossOrigin: 'anonymous'
        }),
        visible: false
      });

      // 벡터 레이어 (측정용)
      const vectorLayer = new VectorLayer({
        source: vectorSource?.current || new VectorSource(),
        style: () => {
          // 기본 스타일 (나중에 구현)
          return undefined;
        }
      });

      layersRef.current = {
        osm: osmLayer,
        satellite: satelliteLayer,
        terrain: terrainLayer
      };
      vectorLayerRef.current = vectorLayer;

      // 지도 생성
      const map = new Map({
        target: mapRef.current,
        layers: [osmLayer, satelliteLayer, terrainLayer, vectorLayer],
        view: new View({
          center: transform([126.9780, 37.5665], 'EPSG:4326', 'EPSG:3857'),
          zoom: 10,
          maxZoom: 19,
          minZoom: 3
        }),
        controls: []
      });

      mapInstance.current = map;

      // 마우스 이동 이벤트
      map.on('pointermove', (event) => {
        const coords = transform(event.coordinate, 'EPSG:3857', 'EPSG:4326');
        onCoordinatesUpdate?.([coords[0], coords[1]]);
      });

      return () => {
        if (mapInstance.current) {
          mapInstance.current.setTarget(undefined);
        }
      };
    }, [onCoordinatesUpdate, vectorSource]);

    // 레이어 전환
    useEffect(() => {
      if (!mapInstance.current) return;

      Object.entries(layersRef.current).forEach(([key, layer]) => {
        layer.setVisible(key === currentLayer);
      });
    }, [currentLayer]);

    // 외부에서 호출할 수 있는 메서드들
    useImperativeHandle(ref, () => ({
      switchLayer: (layer: LayerType) => {
        Object.entries(layersRef.current).forEach(([key, layerInstance]) => {
          layerInstance.setVisible(key === layer);
        });
      },

      goToLocation: (lat: number, lon: number) => {
        if (!mapInstance.current) return;
        const coords = transform([lon, lat], 'EPSG:4326', 'EPSG:3857');
        mapInstance.current.getView().animate({
          center: coords,
          zoom: 12,
          duration: 1000
        });
      },

      zoomIn: () => {
        if (!mapInstance.current) return;
        const view = mapInstance.current.getView();
        const zoom = view.getZoom();
        if (zoom !== undefined) {
          view.animate({
            zoom: zoom + 1,
            duration: 250
          });
        }
      },

      zoomOut: () => {
        if (!mapInstance.current) return;
        const view = mapInstance.current.getView();
        const zoom = view.getZoom();
        if (zoom !== undefined) {
          view.animate({
            zoom: zoom - 1,
            duration: 250
          });
        }
      },

      goToHome: () => {
        if (!mapInstance.current) return;
        mapInstance.current.getView().animate({
          center: transform([126.9780, 37.5665], 'EPSG:4326', 'EPSG:3857'),
          zoom: 10,
          duration: 1000
        });
      },

      toggleFullscreen: () => {
        if (!document.fullscreenElement) {
          mapRef.current?.requestFullscreen();
        } else {
          document.exitFullscreen();
        }
      }
    }));

    return (
      <div ref={mapRef} className="map" />
    );
  }
);

WebGISMap.displayName = 'WebGISMap';

export default WebGISMap;
