import React, { useState, useRef, useEffect } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import VectorSource from 'ol/source/Vector';
import Draw from 'ol/interaction/Draw';
import { transform } from 'ol/proj';
import { getLength, getArea } from 'ol/sphere';
import { Style, Stroke, Fill, Circle } from 'ol/style';
import { LineString, Polygon } from 'ol/geom';
import 'ol/ol.css';
import './App.css';

// 타입 정의
interface SearchResult {
  place_id: string;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  importance: number;
}

interface Favorite {
  id: string;
  name: string;
  lat: number;
  lon: number;
  addedAt: string;
}

interface Measurement {
  type: 'distance' | 'area' | 'marker';
  value?: number;
  coordinates?: number[][];
  timestamp: string;
  text: string;
}

interface MultiPointMeasurement {
  id: string;
  type: 'distance' | 'area';
  points: Array<{
    name: string;
    lat: number;
    lon: number;
    pointType: 'start' | 'middle' | 'end';
  }>;
  value?: number;
  text: string;
  timestamp: string;
}

type LayerType = 'osm' | 'satellite' | 'terrain';
type ToolType = 'distance' | 'area' | 'marker' | null;

function App() {
  const [currentLayer, setCurrentLayer] = useState<LayerType>('osm');
  const [coordinates, setCoordinates] = useState<{ lat: number, lon: number, city: string }>({ lat: 37.5665, lon: 126.9780, city: '서울' });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [activeTool, setActiveTool] = useState<ToolType>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [previewText, setPreviewText] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(-1);

  // 다중 지점 측정 상태
  const [multiPointMode, setMultiPointMode] = useState(false);
  const [multiPointType, setMultiPointType] = useState<'distance' | 'area'>('distance');
  const [multiPointPoints, setMultiPointPoints] = useState<Array<{
    name: string;
    lat: number;
    lon: number;
    pointType: 'start' | 'middle' | 'end';
  }>>([]);
  const [currentPointType, setCurrentPointType] = useState<'start' | 'middle' | 'end'>('start');
  const [multiPointMeasurements, setMultiPointMeasurements] = useState<MultiPointMeasurement[]>([]);

  // 모달 상태
  const [showPointTypeModal, setShowPointTypeModal] = useState(false);
  const [selectedSearchResult, setSelectedSearchResult] = useState<SearchResult | null>(null);

  // 실시간 검색 상태
  const [isSearching, setIsSearching] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  // 사용자 행동 분석 상태
  const [userBehavior, setUserBehavior] = useState({
    searchHistory: [] as Array<{query: string, timestamp: string, count: number}>,
    favoriteLocations: [] as Array<{name: string, count: number}>,
    measurementHistory: [] as Array<{type: string, locations: string[], timestamp: string}>,
    recentSearches: [] as string[]
  });
  const [showPredictions, setShowPredictions] = useState(false);
  const [predictions, setPredictions] = useState<SearchResult[]>([]);
  const [cursorPredictions, setCursorPredictions] = useState<SearchResult[]>([]);
  const [showCursorPredictions, setShowCursorPredictions] = useState(false);

  // 모바일 햄버거 메뉴 상태
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // 사이드바 패널 상태
  const [showFavorites, setShowFavorites] = useState(false);
  const [showMeasurementHistory, setShowMeasurementHistory] = useState(false);
  
  // 햄버거 메뉴 토글
  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };
  
  // 모바일 메뉴 닫기
  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<Map | null>(null);
  const layersRef = useRef<{ [key in LayerType]: TileLayer<any> }>({} as any);
  const vectorSource = useRef<VectorSource | null>(null);
  const vectorLayer = useRef<VectorLayer<VectorSource> | null>(null);
  const drawInteraction = useRef<Draw | null>(null);
  const cursorPredictionTimeout = useRef<NodeJS.Timeout | null>(null);

  // 즐겨찾기 로컬 스토리지에서 로드
  useEffect(() => {
    const savedFavorites = localStorage.getItem('webgis-favorites');
    if (savedFavorites) {
      setFavorites(JSON.parse(savedFavorites));
    }
  }, []);

  // 즐겨찾기 로컬 스토리지에 저장
  useEffect(() => {
    localStorage.setItem('webgis-favorites', JSON.stringify(favorites));
  }, [favorites]);

  // 컴포넌트 언마운트 시 타임아웃 정리
  useEffect(() => {
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
      if (cursorPredictionTimeout.current) {
        clearTimeout(cursorPredictionTimeout.current);
      }
    };
  }, [searchTimeout]);

  // 사용자 행동 로컬 스토리지에서 로드
  useEffect(() => {
    const savedBehavior = localStorage.getItem('webgis-user-behavior');
    if (savedBehavior) {
      setUserBehavior(JSON.parse(savedBehavior));
    }
  }, []);

  // 사용자 행동 로컬 스토리지에 저장
  useEffect(() => {
    localStorage.setItem('webgis-user-behavior', JSON.stringify(userBehavior));
  }, [userBehavior]);

  // 검색 행동 추적
  const trackSearchBehavior = (query: string) => {
    setUserBehavior(prev => {
      const existingSearch = prev.searchHistory.find(s => s.query === query);
      const updatedHistory = existingSearch 
        ? prev.searchHistory.map(s => 
            s.query === query 
              ? { ...s, count: s.count + 1, timestamp: new Date().toISOString() }
              : s
          )
        : [...prev.searchHistory, { query, timestamp: new Date().toISOString(), count: 1 }];

      const recentSearches = [query, ...prev.recentSearches.filter(s => s !== query)].slice(0, 10);

      return {
        ...prev,
        searchHistory: updatedHistory.sort((a, b) => b.count - a.count).slice(0, 20),
        recentSearches
      };
    });
  };

  // 즐겨찾기 행동 추적
  const trackFavoriteBehavior = (locationName: string) => {
    setUserBehavior(prev => {
      const existingFavorite = prev.favoriteLocations.find(f => f.name === locationName);
      const updatedFavorites = existingFavorite
        ? prev.favoriteLocations.map(f => 
            f.name === locationName 
              ? { ...f, count: f.count + 1 }
              : f
          )
        : [...prev.favoriteLocations, { name: locationName, count: 1 }];

      return {
        ...prev,
        favoriteLocations: updatedFavorites.sort((a, b) => b.count - a.count).slice(0, 10)
      };
    });
  };

  // 측정 행동 추적
  const trackMeasurementBehavior = (type: string, locations: string[]) => {
    setUserBehavior(prev => ({
      ...prev,
      measurementHistory: [
        { type, locations, timestamp: new Date().toISOString() },
        ...prev.measurementHistory
      ].slice(0, 20)
    }));
  };

  // 예측 결과 생성
  const generatePredictions = async () => {
    const predictionQueries = [];
    
    // 최근 검색어 기반 예측
    if (userBehavior.recentSearches.length > 0) {
      predictionQueries.push(...userBehavior.recentSearches.slice(0, 3));
    }
    
    // 자주 검색하는 장소 기반 예측
    if (userBehavior.searchHistory.length > 0) {
      const topSearches = userBehavior.searchHistory.slice(0, 3);
      predictionQueries.push(...topSearches.map(s => s.query));
    }
    
    // 즐겨찾기 기반 예측
    if (userBehavior.favoriteLocations.length > 0) {
      const topFavorites = userBehavior.favoriteLocations.slice(0, 3);
      predictionQueries.push(...topFavorites.map(f => f.name));
    }
    
    // 측정 이력 기반 예측
    if (userBehavior.measurementHistory.length > 0) {
      const recentMeasurements = userBehavior.measurementHistory.slice(0, 2);
      recentMeasurements.forEach(m => {
        predictionQueries.push(...m.locations.slice(0, 2));
      });
    }
    
    // 중복 제거 및 상위 5개 선택
    const uniqueQueries = Array.from(new Set(predictionQueries)).slice(0, 5);
    
    // 예측 결과 가져오기
    const allPredictions: SearchResult[] = [];
    
    for (const query of uniqueQueries) {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`
        );
        const data = await response.json();
        if (data.length > 0) {
          allPredictions.push(data[0]);
        }
      } catch (error) {
        console.error('예측 검색 오류:', error);
      }
    }
    
    setPredictions(allPredictions);
    setShowPredictions(true);
  };

  // 커서 위치 기반 예측 생성
  const generateCursorPredictions = async (lat: number, lon: number) => {
    try {
      // 현재 커서 위치 주변의 장소들을 검색
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&limit=3`
      );
      const data = await response.json();
      
      if (data && data.display_name) {
        // 역지오코딩 결과를 기반으로 주변 장소 검색
        const nearbyResponse = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(data.display_name.split(',')[0])}&limit=3`
        );
        const nearbyData = await nearbyResponse.json();
        
        setCursorPredictions(nearbyData);
        setShowCursorPredictions(true);
      }
    } catch (error) {
      console.error('커서 예측 오류:', error);
    }
  };

  // 자동 예측 시스템 시작
  useEffect(() => {
    // 컴포넌트 마운트 시 자동으로 예측 시작
    generatePredictions();
    
    // 30초마다 예측 업데이트
    const interval = setInterval(() => {
      generatePredictions();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [userBehavior]);

  // 예측 결과 표시 토글 (더 이상 사용하지 않음)
  const togglePredictions = () => {
    if (showPredictions) {
      setShowPredictions(false);
    } else {
      generatePredictions();
    }
  };

  // 측정 스타일
  const createMeasureStyle = () => {
    return new Style({
      stroke: new Stroke({
        color: '#ff4444',
        width: 2
      }),
      fill: new Fill({
        color: 'rgba(255, 68, 68, 0.2)'
      }),
      image: new Circle({
        radius: 5,
        stroke: new Stroke({
          color: '#ff4444',
          width: 2
        }),
        fill: new Fill({
          color: '#ff4444'
        })
      })
    });
  };

  // 지도 초기화
  useEffect(() => {
    if (!mapRef.current) return;

    // 벡터 소스 (측정용)
    const source = new VectorSource();
    vectorSource.current = source;

    // 벡터 레이어
    const vector = new VectorLayer({
      source: source,
      style: createMeasureStyle()
    });
    vectorLayer.current = vector;

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

    layersRef.current = {
      osm: osmLayer,
      satellite: satelliteLayer,
      terrain: terrainLayer
    };

    // 지도 생성
    const map = new Map({
      target: mapRef.current,
      layers: [osmLayer, satelliteLayer, terrainLayer, vector],
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
      setCoordinates({ lat: coords[1], lon: coords[0], city: '서울' });
      
      // 커서 위치 기반 예측 (디바운스 적용)
      if (showCursorPredictions) {
        if (cursorPredictionTimeout.current) {
          clearTimeout(cursorPredictionTimeout.current);
        }
        cursorPredictionTimeout.current = setTimeout(() => {
          generateCursorPredictions(coords[1], coords[0]);
        }, 1000);
      }
    });

    return () => {
      if (mapInstance.current) {
        mapInstance.current.setTarget(undefined);
      }
    };
  }, []);

  // 모바일 터치 이벤트 최적화
  useEffect(() => {
    // 터치 디바이스 감지
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    if (isTouchDevice) {
      // 터치 디바이스에서 스크롤 성능 최적화
      (document.body.style as any).webkitOverflowScrolling = 'touch';
      
      // 줌 방지
      const preventZoom = (e: TouchEvent) => {
        if (e.touches.length > 1) {
          e.preventDefault();
        }
      };
      
      document.addEventListener('touchstart', preventZoom, { passive: false });
      
      return () => {
        document.removeEventListener('touchstart', preventZoom);
      };
    }
  }, []);

  // 레이어 전환
  useEffect(() => {
    if (!mapInstance.current) return;

    Object.entries(layersRef.current).forEach(([key, layer]) => {
      layer.setVisible(key === currentLayer);
    });
  }, [currentLayer]);

  // 키보드 단축키
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (activeTool) {
        switch (event.key) {
          case 'Enter':
            event.preventDefault();
            finishMeasurement();
            break;
          case 'Escape':
            event.preventDefault();
            cancelMeasurement();
            break;
          case 'Backspace':
            event.preventDefault();
            undoLastPoint();
            break;
        }
      }

      if (showSearchResults) {
        switch (event.key) {
          case 'ArrowDown':
            event.preventDefault();
            setSelectedIndex(prev => 
              prev < searchResults.length - 1 ? prev + 1 : prev
            );
            break;
          case 'ArrowUp':
            event.preventDefault();
            setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
            break;
          case 'Enter':
            event.preventDefault();
            if (selectedIndex >= 0 && searchResults[selectedIndex]) {
              openPointTypeModal(searchResults[selectedIndex]);
            }
            break;
          case 'Escape':
            event.preventDefault();
            setShowSearchResults(false);
            setSelectedIndex(-1);
            break;
        }
      }

      // 모달 닫기
      if (showPointTypeModal && event.key === 'Escape') {
        event.preventDefault();
        closePointTypeModal();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeTool, showSearchResults, searchResults, selectedIndex, showPointTypeModal]);

  // 다중 지점 측정 시작
  const startMultiPointMeasurement = (type: 'distance' | 'area') => {
    setMultiPointMode(true);
    setMultiPointType(type);
    setMultiPointPoints([]);
    setCurrentPointType('start');
    setActiveTool(null);
    setPreviewText(`${type === 'distance' ? '거리' : '면적'} 측정 모드 - 시작점을 검색하세요`);
  };

  // 다중 지점 측정 종료
  const cancelMultiPointMeasurement = () => {
    setMultiPointMode(false);
    setMultiPointPoints([]);
    setCurrentPointType('start');
    setPreviewText('');
    clearMeasurements();
  };

  // 다중 지점 측정 완료
  const finishMultiPointMeasurement = () => {
    if (multiPointPoints.length < 2) {
      setPreviewText('최소 2개 지점이 필요합니다.');
      return;
    }

    // 측정 계산
    let value: number;
    let text: string;

    if (multiPointType === 'distance') {
      // 거리 계산 (모든 구간의 합)
      value = 0;
      for (let i = 0; i < multiPointPoints.length - 1; i++) {
        const start = multiPointPoints[i];
        const end = multiPointPoints[i + 1];
        const start3857 = transform([start.lon, start.lat], 'EPSG:4326', 'EPSG:3857');
        const end3857 = transform([end.lon, end.lat], 'EPSG:4326', 'EPSG:3857');
        const line = new LineString([start3857, end3857]);
        const distance = getLength(line);
        value += distance;
      }
      text = `총 거리: ${(value / 1000).toFixed(2)}km`;
    } else {
      // 면적 계산 (다각형)
      const coordinates = multiPointPoints.map(point => 
        transform([point.lon, point.lat], 'EPSG:4326', 'EPSG:3857')
      );
      // 다각형을 닫기 위해 첫 번째 점을 마지막에 추가
      coordinates.push(coordinates[0]);
      const polygon = new Polygon([coordinates]);
      value = getArea(polygon);
      text = `총 면적: ${(value / 1000000).toFixed(2)}km²`;
    }

    // 측정 결과 저장
    const measurement: MultiPointMeasurement = {
      id: Date.now().toString(),
      type: multiPointType,
      points: [...multiPointPoints],
      value: value,
      text: text,
      timestamp: new Date().toISOString()
    };

    setMultiPointMeasurements(prev => [...prev, measurement]);
    setPreviewText(text);
    
    // 측정 행동 추적
    trackMeasurementBehavior(multiPointType, multiPointPoints.map(p => p.name));
    
    // 모드 종료
    setMultiPointMode(false);
    setMultiPointPoints([]);
    setCurrentPointType('start');
  };

  // 검색 결과를 다중 지점 측정에 추가
  const addToMultiPointMeasurement = (result: SearchResult, pointType: 'start' | 'middle' | 'end') => {
    const newPoint = {
      name: result.display_name.split(',')[0],
      lat: parseFloat(result.lat),
      lon: parseFloat(result.lon),
      pointType: pointType
    };

    setMultiPointPoints(prev => [...prev, newPoint]);
    
    // 지도에서 해당 위치로 이동
    if (mapInstance.current) {
      const coords = transform([newPoint.lon, newPoint.lat], 'EPSG:4326', 'EPSG:3857');
      mapInstance.current.getView().animate({
        center: coords,
        zoom: 12,
        duration: 1000
      });
    }

    // 다음 지점 타입 설정
    if (pointType === 'start') {
      setCurrentPointType('middle');
      setPreviewText(`${multiPointType === 'distance' ? '거리' : '면적'} 측정 - 중간지점을 검색하세요 (또는 끝점으로 완료)`);
    } else if (pointType === 'middle') {
      setCurrentPointType('end');
      setPreviewText(`${multiPointType === 'distance' ? '거리' : '면적'} 측정 - 끝점을 검색하세요 (또는 더 많은 중간지점 추가)`);
    } else {
      // 끝점이면 측정 완료
      finishMultiPointMeasurement();
    }
  };

  // 모달 열기
  const openPointTypeModal = (result: SearchResult) => {
    setSelectedSearchResult(result);
    setShowPointTypeModal(true);
  };

  // 모달 닫기
  const closePointTypeModal = () => {
    setShowPointTypeModal(false);
    setSelectedSearchResult(null);
  };

  // 지점 타입 선택
  const selectPointType = (pointType: 'start' | 'middle' | 'end') => {
    if (selectedSearchResult) {
      addToMultiPointMeasurement(selectedSearchResult, pointType);
      closePointTypeModal();
    }
  };

  // 일반 위치 이동 (모달 없이)
  const moveToLocation = (result: SearchResult) => {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);
    setCoordinates({ lat, lon, city: '서울' });
    setSearchQuery(result.display_name.split(',')[0]);
    setShowSearchResults(false);
    setSelectedIndex(-1);

    // 지도에서 해당 위치로 이동
    if (mapInstance.current) {
      const coords = transform([lon, lat], 'EPSG:4326', 'EPSG:3857');
      mapInstance.current.getView().animate({
        center: coords,
        zoom: 12,
        duration: 1000
      });
    }
  };

  // 즐겨찾기 추가
  const addToFavorites = (result: SearchResult) => {
    const newFavorite: Favorite = {
      id: result.place_id,
      name: result.display_name.split(',')[0],
      lat: parseFloat(result.lat),
      lon: parseFloat(result.lon),
      addedAt: new Date().toISOString()
    };

    setFavorites(prev => {
      const exists = prev.find(f => f.id === newFavorite.id);
      if (exists) return prev;
      return [...prev, newFavorite];
    });

    // 즐겨찾기 행동 추적
    trackFavoriteBehavior(newFavorite.name);
  };

  // 즐겨찾기 제거
  const removeFavorite = (favorite: Favorite) => {
    setFavorites(prev => prev.filter(f => f.id !== favorite.id));
  };

  // 즐겨찾기 클릭
  const handleFavoriteClick = (favorite: Favorite) => {
    setCoordinates({ lat: favorite.lat, lon: favorite.lon, city: '서울' });
    if (mapInstance.current) {
      const coords = transform([favorite.lon, favorite.lat], 'EPSG:4326', 'EPSG:3857');
      mapInstance.current.getView().animate({
        center: coords,
        zoom: 12,
        duration: 1000
      });
    }
  };

  // 데이터 내보내기
  const exportData = () => {
    const data = {
      measurements: measurements,
      multiPointMeasurements: multiPointMeasurements,
      favorites: favorites,
      exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `webgis-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 측정 완료
  const finishMeasurement = () => {
    if (drawInteraction.current && mapInstance.current) {
      // Draw 인터랙션을 강제로 완료
      mapInstance.current.removeInteraction(drawInteraction.current);
      drawInteraction.current = null;
      setActiveTool(null);
    }
  };

  // 측정 취소
  const cancelMeasurement = () => {
    if (drawInteraction.current && mapInstance.current) {
      mapInstance.current.removeInteraction(drawInteraction.current);
      drawInteraction.current = null;
      setActiveTool(null);
      setPreviewText('');
    }
  };

  // 마지막 점 되돌리기
  const undoLastPoint = () => {
    if (vectorSource.current) {
      const features = vectorSource.current.getFeatures();
      if (features.length > 0) {
        vectorSource.current.removeFeature(features[features.length - 1]);
      }
    }
  };

  // 측정 도구 활성화
  const activateTool = (tool: ToolType) => {
    // 기존 측정 도구 비활성화
    if (drawInteraction.current && mapInstance.current) {
      mapInstance.current.removeInteraction(drawInteraction.current);
      drawInteraction.current = null;
    }

    setActiveTool(activeTool === tool ? null : tool);

    if (tool && mapInstance.current) {
      let geometryType: 'Point' | 'LineString' | 'Polygon';
      
      switch (tool) {
        case 'distance':
          geometryType = 'LineString';
          break;
        case 'area':
          geometryType = 'Polygon';
          break;
        case 'marker':
          geometryType = 'Point';
          break;
        default:
          return;
      }

      // Draw 인터랙션 생성
      const draw = new Draw({
        source: vectorSource.current!,
        type: geometryType,
        style: createMeasureStyle()
      });

      // 측정 시작
      draw.on('drawstart', () => {
        setPreviewText('측정 중...');
      });

      // 측정 완료
      draw.on('drawend', (event) => {
        const feature = event.feature;
        const geometry = feature.getGeometry();
        
        if (!geometry) return;

        let value: number;
        let text: string;

        if (tool === 'distance') {
          // 거리 측정
          value = getLength(geometry);
          text = `거리: ${(value / 1000).toFixed(2)}km`;
        } else if (tool === 'area') {
          // 면적 측정
          value = getArea(geometry);
          text = `면적: ${(value / 1000000).toFixed(2)}km²`;
        } else {
          // 마커
          const coords = (geometry as any).getCoordinates();
          const wgs84Coords = transform(coords, 'EPSG:3857', 'EPSG:4326');
          value = 0;
          text = `마커: ${wgs84Coords[1].toFixed(4)}, ${wgs84Coords[0].toFixed(4)}`;
        }

        // 측정 결과 저장
        const measurement: Measurement = {
          type: tool,
          value: value,
          coordinates: (geometry as any).getCoordinates(),
          timestamp: new Date().toISOString(),
          text: text
        };

        setMeasurements(prev => [...prev, measurement]);
        setPreviewText(text);
        setActiveTool(null);

        // Draw 인터랙션 제거
        if (mapInstance.current) {
          mapInstance.current.removeInteraction(draw);
        }
      });

      drawInteraction.current = draw;
      mapInstance.current.addInteraction(draw);
    }
  };

  // 측정 초기화
  const clearMeasurements = () => {
    if (vectorSource.current) {
      vectorSource.current.clear();
    }
    setMeasurements([]);
    setMultiPointMeasurements([]);
    setActiveTool(null);
    setPreviewText('');
    
    // Draw 인터랙션 제거
    if (drawInteraction.current && mapInstance.current) {
      mapInstance.current.removeInteraction(drawInteraction.current);
      drawInteraction.current = null;
    }
  };

  // 검색 기능
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5`
      );
      const data = await response.json();
      setSearchResults(data);
      setShowSearchResults(true);
      setSelectedIndex(-1);
    } catch (error) {
      console.error('검색 오류:', error);
    }
  };

  // 실시간 검색 (디바운스 적용)
  const handleRealTimeSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`
      );
      const data = await response.json();
      setSearchResults(data);
      setShowSearchResults(true);
      setSelectedIndex(-1);
      
      // 검색 행동 추적
      trackSearchBehavior(query);
    } catch (error) {
      console.error('실시간 검색 오류:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // 디바운스된 실시간 검색
  const debouncedSearch = (query: string) => {
    // 기존 타임아웃 취소
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // 새로운 타임아웃 설정 (500ms 후 검색 실행)
    const timeout = setTimeout(() => {
      handleRealTimeSearch(query);
    }, 500);

    setSearchTimeout(timeout);
  };

  // 검색 결과 클릭
  const handleResultClick = (result: SearchResult) => {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);
    setCoordinates({ lat, lon, city: '서울' });
    setSearchQuery(result.display_name.split(',')[0]);
    setShowSearchResults(false);
    setSelectedIndex(-1);

    // 지도에서 해당 위치로 이동
    if (mapInstance.current) {
      const coords = transform([lon, lat], 'EPSG:4326', 'EPSG:3857');
      mapInstance.current.getView().animate({
        center: coords,
        zoom: 12,
        duration: 1000
      });
    }
  };

  // 레이어 변경
  const handleLayerChange = (layer: LayerType) => {
    setCurrentLayer(layer);
  };

  // 테마 토글
  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  // 지도 컨트롤 함수들
  const zoomIn = () => {
    if (mapInstance.current) {
      const view = mapInstance.current.getView();
      const zoom = view.getZoom();
      if (zoom !== undefined) {
        view.animate({
          zoom: zoom + 1,
          duration: 250
        });
      }
    }
  };

  const zoomOut = () => {
    if (mapInstance.current) {
      const view = mapInstance.current.getView();
      const zoom = view.getZoom();
      if (zoom !== undefined) {
        view.animate({
          zoom: zoom - 1,
          duration: 250
        });
      }
    }
  };

  const goToHome = () => {
    if (mapInstance.current) {
      mapInstance.current.getView().animate({
        center: transform([126.9780, 37.5665], 'EPSG:4326', 'EPSG:3857'),
        zoom: 10,
        duration: 1000
      });
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      mapRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <div className="App" data-theme={theme}>
      <div className="container">
        {/* 헤더 */}
        <header className="header">
          <div className="header-left">
            <h1>🌐 WebGIS 지도 서비스</h1>
          </div>
          
          <div className="header-center">
            <div className="search-container">
              <input
                type="text"
                placeholder="도시나 나라를 검색하세요..."
                className="search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !multiPointMode) {
                    handleSearch();
                  }
                }}
              />
              <button
                className="search-btn"
                onClick={() => !multiPointMode && handleSearch()}
                disabled={multiPointMode}
              >
                🔍
              </button>
              <button className="theme-toggle" onClick={toggleTheme}>
                {theme === 'light' ? '☀️' : '🌙'}
              </button>
            </div>
          </div>
          
          <div className="header-right">
            <div className="controls">
              <button className="control-btn" onClick={goToHome} title="전체 영역">🏠</button>
              <button className="control-btn" onClick={toggleFullscreen} title="전체 화면">⛶</button>
              <select
                value={currentLayer}
                onChange={(e) => handleLayerChange(e.target.value as LayerType)}
                className="layer-select"
                aria-label="지도 레이어 선택"
              >
                <option value="osm">OpenStreetMap</option>
                <option value="satellite">위성 이미지</option>
                <option value="terrain">지형도</option>
              </select>
            </div>
            
            {/* 햄버거 메뉴 버튼 (모바일) */}
            <button className="hamburger-menu" onClick={toggleMobileMenu} title="메뉴 열기/닫기">
              <span className={`hamburger-line ${isMobileMenuOpen ? 'open' : ''}`}></span>
              <span className={`hamburger-line ${isMobileMenuOpen ? 'open' : ''}`}></span>
              <span className={`hamburger-line ${isMobileMenuOpen ? 'open' : ''}`}></span>
            </button>
          </div>
        </header>

        {/* 메인 콘텐츠 */}
        <main className="main-content">
          {/* 지도 컨테이너 */}
          <div className="map-container" ref={mapRef}>
            {/* 모바일 지도 컨트롤 */}
            <div className="mobile-map-controls">
              <button 
                className="mobile-map-control-btn" 
                onClick={zoomIn}
                title="확대"
              >
                ➕
              </button>
              <button 
                className="mobile-map-control-btn" 
                onClick={zoomOut}
                title="축소"
              >
                ➖
              </button>
              <button 
                className="mobile-map-control-btn" 
                onClick={goToHome}
                title="전체 영역"
              >
                🏠
              </button>
              <button 
                className="mobile-map-control-btn" 
                onClick={toggleFullscreen}
                title="전체 화면"
              >
                ⛶
              </button>
            </div>
            
            {/* 좌표 표시 */}
            <div className="coordinates">
              좌표: {coordinates.lat.toFixed(4)}, {coordinates.lon.toFixed(4)} ({coordinates.city})
            </div>
          </div>

          {/* 사이드바 (데스크톱에서만 표시) */}
          <aside className="sidebar">
            {/* 정보 패널 */}
            <div className="info-panel">
              <h3>ℹ️ 정보</h3>
              <p>OpenLayers 기반 WebGIS입니다. 검색, 거리/면적 측정, 마커, 즐겨찾기, 테마를 제공합니다.</p>
              <div className="features">
                <div>🔍 검색·즐겨찾기 및 키보드 탐색</div>
                <div>📏/📐 지오데식 계산·구간 배지·방위각 지원</div>
                <div>📍 마커 · 🗑️ 초기화 · 💾 데이터 내보내기</div>
                <div>🌓 라이트/다크 · ⛶ 전체 화면</div>
              </div>
              <div className="tech-info">
                <div>Geocoding: Nominatim (OSM)</div>
                <div>Projection: EPSG:3857</div>
                <div>Coords: WGS84</div>
              </div>
            </div>

            {/* 도구 패널 */}
            <div className="tools-panel">
              <h3>🛠️ 도구</h3>
              <button className="tool-btn" onClick={() => activateTool('distance')}>
                📏 거리 측정
              </button>
              <button className="tool-btn" onClick={() => activateTool('area')}>
                📐 면적 측정
              </button>
              <button className="tool-btn" onClick={() => activateTool('marker')}>
                📍 마커 추가
              </button>
              <button className="tool-btn" onClick={() => startMultiPointMeasurement('distance')}>
                🎯 다중 지점 거리 측정
              </button>
              <button className="tool-btn" onClick={() => startMultiPointMeasurement('area')}>
                🎯 다중 지점 면적 측정
              </button>
              <button className="tool-btn" onClick={clearMeasurements}>
                🗑️ 모두 지우기
              </button>
              <button className="tool-btn" onClick={exportData}>
                💾 데이터 내보내기
              </button>
            </div>

            {/* 측정 설정 패널 */}
            <div className="measurement-panel">
              <h3>⚙️ 측정 설정</h3>
              <div className="setting-item">
                <span>지오데식 계산(타원체)</span>
              </div>
              <div className="setting-item">
                <span>구간 길이 배지 표시</span>
              </div>
              <div className="setting-item">
                <span>마지막 구간 방위각 표시</span>
              </div>
              <button className="tool-btn" onClick={undoLastPoint}>
                ↩️ 마지막 점 취소
              </button>
            </div>

            {/* 즐겨찾기 패널 */}
            {showFavorites && (
              <div className="favorites-panel">
                <h3>⭐ 즐겨찾기 ({favorites.length}개)</h3>
                <div className="favorites-list">
                  {favorites.length === 0 ? (
                    <div className="empty-state">즐겨찾기가 없습니다.</div>
                  ) : (
                    favorites.map((favorite, index) => (
                      <div key={index} className="favorite-item" onClick={() => handleFavoriteClick(favorite)}>
                        <div className="favorite-name">{favorite.name}</div>
                        <button 
                          className="favorite-remove" 
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFavorite(favorite);
                          }}
                        >
                          ✖
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* 측정 결과 패널 */}
            {showMeasurementHistory && (
              <div className="measurement-panel">
                <h3>📊 측정 결과</h3>
                <div className="measure-history-list">
                  {measurements.length === 0 ? (
                    <div className="empty-state">측정 도구를 사용하여 결과를 확인하세요.</div>
                  ) : (
                    measurements.map((measurement, index) => (
                      <div key={index} className="measurement-result">
                        <div className="result-text">
                          {measurement.type === 'distance' && `거리: ${(measurement as any).distance / 1000}km`}
                          {measurement.type === 'area' && `면적: ${(measurement as any).area / 1000000}km²`}
                          {measurement.type === 'marker' && `마커: ${(measurement.coordinates || []).join(', ')}`}
                        </div>
                        <div className="result-actions">
                          <button className="inline-btn" onClick={() => {
                            const newMeasurements = measurements.filter((_, i) => i !== index);
                            setMeasurements(newMeasurements);
                          }}>
                            ✖
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="measurement-actions">
                  <button className="inline-btn" onClick={finishMeasurement}>✅ 완료</button>
                  <button className="inline-btn" onClick={cancelMeasurement}>✖ 취소</button>
                  <button className="inline-btn" onClick={clearMeasurements}>↺ 초기화</button>
                </div>
              </div>
            )}

            {/* 측정 이력 패널 */}
            <div className="measurement-panel">
              <h3>🧭 측정 이력 ({measurements.length}개)</h3>
              <div className="measure-history-list">
                {measurements.length === 0 ? (
                  <div className="empty-state">측정 이력이 없습니다.</div>
                ) : (
                  measurements.map((measurement, index) => (
                    <div key={index} className="history-item">
                      <div className="history-text">
                        {measurement.type === 'distance' && `거리: ${((measurement as any).distance / 1000).toFixed(2)}km`}
                        {measurement.type === 'area' && `면적: ${((measurement as any).area / 1000000).toFixed(2)}km²`}
                        {measurement.type === 'marker' && `마커: ${(measurement.coordinates || []).join(', ')}`}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 범례 패널 */}
            <div className="legend-panel">
              <h3>🎨 범례</h3>
              <div className="legend-item">
                <span className="legend-color distance-color"></span>
                <span>거리 측정</span>
              </div>
              <div className="legend-item">
                <span className="legend-color area-color"></span>
                <span>면적 측정</span>
              </div>
              <div className="legend-item">
                <span className="legend-color marker-color"></span>
                <span>마커</span>
              </div>
            </div>

            {/* 도움말 패널 */}
            <div className="help-panel">
              <h3>📘 사용 방법</h3>
              <div className="help-section">
                <h4>🔍 검색</h4>
                <ul>
                  <li>검색창에 도시/나라를 입력하면 실시간으로 검색 결과가 표시됩니다</li>
                  <li>검색 버튼을 누르지 않아도 자동으로 추천 결과가 나타납니다</li>
                  <li>결과 항목 클릭: 모달이 나타나 지점 타입을 선택할 수 있습니다</li>
                  <li>🧠 개인화된 추천: 사용자의 검색 이력, 즐겨찾기, 측정 패턴을 분석하여 맞춤형 추천을 제공합니다</li>
                </ul>
              </div>
              <div className="help-section">
                <h4>⌨️ 단축키</h4>
                <table className="help-table">
                  <tbody>
                    <tr><td>Enter</td><td>측정 완료</td></tr>
                    <tr><td>Esc</td><td>측정 취소/닫기</td></tr>
                    <tr><td>Backspace</td><td>마지막 점 되돌리기</td></tr>
                    <tr><td>↑/↓</td><td>검색 결과 이동</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </aside>
        </main>
        
        {/* 검색 결과 */}
        {showSearchResults && (
          <div className="search-results">
            {isSearching ? (
              <div className="search-loading">
                <div className="loading-spinner"></div>
                <span>검색 중...</span>
              </div>
            ) : searchResults.length > 0 ? (
              searchResults.map((result, index) => (
                <div
                  key={index}
                  className={`search-result-item ${index === selectedIndex ? 'selected' : ''}`}
                  onClick={() => openPointTypeModal(result)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="result-content">
                    <div className="result-name">{result.display_name.split(',')[0]}</div>
                    <div className="result-details">
                      {result.display_name.split(',').slice(1, 3).join(',')}
                    </div>
                  </div>
                  <div className="result-actions">
                    <button 
                      className="favorite-button" 
                      title="즐겨찾기 추가"
                      onClick={(e) => {
                        e.stopPropagation();
                        addToFavorites(result);
                      }}
                    >
                      ⭐
                    </button>
                    {multiPointMode ? (
                      <button 
                        className="measure-button" 
                        title={`${currentPointType === 'start' ? '시작점' : currentPointType === 'middle' ? '중간지점' : '끝점'}으로 설정`}
                        onClick={(e) => {
                          e.stopPropagation();
                          openPointTypeModal(result);
                        }}
                      >
                        {currentPointType === 'start' ? '🚀' : currentPointType === 'middle' ? '📍' : '🏁'}
                      </button>
                    ) : (
                      <button 
                        className="measure-button" 
                        title="거리 측정 시작"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleResultClick(result);
                          activateTool('distance');
                        }}
                      >
                        📏
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="no-results">
                <span>검색 결과가 없습니다.</span>
              </div>
            )}
          </div>
        )}
        
        {/* 예측 결과 */}
        {showPredictions && predictions.length > 0 && (
          <div className="predictions-container">
            <div className="predictions-header">
              <h4>🧠 개인화된 추천</h4>
              <button className="close-predictions" onClick={() => setShowPredictions(false)}>
                ✖
              </button>
            </div>
            <div className="predictions-list">
              {predictions.map((result, index) => (
                <div
                  key={`prediction-${index}`}
                  className="prediction-item"
                  onClick={() => openPointTypeModal(result)}
                >
                  <div className="prediction-content">
                    <div className="prediction-name">{result.display_name.split(',')[0]}</div>
                    <div className="prediction-details">
                      {result.display_name.split(',').slice(1, 3).join(',')}
                    </div>
                    <div className="prediction-badge">추천</div>
                  </div>
                  <div className="prediction-actions">
                    <button 
                      className="favorite-button" 
                      title="즐겨찾기 추가"
                      onClick={(e) => {
                        e.stopPropagation();
                        addToFavorites(result);
                      }}
                    >
                      ⭐
                    </button>
                    <button 
                      className="measure-button" 
                      title="위치로 이동"
                      onClick={(e) => {
                        e.stopPropagation();
                        moveToLocation(result);
                        setShowPredictions(false);
                      }}
                    >
                      🗺️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 커서 위치 기반 예측 결과 */}
        {showCursorPredictions && cursorPredictions.length > 0 && (
          <div className="predictions-container cursor-predictions">
            <div className="predictions-header">
              <h4>📍 커서 위치 기반 추천</h4>
              <button className="close-predictions" onClick={() => setShowCursorPredictions(false)}>
                ✖
              </button>
            </div>
            <div className="predictions-list">
              {cursorPredictions.map((result, index) => (
                <div
                  key={`cursor-prediction-${index}`}
                  className="prediction-item"
                  onClick={() => openPointTypeModal(result)}
                >
                  <div className="prediction-content">
                    <div className="prediction-name">{result.display_name.split(',')[0]}</div>
                    <div className="prediction-details">
                      {result.display_name.split(',').slice(1, 3).join(',')}
                    </div>
                    <div className="prediction-badge">커서</div>
                  </div>
                  <div className="prediction-actions">
                    <button 
                      className="favorite-button" 
                      title="즐겨찾기 추가"
                      onClick={(e) => {
                        e.stopPropagation();
                        addToFavorites(result);
                      }}
                    >
                      ⭐
                    </button>
                    <button 
                      className="measure-button" 
                      title="위치로 이동"
                      onClick={(e) => {
                        e.stopPropagation();
                        moveToLocation(result);
                        setShowCursorPredictions(false);
                      }}
                    >
                      🗺️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* 모바일 햄버거 메뉴 */}
        <div className={`mobile-menu ${isMobileMenuOpen ? 'open' : ''}`}>
          <div className="mobile-menu-header">
            <h3>메뉴</h3>
            <button className="close-mobile-menu" onClick={closeMobileMenu}>
              ✖
            </button>
          </div>
          <div className="mobile-menu-content">
            {/* 정보 섹션 */}
            <div className="mobile-menu-section">
              <h4>ℹ️ 정보</h4>
              <div className="mobile-info-text">
                OpenLayers 기반 WebGIS입니다. 검색, 거리/면적 측정, 마커, 즐겨찾기, 테마를 제공합니다.
              </div>
              <div className="mobile-features">
                <div className="feature-item">🔍 검색·즐겨찾기 및 키보드 탐색</div>
                <div className="feature-item">📏/📐 지오데식 계산·구간 배지·방위각 지원</div>
                <div className="feature-item">📍 마커 · 🗑️ 초기화 · 💾 데이터 내보내기</div>
                <div className="feature-item">🌓 라이트/다크 · ⛶ 전체 화면</div>
              </div>
              <div className="mobile-tech-info">
                <div className="tech-item">Geocoding: Nominatim (OSM)</div>
                <div className="tech-item">Projection: EPSG:3857</div>
                <div className="tech-item">Coords: WGS84</div>
              </div>
            </div>
            
            {/* 사용 방법 섹션 */}
            <div className="mobile-menu-section">
              <h4>📘 사용 방법</h4>
              
              <div className="usage-subsection">
                <h5>🔍 검색</h5>
                <ul className="usage-list">
                  <li>검색창에 도시/나라를 입력하면 실시간으로 검색 결과가 표시됩니다</li>
                  <li>검색 버튼을 누르지 않아도 자동으로 추천 결과가 나타납니다</li>
                  <li>결과 항목 클릭: 모달이 나타나 지점 타입을 선택할 수 있습니다</li>
                  <li>🧠 개인화된 추천: 사용자의 검색 이력, 즐겨찾기, 측정 패턴을 분석하여 맞춤형 추천을 제공합니다</li>
                </ul>
                <div className="result-buttons-info">
                  결과 우측 버튼:
                  <ul>
                    <li>⭐ 즐겨찾기 추가</li>
                    <li>📏 스마트 거리 측정 시작</li>
                    <li>📐 스마트 면적 측정 시작</li>
                  </ul>
                </div>
              </div>
              
              <div className="usage-subsection">
                <h5>🧠 개인화된 추천 시스템</h5>
                <ul className="usage-list">
                  <li>검색 패턴 분석: 자주 검색하는 장소를 기억하고 추천</li>
                  <li>즐겨찾기 기반: 즐겨찾기한 장소들을 추천 목록에 포함</li>
                  <li>측정 이력 분석: 측정에 사용한 장소들을 기반으로 추천</li>
                  <li>실시간 학습: 사용자의 행동을 실시간으로 학습하여 더 정확한 추천 제공</li>
                  <li>개인정보 보호: 모든 데이터는 로컬에 저장되어 안전하게 보호됩니다</li>
                </ul>
              </div>
              
              <div className="usage-subsection">
                <h5>🎯 다중 지점 측정</h5>
                <ul className="usage-list">
                  <li>🚀 시작점: 첫 번째 검색 결과를 시작점으로 설정</li>
                  <li>📍 중간지점: 두 번째 검색 결과를 중간지점으로 설정 (선택사항)</li>
                  <li>🏁 끝점: 마지막 검색 결과를 끝점으로 설정</li>
                  <li>거리 측정: 모든 구간의 총 거리 계산</li>
                  <li>면적 측정: 다각형 면적 계산</li>
                  <li>새로운 기능: 검색 결과 클릭 시 모달이 나타나 지점 타입을 선택할 수 있습니다</li>
                </ul>
              </div>
              
              <div className="usage-subsection">
                <h5>📏 거리 측정</h5>
                <ul className="usage-list">
                  <li>좌측 패널의 "📏 거리 측정" 클릭 → 지도에서 점을 순서대로 클릭</li>
                  <li>끝점 근처에 전체 거리 툴팁, 마지막 선분 중앙에 구간 거리 배지 표시</li>
                  <li>Enter: 측정 완료, Esc: 측정 취소, Backspace: 마지막 점 되돌리기</li>
                  <li>스마트 거리: 검색 결과 클릭 또는 📏 버튼으로 시작점 자동 설정 → 지도 클릭으로 지점 추가 → 더블클릭으로 완료</li>
                </ul>
              </div>
              
              <div className="usage-subsection">
                <h5>📐 면적 측정</h5>
                <ul className="usage-list">
                  <li>좌측 패널의 "📐 면적 측정" 클릭 → 지도에서 다각형을 그려 면적 계산</li>
                </ul>
              </div>
              
              <div className="usage-subsection">
                <h5>📍 마커/데이터</h5>
                <ul className="usage-list">
                  <li>📍 마커 추가: 지도 클릭 위치에 임시 마커</li>
                  <li>🗑️ 모두 지우기: 모든 측정/마커 초기화</li>
                  <li>💾 데이터 내보내기: 측정 결과를 GeoJSON 유사 포맷으로 다운로드</li>
                </ul>
              </div>
              
              <div className="usage-subsection">
                <h5>🖥️ UI/환경</h5>
                <ul className="usage-list">
                  <li>🌓 테마 토글: 라이트/다크 전환</li>
                  <li>⛶ 전체 화면: 브라우저 전체 화면 토글</li>
                  <li>레이어 선택: OSM/위성/지형도 전환</li>
                </ul>
              </div>
              
              <div className="usage-subsection">
                <h5>⌨️ 단축키</h5>
                <div className="shortcuts-table">
                  <div className="shortcut-row">
                    <span className="shortcut-key">Enter</span>
                    <span className="shortcut-desc">측정 완료</span>
                  </div>
                  <div className="shortcut-row">
                    <span className="shortcut-key">Esc</span>
                    <span className="shortcut-desc">측정 취소/닫기</span>
                  </div>
                  <div className="shortcut-row">
                    <span className="shortcut-key">Backspace</span>
                    <span className="shortcut-desc">마지막 점 되돌리기</span>
                  </div>
                  <div className="shortcut-row">
                    <span className="shortcut-key">↑/↓</span>
                    <span className="shortcut-desc">검색 결과 이동</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* 도구 섹션 */}
            <div className="mobile-menu-section">
              <h4>🛠️ 도구</h4>
              <button className="mobile-menu-btn" onClick={() => { activateTool('distance'); closeMobileMenu(); }}>
                📏 거리 측정
              </button>
              <button className="mobile-menu-btn" onClick={() => { activateTool('area'); closeMobileMenu(); }}>
                📐 면적 측정
              </button>
              <button className="mobile-menu-btn" onClick={() => { activateTool('marker'); closeMobileMenu(); }}>
                📍 마커 추가
              </button>
              <button className="mobile-menu-btn" onClick={() => { startMultiPointMeasurement('distance'); closeMobileMenu(); }}>
                🎯 다중 지점 거리 측정
              </button>
              <button className="mobile-menu-btn" onClick={() => { startMultiPointMeasurement('area'); closeMobileMenu(); }}>
                🎯 다중 지점 면적 측정
              </button>
              <button className="mobile-menu-btn" onClick={() => { clearMeasurements(); closeMobileMenu(); }}>
                🗑️ 모두 지우기
              </button>
              <button className="mobile-menu-btn" onClick={() => { exportData(); closeMobileMenu(); }}>
                💾 데이터 내보내기
              </button>
            </div>
            
            {/* 지도 컨트롤 섹션 */}
            <div className="mobile-menu-section">
              <h4>🗺️ 지도</h4>
              <button className="mobile-menu-btn" onClick={() => { zoomIn(); closeMobileMenu(); }}>
                ➕ 확대
              </button>
              <button className="mobile-menu-btn" onClick={() => { zoomOut(); closeMobileMenu(); }}>
                ➖ 축소
              </button>
              <button className="mobile-menu-btn" onClick={() => { goToHome(); closeMobileMenu(); }}>
                🏠 전체 영역
              </button>
              <button className="mobile-menu-btn" onClick={() => { toggleFullscreen(); closeMobileMenu(); }}>
                ⛶ 전체 화면
              </button>
            </div>
            
            {/* 즐겨찾기 섹션 */}
            <div className="mobile-menu-section">
              <h4>⭐ 즐겨찾기 ({favorites.length}개)</h4>
              <button className="mobile-menu-btn" onClick={() => { setShowFavorites(!showFavorites); closeMobileMenu(); }}>
                {showFavorites ? '숨기기' : '보기'}
              </button>
              {favorites.length === 0 && (
                <div className="mobile-empty-state">
                  즐겨찾기가 없습니다.
                </div>
              )}
            </div>
            
            {/* 측정 기록 섹션 */}
            <div className="mobile-menu-section">
              <h4>📊 측정 결과</h4>
              <button className="mobile-menu-btn" onClick={() => { setShowMeasurementHistory(!showMeasurementHistory); closeMobileMenu(); }}>
                {showMeasurementHistory ? '숨기기' : '보기'}
              </button>
              {measurements.length === 0 && (
                <div className="mobile-empty-state">
                  측정 도구를 사용하여 결과를 확인하세요.
                </div>
              )}
            </div>
            
            {/* 측정 이력 섹션 */}
            <div className="mobile-menu-section">
              <h4>🧭 측정 이력 ({measurements.length}개)</h4>
              {measurements.length === 0 && (
                <div className="mobile-empty-state">
                  측정 이력이 없습니다.
                </div>
              )}
            </div>
            
            {/* 범례 섹션 */}
            <div className="mobile-menu-section">
              <h4>🎨 범례</h4>
              <div className="legend-item">
                <span className="legend-color distance-color"></span>
                <span>거리 측정</span>
              </div>
              <div className="legend-item">
                <span className="legend-color area-color"></span>
                <span>면적 측정</span>
              </div>
              <div className="legend-item">
                <span className="legend-color marker-color"></span>
                <span>마커</span>
              </div>
            </div>
            
            {/* 문제 해결 팁 섹션 */}
            <div className="mobile-menu-section">
              <h4>🔧 문제 해결 팁</h4>
              <div className="troubleshooting-tips">
                <div className="tip-item">• 지도가 로드되지 않으면 새로고침해보세요</div>
                <div className="tip-item">• 측정이 안 될 때는 도구를 다시 선택해보세요</div>
                <div className="tip-item">• 검색이 안 될 때는 인터넷 연결을 확인해보세요</div>
                <div className="tip-item">• 전체 화면이 안 될 때는 브라우저 설정을 확인해보세요</div>
              </div>
            </div>
          </div>
        </div>
        
        {/* 모바일 메뉴 오버레이 */}
        {isMobileMenuOpen && (
          <div className="mobile-menu-overlay" onClick={closeMobileMenu}></div>
        )}
      </div>

      {/* 다중 지점 측정 모달 */}
      {showPointTypeModal && selectedSearchResult && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>지점 타입 선택</h3>
            <p>검색 결과 "{selectedSearchResult.display_name}"을 어떻게 사용하시겠습니까?</p>
            <div className="modal-buttons">
              <button className="modal-btn" onClick={() => selectPointType('start')}>
                🚀 시작점
              </button>
              <button className="modal-btn" onClick={() => selectPointType('middle')}>
                📍 중간지점
              </button>
              <button className="modal-btn" onClick={() => selectPointType('end')}>
                🏁 끝점
              </button>
              <button className="modal-btn secondary" onClick={() => {
                moveToLocation(selectedSearchResult);
                closePointTypeModal();
              }}>
                🗺️ 위치로 이동
              </button>
              <button className="modal-btn secondary" onClick={closePointTypeModal}>
                ✖ 취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
