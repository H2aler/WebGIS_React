import { useState, useCallback, useRef, useEffect } from 'react';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import { Point, LineString, Polygon } from 'ol/geom';
import { Style, Circle, Stroke, Fill } from 'ol/style';
import { transform } from 'ol/proj';
import { MeasurementResult, ToolType } from '../types';
import { calculateDistance, calculateArea, formatDistance, formatArea } from '../utils/measurementUtils';

export const useMeasurement = (vectorSource: VectorSource | null) => {
  const [activeTool, setActiveTool] = useState<ToolType>(null);
  const [measurements, setMeasurements] = useState<MeasurementResult[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentCoordinates, setCurrentCoordinates] = useState<number[][]>([]);
  const [previewFeature, setPreviewFeature] = useState<Feature | null>(null);
  const [previewText, setPreviewText] = useState<string>('');
  
  const mapRef = useRef<any>(null);
  const clickListenerRef = useRef<any>(null);
  const moveListenerRef = useRef<any>(null);

  // 측정 도구 비활성화
  const deactivateTool = useCallback(() => {
    setActiveTool(null);
    setIsDrawing(false);
    setCurrentCoordinates([]);
    setPreviewFeature(null);
    setPreviewText('');
    
    // 이벤트 리스너 제거
    if (clickListenerRef.current && mapRef.current) {
      mapRef.current.un('click', clickListenerRef.current);
      clickListenerRef.current = null;
    }
    if (moveListenerRef.current && mapRef.current) {
      mapRef.current.un('pointermove', moveListenerRef.current);
      moveListenerRef.current = null;
    }
  }, []);

  // 측정 도구 활성화
  const activateTool = useCallback((tool: ToolType) => {
    if (activeTool === tool) {
      // 같은 도구 클릭 시 비활성화
      deactivateTool();
      return;
    }

    setActiveTool(tool);
    setIsDrawing(false);
    setCurrentCoordinates([]);
    setPreviewFeature(null);
    setPreviewText('');

    if (tool === 'distance' || tool === 'area') {
      setIsDrawing(true);
    }
  }, [activeTool, deactivateTool]);

  // 미리보기 피처 제거
  const removePreviewFeature = useCallback(() => {
    if (previewFeature && vectorSource) {
      vectorSource.removeFeature(previewFeature);
      setPreviewFeature(null);
    }
  }, [previewFeature, vectorSource]);

  // 선 그리기
  const drawLine = useCallback((coordinates: number[][]) => {
    if (!vectorSource) return;

    const transformedCoords = coordinates.map(coord => 
      transform(coord, 'EPSG:4326', 'EPSG:3857')
    );

    const lineString = new LineString(transformedCoords);
    const feature = new Feature(lineString);
    
    feature.setStyle(new Style({
      stroke: new Stroke({
        color: '#ff0000',
        width: 3
      })
    }));

    vectorSource.addFeature(feature);
  }, [vectorSource]);

  // 다각형 그리기
  const drawPolygon = useCallback((coordinates: number[][]) => {
    if (!vectorSource) return;

    const transformedCoords = coordinates.map(coord => 
      transform(coord, 'EPSG:4326', 'EPSG:3857')
    );

    const polygon = new Polygon([transformedCoords]);
    const feature = new Feature(polygon);
    
    feature.setStyle(new Style({
      stroke: new Stroke({
        color: '#ff0000',
        width: 2
      }),
      fill: new Fill({
        color: 'rgba(255, 0, 0, 0.1)'
      })
    }));

    vectorSource.addFeature(feature);
  }, [vectorSource]);

  // 미리보기 업데이트
  const updatePreview = useCallback((coordinates: number[][], mouseCoord?: number[]) => {
    if (!vectorSource || !isDrawing) return;

    // 기존 미리보기 제거
    removePreviewFeature();

    if (coordinates.length === 0) return;

    let previewCoords = [...coordinates];
    if (mouseCoord && activeTool === 'distance' && coordinates.length === 1) {
      previewCoords = [...coordinates, mouseCoord];
    } else if (mouseCoord && activeTool === 'area' && coordinates.length >= 1) {
      previewCoords = [...coordinates, mouseCoord];
    }

    if (previewCoords.length < 2) return;

    let feature: Feature;
    let text = '';

    if (activeTool === 'distance' && previewCoords.length >= 2) {
      const distance = calculateDistance(previewCoords);
      text = formatDistance(distance);
      
      const transformedCoords = previewCoords.map(coord => 
        transform(coord, 'EPSG:4326', 'EPSG:3857')
      );
      
      const lineString = new LineString(transformedCoords);
      feature = new Feature(lineString);
      
      feature.setStyle(new Style({
        stroke: new Stroke({
          color: '#ff6b6b',
          width: 2,
          lineDash: [5, 5]
        })
      }));
    } else if (activeTool === 'area' && previewCoords.length >= 3) {
      const area = calculateArea(previewCoords);
      text = formatArea(area);
      
      const transformedCoords = previewCoords.map(coord => 
        transform(coord, 'EPSG:4326', 'EPSG:3857')
      );
      
      const polygon = new Polygon([transformedCoords]);
      feature = new Feature(polygon);
      
      feature.setStyle(new Style({
        stroke: new Stroke({
          color: '#ff6b6b',
          width: 2,
          lineDash: [5, 5]
        }),
        fill: new Fill({
          color: 'rgba(255, 107, 107, 0.1)'
        })
      }));
    } else {
      return;
    }

    vectorSource.addFeature(feature);
    setPreviewFeature(feature);
    setPreviewText(text);
  }, [vectorSource, isDrawing, activeTool, removePreviewFeature]);

  // 거리 측정 처리
  const handleDistanceMeasurement = useCallback(() => {
    if (currentCoordinates.length < 2) return;

    const distance = calculateDistance(currentCoordinates);
    const formattedDistance = formatDistance(distance);
    
    const measurement: MeasurementResult = {
      type: 'distance',
      value: distance,
      text: formattedDistance,
      coordinates: [...currentCoordinates],
      timestamp: new Date().toISOString()
    };

    setMeasurements(prev => [...prev, measurement]);
    
    // 선 그리기
    drawLine(currentCoordinates);
    
    // 측정 완료 후 초기화
    setCurrentCoordinates([]);
    setActiveTool(null);
    setIsDrawing(false);
    setPreviewFeature(null);
    setPreviewText('');
  }, [currentCoordinates, drawLine]);

  // 면적 측정 처리
  const handleAreaMeasurement = useCallback(() => {
    if (currentCoordinates.length < 3) return;

    const area = calculateArea(currentCoordinates);
    const formattedArea = formatArea(area);
    
    const measurement: MeasurementResult = {
      type: 'area',
      value: area,
      text: formattedArea,
      coordinates: [...currentCoordinates],
      timestamp: new Date().toISOString()
    };

    setMeasurements(prev => [...prev, measurement]);
    
    // 다각형 그리기
    drawPolygon(currentCoordinates);
    
    // 측정 완료 후 초기화
    setCurrentCoordinates([]);
    setActiveTool(null);
    setIsDrawing(false);
    setPreviewFeature(null);
    setPreviewText('');
  }, [currentCoordinates, drawPolygon]);

  // 지도 클릭 이벤트 처리
  const handleMapClick = useCallback((event: any) => {
    if (!isDrawing || !vectorSource) return;

    const coordinate = event.coordinate;
    const lonLat = transform(coordinate, 'EPSG:3857', 'EPSG:4326');
    
    const newCoordinates = [...currentCoordinates, [lonLat[0], lonLat[1]]];
    setCurrentCoordinates(newCoordinates);

    if (activeTool === 'distance' && newCoordinates.length >= 2) {
      handleDistanceMeasurement();
    } else if (activeTool === 'area' && newCoordinates.length >= 3) {
      handleAreaMeasurement();
    } else {
      // 미리보기 업데이트
      updatePreview(newCoordinates);
    }
  }, [isDrawing, vectorSource, currentCoordinates, activeTool, handleDistanceMeasurement, handleAreaMeasurement, updatePreview]);

  // 마커 추가
  const addMarker = useCallback((coordinate: [number, number], name?: string) => {
    if (!vectorSource) return;

    const transformedCoord = transform(coordinate, 'EPSG:4326', 'EPSG:3857');
    const point = new Point(transformedCoord);
    const feature = new Feature(point);
    
    feature.setStyle(new Style({
      image: new Circle({
        radius: 8,
        fill: new Fill({
          color: '#ff0000'
        }),
        stroke: new Stroke({
          color: '#ffffff',
          width: 2
        })
      })
    }));

    if (name) {
      feature.set('name', name);
    }

    vectorSource.addFeature(feature);
  }, [vectorSource]);

  // 모든 측정 결과 삭제
  const clearMeasurements = useCallback(() => {
    if (!vectorSource) return;
    
    vectorSource.clear();
    setMeasurements([]);
    setCurrentCoordinates([]);
    setIsDrawing(false);
    setActiveTool(null);
    setPreviewFeature(null);
    setPreviewText('');
  }, [vectorSource]);

  // 지도 참조 설정
  const setMap = useCallback((map: any) => {
    mapRef.current = map;
  }, []);

  // 이벤트 리스너 설정
  const setupEventListeners = useCallback(() => {
    if (!mapRef.current) return;

    // 기존 리스너 제거
    if (clickListenerRef.current) {
      mapRef.current.un('click', clickListenerRef.current);
    }
    if (moveListenerRef.current) {
      mapRef.current.un('pointermove', moveListenerRef.current);
    }

    // 클릭 이벤트
    clickListenerRef.current = handleMapClick;
    mapRef.current.on('click', clickListenerRef.current);

    // 마우스 이동 이벤트 (실시간 미리보기)
    moveListenerRef.current = (event: any) => {
      if (!isDrawing || currentCoordinates.length === 0) return;

      const coordinate = event.coordinate;
      const lonLat = transform(coordinate, 'EPSG:3857', 'EPSG:4326');
      
      updatePreview(currentCoordinates, [lonLat[0], lonLat[1]]);
    };

    mapRef.current.on('pointermove', moveListenerRef.current);
  }, [handleMapClick, isDrawing, currentCoordinates, updatePreview]);

  // 지도가 설정되면 이벤트 리스너 설정
  useEffect(() => {
    if (mapRef.current) {
      setupEventListeners();
    }
  }, [setupEventListeners]);

  // 측정 도구 상태 변경 시 이벤트 리스너 재설정
  useEffect(() => {
    if (mapRef.current && (isDrawing || activeTool)) {
      setupEventListeners();
    }
  }, [isDrawing, activeTool, setupEventListeners]);

  return {
    activeTool,
    measurements,
    isDrawing,
    currentCoordinates,
    previewText,
    activateTool,
    deactivateTool,
    addMarker,
    clearMeasurements,
    setMap,
    setupEventListeners
  };
};
