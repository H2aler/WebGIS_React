import 'ol/ol.css';
import './styles.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import { fromLonLat, transform, transformExtent } from 'ol/proj';
import { defaults as defaultControls, Zoom, ScaleLine } from 'ol/control';
import { Point, LineString, Polygon } from 'ol/geom';
import { Feature } from 'ol';
import { Style, Icon, Stroke, Fill, Circle as CircleStyle, Text } from 'ol/style';
import { Draw, Modify, Snap } from 'ol/interaction';
import { getLength, getArea } from 'ol/sphere';
import { unByKey } from 'ol/Observable';
import Overlay from 'ol/Overlay';

// 지도 초기화
class WebGISMap {
    constructor() {
        this.map = null;
        this.vectorSource = new VectorSource();
        this.vectorLayer = new VectorLayer({
            source: this.vectorSource,
            style: (feature) => this.getFeatureStyle(feature)
        });
        
        this.draw = null;
        this.snap = null;
        this.modify = null;
        this.currentTool = null;
        this.measurementListener = null;
        this.clickListener = null;
        this.measurementFeatures = [];
        this.measurementResults = [];
        this.measurementHistory = [];
        this.searchResults = [];
        this.distanceOverlay = null;
        this.currentDistanceFeature = null;
    // 측정 오버레이들
        this.liveTooltipOverlay = null; // 전체 길이 툴팁
        this.segmentOverlay = null;     // 마지막 구간 배지(수동 모드)
        // 스마트 거리 측정 상태
        this.smartDistanceActive = false;
        this.smartStartCoord = null; // EPSG:3857
        this.smartCoords = [];
        this.smartLineFeature = null;
        this.smartClickKey = null;
        this.smartDblKey = null;
        this.smartSegmentOverlay = null; // 스마트 모드 구간 배지

        // 멀티-스마트 거리 측정 (검색 결과 간 경로)
        this.multiRouteActive = false;
        this.routeCoords = []; // EPSG:3857 좌표 배열
        this.routeLineFeature = null;
        
        this.initMap();
        this.initControls();
        this.initSearch();
        this.initTheme();
        this.initEventListeners();
        this.renderFavorites();
        this.bindFullscreen();
        this.bindMeasureButtons();
    }

    // 지도 초기화
    initMap() {
        // 기본 OSM 레이어
        const osmLayer = new TileLayer({
            source: new OSM(),
            title: 'OpenStreetMap'
        });

        // 위성 이미지 레이어
        const satelliteLayer = new TileLayer({
            source: new XYZ({
                url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                crossOrigin: 'anonymous'
            }),
            title: '위성 이미지',
            visible: false
        });

        // 지형도 레이어
        const terrainLayer = new TileLayer({
            source: new XYZ({
                url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
                crossOrigin: 'anonymous'
            }),
            title: '지형도',
            visible: false
        });

        this.layers = {
            osm: osmLayer,
            satellite: satelliteLayer,
            terrain: terrainLayer
        };

        // 지도 생성
        this.map = new Map({
            target: 'map',
            layers: [osmLayer, satelliteLayer, terrainLayer, this.vectorLayer],
            view: new View({
                center: fromLonLat([127.7669, 37.5665]), // 서울 중심
                zoom: 10,
                maxZoom: 19,
                minZoom: 3
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

        // 좌표 표시 이벤트
        this.map.on('pointermove', (event) => {
            const coordinate = event.coordinate;
            const lonLat = transform(coordinate, 'EPSG:3857', 'EPSG:4326');
            document.getElementById('coordinates').innerHTML = 
                `경도: ${lonLat[0].toFixed(6)}<br>위도: ${lonLat[1].toFixed(6)}`;
        });

        // 지도 클릭 이벤트 (마커 추가용)
        this.map.on('click', (event) => {
            if (this.currentTool === 'marker') {
                this.addMarker(event.coordinate);
                this.deactivateCurrentTool();
                document.getElementById('addMarker').classList.remove('active');
            }
        });
    }

    // 컨트롤 초기화
    initControls() {
        // 줌 컨트롤
        document.getElementById('zoomIn').addEventListener('click', () => {
            const view = this.map.getView();
            const zoom = view.getZoom();
            view.animate({
                zoom: zoom + 1,
                duration: 250
            });
        });

        document.getElementById('zoomOut').addEventListener('click', () => {
            const view = this.map.getView();
            const zoom = view.getZoom();
            view.animate({
                zoom: zoom - 1,
                duration: 250
            });
        });

        document.getElementById('fullExtent').addEventListener('click', () => {
            const extent4326 = [127.0, 37.0, 128.5, 38.0];
            const extent3857 = transformExtent(extent4326, 'EPSG:4326', 'EPSG:3857');
            this.map.getView().fit(extent3857, {
                padding: [50, 50, 50, 50],
                duration: 1000
            });
            this.toast('전체 영역으로 이동했습니다.');
        });

        // 레이어 선택
        document.getElementById('layerSelect').addEventListener('change', (event) => {
            this.switchLayer(event.target.value);
            this.toast(`레이어 전환: ${event.target.value}`);
        });
    }

    // 검색 기능 초기화
    initSearch() {
        const searchInput = document.getElementById('searchInput');
        const searchBtn = document.getElementById('searchBtn');
        const searchResults = document.getElementById('searchResults');
        let activeIndex = -1;

        // 검색 버튼 클릭
        searchBtn.addEventListener('click', () => {
            this.performSearch(searchInput.value);
        });

        // 엔터키 검색
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performSearch(searchInput.value);
            }
        });

        // 입력 시 자동 검색 (디바운싱)
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                if (e.target.value.length >= 2) {
                    this.performSearch(e.target.value);
                } else {
                    this.hideSearchResults();
                }
            }, 300);
        });

        // 검색 결과 외부 클릭 시 숨기기
        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !searchBtn.contains(e.target) && !searchResults.contains(e.target)) {
                this.hideSearchResults();
            }
        });

        // 키보드 탐색
        searchInput.addEventListener('keydown', (e) => {
            const items = Array.from(searchResults.querySelectorAll('.search-result-item'));
            if (!items.length) return;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                activeIndex = (activeIndex + 1) % items.length;
                this.updateActiveSearchItem(items, activeIndex);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                activeIndex = (activeIndex - 1 + items.length) % items.length;
                this.updateActiveSearchItem(items, activeIndex);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (activeIndex >= 0) {
                    items[activeIndex].querySelector('.search-result-content').click();
                } else if (searchBtn) {
                    searchBtn.click();
                }
            } else if (e.key === 'Escape') {
                this.hideSearchResults();
            }
        });
    }

    updateActiveSearchItem(items, index) {
        items.forEach(el => el.classList.remove('active'));
        if (items[index]) {
            items[index].classList.add('active');
            items[index].scrollIntoView({ block: 'nearest' });
        }
    }

    async performSearch(query) {
        if (!query.trim()) {
            this.hideSearchResults();
            return;
        }

        try {
            console.log('🔍 검색 시작:', query);
            
            // 로딩 상태 표시
            this.showSearchLoading();
            
            // Nominatim API를 사용한 지오코딩
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1&countrycodes=kr,jp,cn,us,gb,fr,de,it,es,ca,au`;
            console.log('📡 API 요청 URL:', url);
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'WebGIS-Application/1.0'
                }
            });
            
            console.log('📥 응답 상태:', response.status, response.statusText);
            
            if (!response.ok) {
                throw new Error(`검색 요청 실패: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            console.log('✅ 검색 결과:', data);

            this.searchResults = data;
            this.displaySearchResults(data);
        } catch (error) {
            console.error('❌ 검색 오류:', error);
            this.showSearchError(`검색 중 오류가 발생했습니다: ${error.message}`);
        }
    }

    displaySearchResults(results) {
        const searchResults = document.getElementById('searchResults');
        
        if (!results || results.length === 0) {
            searchResults.innerHTML = '<div class="search-result-item no-results">🔍 검색 결과가 없습니다.</div>';
            searchResults.classList.add('show');
            return;
        }

        console.log('📋 검색 결과 표시:', results.length, '개');

        const headerHTML = `
            <div class="results-header">
                <div class="results-meta">결과 ${results.length}건</div>
                <div class="results-actions">
                    <button id="clearResults">지우기</button>
                </div>
            </div>
        `;

        const resultsHTML = results.map((result, index) => {
            const name = result.display_name.split(',')[0];
            const details = result.display_name.split(',').slice(1, 3).join(',');
            
            return `
                <div class="search-result-item" data-lat="${result.lat}" data-lon="${result.lon}" data-index="${index}">
                    <div class="search-result-content">
                        <div class="search-result-name">📍 ${name}</div>
                        <div class="search-result-details">${details}</div>
                    </div>
                    <div class="search-result-actions">
                        <button class="favorite-btn" title="즐겨찾기에 추가" data-index="${index}">⭐</button>
                        <button class="smart-measure-btn" title="스마트 거리 측정" data-index="${index}" data-type="distance">📏</button>
                        <button class="smart-measure-btn" title="스마트 면적 측정" data-index="${index}" data-type="area">📐</button>
                    </div>
                </div>
            `;
        }).join('');

        searchResults.innerHTML = headerHTML + resultsHTML;
        searchResults.classList.add('show');

        const clearBtn = document.getElementById('clearResults');
        if (clearBtn) clearBtn.addEventListener('click', () => this.hideSearchResults());

        // 검색 결과 클릭 이벤트 (콘텐츠 영역)
        searchResults.querySelectorAll('.search-result-item .search-result-content').forEach(content => {
            content.addEventListener('click', (e) => {
                const parent = content.closest('.search-result-item');
                const lat = parseFloat(parent.dataset.lat);
                const lon = parseFloat(parent.dataset.lon);
                const index = parseInt(parent.dataset.index);
                // 스마트 거리 측정 시작점으로 설정
                this.startSmartDistanceFrom(lat, lon);
                this.hideSearchResults();
                document.getElementById('searchInput').value = content.querySelector('.search-result-name').textContent.replace('📍 ', '');
            });
        });

        // 즐겨찾기 버튼 이벤트
        searchResults.querySelectorAll('.favorite-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.index);
                this.addToFavorites(results[index]);
            });
        });

        // 스마트 측정 버튼 이벤트
        searchResults.querySelectorAll('.smart-measure-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.index);
                const type = btn.dataset.type;
                const res = results[index];
                const name = res.display_name.split(',')[0];
                if (type === 'distance') {
                    this.handleMultiSmartDistanceClick(parseFloat(res.lat), parseFloat(res.lon), name);
                } else {
                    this.activateTool('area');
                    document.getElementById('measurementResult').innerHTML = `<div class="measurement-guide">🎯 스마트 면적 측정: "${name}" 기준으로 지도에서 다각형을 그리세요.</div>`;
                }
            });
        });
    }

    // 즐겨찾기 관리
    addToFavorites(result) {
        const name = result.display_name.split(',')[0];
        const item = {
            id: Date.now().toString(),
            name,
            lat: parseFloat(result.lat),
            lon: parseFloat(result.lon),
            addedAt: new Date().toISOString()
        };
        const list = this.getFavorites();
        const exists = list.some(f => f.lat === item.lat && f.lon === item.lon);
        if (exists) return;
        list.push(item);
        localStorage.setItem('favorites', JSON.stringify(list));
        this.renderFavorites();
    }

    getFavorites() {
        try {
            return JSON.parse(localStorage.getItem('favorites')) || [];
        } catch (_) { return []; }
    }

    removeFavorite(id) {
        const list = this.getFavorites().filter(f => f.id !== id);
        localStorage.setItem('favorites', JSON.stringify(list));
        this.renderFavorites();
    }

    renderFavorites() {
        const container = document.getElementById('favoritesList');
        const list = this.getFavorites();
        if (!container) return;
        if (list.length === 0) {
            container.innerHTML = '<div class="empty">즐겨찾기가 없습니다.</div>';
            return;
        }
        container.innerHTML = list.map(item => `
            <div class="favorite-item">
                <div class="favorite-name">📍 ${item.name}</div>
                <div class="favorite-actions">
                    <button class="go-favorite" data-id="${item.id}" data-lat="${item.lat}" data-lon="${item.lon}">이동</button>
                    <button class="remove-favorite" data-id="${item.id}">삭제</button>
                </div>
            </div>
        `).join('');
        container.querySelectorAll('.go-favorite').forEach(btn => {
            btn.addEventListener('click', () => {
                const lat = parseFloat(btn.dataset.lat);
                const lon = parseFloat(btn.dataset.lon);
                this.goToLocation(lat, lon);
            });
        });
        container.querySelectorAll('.remove-favorite').forEach(btn => {
            btn.addEventListener('click', () => this.removeFavorite(btn.dataset.id));
        });
    }

    // 테마 토글
    initTheme() {
        const btn = document.getElementById('themeToggle');
        const saved = localStorage.getItem('theme') || 'light';
        document.documentElement.dataset.theme = saved;
        if (btn) {
            btn.addEventListener('click', () => {
                const next = (document.documentElement.dataset.theme === 'light') ? 'dark' : 'light';
                document.documentElement.dataset.theme = next;
                localStorage.setItem('theme', next);
            });
        }
    }

    // 스마트 거리 측정: 검색 결과 지점을 시작점으로 설정하고, 사용자가 추가 클릭한 지점까지 누적 거리 계산
    startSmartDistanceFrom(lat, lon) {
        // 시작점 표시 및 지도 이동
        const start3857 = transform([lon, lat], 'EPSG:4326', 'EPSG:3857');
        this.goToLocation(lat, lon);

        // 상태 초기화
        this.smartDistanceActive = true;
        this.smartStartCoord = start3857;
        this.smartCoords = [start3857];

        // 기존 라인 제거
        if (this.smartLineFeature) {
            this.vectorSource.removeFeature(this.smartLineFeature);
            this.smartLineFeature = null;
        }

        // 안내 메시지
        document.getElementById('measurementResult').innerHTML =
            '<div class="measurement-guide">시작점이 설정되었습니다. 지도를 클릭해 지점을 추가하세요. 더블클릭으로 측정을 완료합니다.</div>';

        // 지도 클릭으로 지점 추가
        if (this.smartClickKey) this.map.un('click', this.smartClickKey);
        this.smartClickKey = this.map.on('click', (evt) => {
            if (!this.smartDistanceActive) return;
            const coord = evt.coordinate;
            this.smartCoords.push(coord);
            this.updateSmartDistanceLine();
        });

        // 더블클릭으로 완료
        if (this.smartDblKey) this.map.un('dblclick', this.smartDblKey);
        this.smartDblKey = this.map.on('dblclick', (evt) => {
            if (!this.smartDistanceActive) return;
            evt.preventDefault?.();
            this.finishSmartDistance();
        });
    }

    // 멀티-스마트: 검색 결과 지점 간 경로 누적
    handleMultiSmartDistanceClick(lat, lon, name) {
        const coord3857 = transform([lon, lat], 'EPSG:4326', 'EPSG:3857');
        // 경로 시작이 아니면 중간/마지막 선택
        if (!this.multiRouteActive) {
            this.multiRouteActive = true;
            this.routeCoords = [coord3857];
            this.toast(`시작점: ${name}`);
            document.getElementById('measurementResult').innerHTML = '<div class="measurement-guide">다음 검색 결과의 📏을 눌러 중간 또는 마지막 구간을 선택하세요.</div>';
            return;
        }

        // 지도 위 선택 패널 표시
        const panel = document.getElementById('routeChoice');
        const nameEl = document.getElementById('routeChoiceName');
        const addMid = document.getElementById('routeAddMid');
        const addLast = document.getElementById('routeAddLast');
        const cancelBtn = document.getElementById('routeCancelChoice');
        nameEl.textContent = name;
        panel.style.display = 'block';
        // 검색창 우측으로 위치 이동
        const searchEl = document.querySelector('.search-container');
        if (searchEl) {
            const rect = searchEl.getBoundingClientRect();
            panel.style.top = `${rect.top + rect.height + 8}px`;
            panel.style.left = `${rect.right + 8}px`;
        }

        const onChooseMid = () => {
            panel.style.display = 'none';
            addMid.removeEventListener('click', onChooseMid);
            addLast.removeEventListener('click', onChooseLast);
            cancelBtn.removeEventListener('click', onCancel);
            this.routeCoords.push(coord3857);
            this.updateRoutePreview();
            this.toast(`중간 구간 추가: ${name}`);
        };
        const onChooseLast = () => {
            panel.style.display = 'none';
            addMid.removeEventListener('click', onChooseMid);
            addLast.removeEventListener('click', onChooseLast);
            cancelBtn.removeEventListener('click', onCancel);
            this.routeCoords.push(coord3857);
            this.updateRoutePreview();
            this.finishMultiRoute();
        };
        const onCancel = () => {
            panel.style.display = 'none';
            addMid.removeEventListener('click', onChooseMid);
            addLast.removeEventListener('click', onChooseLast);
            cancelBtn.removeEventListener('click', onCancel);
        };
        addMid.addEventListener('click', onChooseMid);
        addLast.addEventListener('click', onChooseLast);
        cancelBtn.addEventListener('click', onCancel);
    }

    updateRoutePreview() {
        const line = new LineString(this.routeCoords);
        if (!this.routeLineFeature) {
            this.routeLineFeature = new Feature({ geometry: line });
            this.routeLineFeature.setStyle(new Style({ stroke: new Stroke({ color: '#1e90ff', width: 3 }) }));
            this.vectorSource.addFeature(this.routeLineFeature);
        } else {
            this.routeLineFeature.setGeometry(line);
        }
    }

    finishMultiRoute() {
        if (this.routeCoords.length < 2) { this.resetMultiRoute(); return; }
        // 구간 합산
        let total = 0;
        const segments = [];
        for (let i = 1; i < this.routeCoords.length; i++) {
            const seg = new LineString([this.routeCoords[i-1], this.routeCoords[i]]);
            const len = getLength(seg);
            total += len;
            segments.push(this.formatDistance(len));
        }
        const resultText = this.formatDistance(total);
        this.measurementResults.push({ type: 'distance', value: total, text: `경로 합계: ${resultText}`, coordinates: this.routeCoords });
        this.updateMeasurementDisplay();
        document.getElementById('measurementResult').innerHTML = `<div class="measurement-success">✅ 경로 합계: ${resultText}<br/><small>${segments.join(' • ')}</small></div>`;
        this.toast('멀티-스마트 거리 측정 완료');
        this.resetMultiRoute();
    }

    resetMultiRoute() {
        this.multiRouteActive = false;
        this.routeCoords = [];
        if (this.routeLineFeature) { this.vectorSource.removeFeature(this.routeLineFeature); this.routeLineFeature = null; }
    }

    updateSmartDistanceLine() {
        // 라인 생성/업데이트
        const line = new LineString(this.smartCoords);
        if (!this.smartLineFeature) {
            this.smartLineFeature = new Feature({ geometry: line });
            this.smartLineFeature.set('type', 'measurement');
            this.smartLineFeature.set('measurement', 'distance');
            this.smartLineFeature.setStyle(new Style({
                stroke: new Stroke({ color: '#28a745', width: 3, lineDash: [5, 5] })
            }));
            this.vectorSource.addFeature(this.smartLineFeature);
        } else {
            this.smartLineFeature.setGeometry(line);
        }

        const len = getLength(line);
        if (!this.liveTooltipOverlay) {
            const el = document.createElement('div');
            el.className = 'toast';
            el.style.pointerEvents = 'none';
            this.liveTooltipOverlay = new Overlay({ element: el, offset: [10, -10], positioning: 'bottom-left' });
            this.map.addOverlay(this.liveTooltipOverlay);
        }
        this.liveTooltipOverlay.getElement().textContent = this.formatDistance(len);
        this.liveTooltipOverlay.setPosition(this.smartCoords[this.smartCoords.length - 1]);

        // 스마트 모드 구간 배지
        if (this.smartCoords.length >= 2) {
            const a = this.smartCoords[this.smartCoords.length - 2];
            const b = this.smartCoords[this.smartCoords.length - 1];
            const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
            const segLen = getLength(new LineString([a, b]));
            if (!this.smartSegmentOverlay) {
                const el = document.createElement('div');
                el.className = 'toast';
                el.style.pointerEvents = 'none';
                this.smartSegmentOverlay = new Overlay({ element: el, offset: [0, -10], positioning: 'bottom-center' });
                this.map.addOverlay(this.smartSegmentOverlay);
            }
            this.smartSegmentOverlay.getElement().textContent = this.formatDistance(segLen);
            this.smartSegmentOverlay.setPosition(mid);
        }
    }

    finishSmartDistance() {
        if (!this.smartDistanceActive || this.smartCoords.length < 2) return;
        const line = new LineString(this.smartCoords);
        const length = getLength(line);
        const resultText = this.formatDistance(length);
        this.measurementResults.push({ type: 'distance', value: length, text: resultText, coordinates: this.smartCoords });
        this.measurementHistory.unshift({ type: 'distance', value: length, text: resultText, when: new Date().toISOString() });
        document.getElementById('measurementResult').innerHTML = `<div class="measurement-success">✅ ${resultText} 측정 완료!</div>`;
        this.updateMeasurementDisplay();
        this.renderMeasureHistory();

        // 상태 정리
        this.smartDistanceActive = false;
        if (this.liveTooltipOverlay) { this.map.removeOverlay(this.liveTooltipOverlay); this.liveTooltipOverlay = null; }
        if (this.smartSegmentOverlay) { this.map.removeOverlay(this.smartSegmentOverlay); this.smartSegmentOverlay = null; }
        if (this.smartClickKey) { this.map.un('click', this.smartClickKey); this.smartClickKey = null; }
        if (this.smartDblKey) { this.map.un('dblclick', this.smartDblKey); this.smartDblKey = null; }
    }

    hideSearchResults() {
        const searchResults = document.getElementById('searchResults');
        searchResults.classList.remove('show');
    }

    showSearchLoading() {
        const searchResults = document.getElementById('searchResults');
        searchResults.innerHTML = '<div class="search-result-item loading">🔍 검색 중...</div>';
        searchResults.classList.add('show');
    }

    showSearchError(message) {
        const searchResults = document.getElementById('searchResults');
        searchResults.innerHTML = `<div class="search-result-item error">❌ ${message}</div>`;
        searchResults.classList.add('show');
    }

    goToLocation(lat, lon) {
        console.log('🗺️ 위치로 이동:', lat, lon);
        
        const coordinates = transform([lon, lat], 'EPSG:4326', 'EPSG:3857');
        console.log('📍 변환된 좌표:', coordinates);
        
        this.map.getView().animate({
            center: coordinates,
            zoom: 12,
            duration: 1000
        });
        this.toast(`📍 ${lat.toFixed(4)}, ${lon.toFixed(4)} 로 이동`);

        // 마커 추가
        this.addSearchMarker(lat, lon);
        
        // 성공 메시지 표시
        setTimeout(() => {
            document.getElementById('measurementResult').innerHTML = 
                `<div class="measurement-success">✅ 위치로 이동했습니다! (${lat.toFixed(4)}, ${lon.toFixed(4)})</div>`;
        }, 500);
    }

    // 전체 화면 토글
    bindFullscreen() {
        const btn = document.getElementById('fullscreenToggle');
        if (!btn) return;
        btn.addEventListener('click', () => {
            const docEl = document.documentElement;
            if (!document.fullscreenElement) {
                docEl.requestFullscreen?.();
            } else {
                document.exitFullscreen?.();
            }
        });
    }

    // 토스트 메시지
    toast(message) {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        const el = document.createElement('div');
        el.className = 'toast';
        el.textContent = message;
        container.appendChild(el);
        setTimeout(() => {
            el.remove();
        }, 2000);
    }

    addSearchMarker(lat, lon) {
        const coordinates = transform([lon, lat], 'EPSG:4326', 'EPSG:3857');
        const point = new Point(coordinates);
        
        const feature = new Feature({
            geometry: point,
            type: 'marker',
            search: true
        });

        this.vectorSource.addFeature(feature);
        
        // 3초 후 마커 제거
        setTimeout(() => {
            this.vectorSource.removeFeature(feature);
        }, 3000);
    }

    // 이벤트 리스너 초기화
    initEventListeners() {
        // 레이어 선택 이벤트
        document.getElementById('layerSelect').addEventListener('change', (e) => {
            this.switchLayer(e.target.value);
        });

        // 도구 버튼 이벤트
        document.getElementById('measureDistance').addEventListener('click', () => {
            this.activateTool('distance');
        });

        document.getElementById('measureArea').addEventListener('click', () => {
            this.activateTool('area');
        });

        document.getElementById('addMarker').addEventListener('click', () => {
            this.activateTool('marker');
        });

        document.getElementById('clearAll').addEventListener('click', () => {
            this.clearAllFeatures();
        });

        document.getElementById('exportData').addEventListener('click', () => {
            this.exportData();
        });
    }

    // 측정 패널 버튼 바인딩
    bindMeasureButtons() {
        const finishBtn = document.getElementById('finishMeasure');
        const cancelBtn = document.getElementById('cancelMeasure');
        const resetBtn = document.getElementById('resetMeasure');
        if (finishBtn) finishBtn.addEventListener('click', () => this.finishAnyMeasurement());
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.cancelAnyMeasurement());
        if (resetBtn) resetBtn.addEventListener('click', () => this.resetCurrentMeasurement());
    }

    finishAnyMeasurement() {
        // 우선순위: Draw → 스마트 → 멀티 경로
        if (this.draw) {
            this.draw.finishDrawing?.();
            return;
        }
        if (this.smartDistanceActive) {
            this.finishSmartDistance();
            return;
        }
        if (this.multiRouteActive) {
            this.finishMultiRoute();
            return;
        }
        this.toast('진행 중인 측정이 없습니다.');
    }

    cancelAnyMeasurement() {
        // Draw 측정 취소 및 정리
        if (this.draw) {
            this.deactivateCurrentTool();
        }
        // 스마트 측정 정리
        if (this.smartDistanceActive) {
            this.smartDistanceActive = false;
            this.smartCoords = [];
            this.smartStartCoord = null;
            if (this.smartLineFeature) { this.vectorSource.removeFeature(this.smartLineFeature); this.smartLineFeature = null; }
        }
        // 멀티 경로 정리
        if (this.multiRouteActive) {
            this.resetMultiRoute();
        }
        // 오버레이/선택패널 정리
        if (this.liveTooltipOverlay) { this.map.removeOverlay(this.liveTooltipOverlay); this.liveTooltipOverlay = null; }
        if (this.segmentOverlay) { this.map.removeOverlay(this.segmentOverlay); this.segmentOverlay = null; }
        if (this.smartSegmentOverlay) { this.map.removeOverlay(this.smartSegmentOverlay); this.smartSegmentOverlay = null; }
        const panel = document.getElementById('routeChoice');
        if (panel) panel.style.display = 'none';
        this.toast('측정을 취소했습니다.');
    }

    resetCurrentMeasurement() {
        // 스마트 측정: 시작점만 남기고 초기화
        if (this.smartDistanceActive && this.smartStartCoord) {
            this.smartCoords = [this.smartStartCoord];
            if (this.smartLineFeature) {
                this.smartLineFeature.setGeometry(new LineString(this.smartCoords));
            } else {
                this.updateSmartDistanceLine();
            }
            this.toast('스마트 거리 측정을 시작점으로 초기화했습니다.');
            return;
        }
        // 멀티 경로: 첫 지점만 남기고 초기화
        if (this.multiRouteActive && this.routeCoords.length > 0) {
            this.routeCoords = [this.routeCoords[0]];
            this.updateRoutePreview();
            this.toast('경로를 시작점으로 초기화했습니다.');
            return;
        }
        this.toast('초기화할 진행 중 측정이 없습니다.');
    }

    // 레이어 전환
    switchLayer(layerType) {
        Object.values(this.layers).forEach(layer => {
            layer.setVisible(false);
        });
        
        if (this.layers[layerType]) {
            this.layers[layerType].setVisible(true);
        }
    }

    // 도구 활성화
    activateTool(toolType) {
        this.deactivateCurrentTool();
        
        // 버튼 상태 업데이트
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const buttonMap = {
            'distance': 'measureDistance',
            'area': 'measureArea',
            'marker': 'addMarker'
        };
        
        if (buttonMap[toolType]) {
            document.getElementById(buttonMap[toolType]).classList.add('active');
        }

        this.currentTool = toolType;

        switch (toolType) {
            case 'distance':
                this.startDistanceMeasurement();
                break;
            case 'area':
                this.startAreaMeasurement();
                break;
            case 'marker':
                // 마커 모드 활성화 (클릭 이벤트는 이미 설정됨)
                break;
        }
    }

    // 현재 도구 비활성화
    deactivateCurrentTool() {
        if (this.draw) {
            this.map.removeInteraction(this.draw);
            this.draw = null;
        }
        if (this.snap) {
            this.map.removeInteraction(this.snap);
            this.snap = null;
        }
        if (this.modify) {
            this.map.removeInteraction(this.modify);
            this.modify = null;
        }
        if (this.measurementListener) {
            unByKey(this.measurementListener);
            this.measurementListener = null;
        }
        if (this.distanceOverlay) {
            this.map.removeOverlay(this.distanceOverlay);
            this.distanceOverlay = null;
        }
        
        this.currentTool = null;
    }

    // 거리 측정 시작
    startDistanceMeasurement() {
        console.log('📏 거리 측정 시작');
        
        // 사용자 안내 메시지
        document.getElementById('measurementResult').innerHTML = 
            '<div class="measurement-guide">지도에서 두 지점을 클릭하여 거리를 측정하세요.</div>';

        // 기존 인터랙션 제거
        this.deactivateCurrentTool();

        // Draw 인터랙션 생성
        this.draw = new Draw({
            source: this.vectorSource,
            type: 'LineString',
            style: new Style({
                stroke: new Stroke({
                    color: '#00ff00',
                    width: 3,
                    lineDash: [5, 5]
                }),
                image: new CircleStyle({
                    radius: 8,
                    fill: new Fill({
                        color: '#00ff00'
                    }),
                    stroke: new Stroke({
                        color: '#ffffff',
                        width: 2
                    })
                })
            })
        });

        // 인터랙션을 지도에 추가
        this.map.addInteraction(this.draw);
        console.log('✅ Draw 인터랙션 추가됨');

        // 그리기 시작 이벤트
        this.draw.on('drawstart', (event) => {
            console.log('🎯 그리기 시작됨');
            document.getElementById('measurementResult').innerHTML = 
                '<div class="measurement-guide">두 번째 지점을 클릭하세요.</div>';
            // 라이브 툴팁 준비
            if (!this.liveTooltipOverlay) {
                const el = document.createElement('div');
                el.className = 'toast';
                el.style.pointerEvents = 'none';
                this.liveTooltipOverlay = new Overlay({ element: el, offset: [10, -10], positioning: 'bottom-left' });
                this.map.addOverlay(this.liveTooltipOverlay);
            }
            const sketch = event.feature;
            sketch.getGeometry().on('change', (e) => {
                const geom = e.target;
                const coords = geom.getCoordinates();
                if (coords && coords.length >= 2) {
                    const len = getLength(geom);
                    this.liveTooltipOverlay.getElement().textContent = this.formatDistance(len);
                    this.liveTooltipOverlay.setPosition(coords[coords.length - 1]);
                    // 마지막 구간 배지
                    const lastSeg = [coords[coords.length - 2], coords[coords.length - 1]];
                    const mid = [(lastSeg[0][0] + lastSeg[1][0]) / 2, (lastSeg[0][1] + lastSeg[1][1]) / 2];
                    const segLen = getLength(new LineString(lastSeg));
                    if (!this.segmentOverlay) {
                        const el = document.createElement('div');
                        el.className = 'toast';
                        el.style.pointerEvents = 'none';
                        this.segmentOverlay = new Overlay({ element: el, offset: [0, -10], positioning: 'bottom-center' });
                        this.map.addOverlay(this.segmentOverlay);
                    }
                    this.segmentOverlay.getElement().textContent = this.formatDistance(segLen);
                    this.segmentOverlay.setPosition(mid);
                    // 패널 자동 주목
                    const panel = document.getElementById('measurementResult');
                    if (panel) {
                        panel.classList.remove('panel-highlight');
                        void panel.offsetWidth;
                        panel.classList.add('panel-highlight');
                    }
                }
            });
        });

        // 그리기 완료 이벤트
        this.draw.on('drawend', (event) => {
            console.log('✅ 그리기 완료됨');
            const feature = event.feature;
            const geometry = feature.getGeometry();
            const coordinates = geometry.getCoordinates();
            
            console.log('📍 좌표 개수:', coordinates.length);
            console.log('📍 좌표:', coordinates);
            
            if (coordinates.length >= 2) {
                const length = getLength(geometry);
                console.log('📏 계산된 거리:', length);
                
                // 측정 결과를 피처에 저장
                feature.set('type', 'measurement');
                feature.set('measurement', 'distance');
                feature.set('value', length);
                feature.set('coordinates', coordinates);
                
                // 측정 결과를 배열에 저장
                const resultText = this.formatDistance(length);
                this.measurementResults.push({
                    type: 'distance',
                    value: length,
                    text: resultText,
                    coordinates: coordinates
                });
                
                console.log('💾 측정 결과 추가됨:', resultText);
                
                // 성공 메시지 표시
                document.getElementById('measurementResult').innerHTML = 
                    `<div class="measurement-success">✅ ${resultText} 측정 완료!</div>`;
                
                // 측정 결과 표시 업데이트
                setTimeout(() => {
                    this.updateMeasurementDisplay();
                }, 1000);
                
                // 도구 유지(연속 측정), 오버레이 제거
                if (this.liveTooltipOverlay) {
                    this.map.removeOverlay(this.liveTooltipOverlay);
                    this.liveTooltipOverlay = null;
                }
                if (this.segmentOverlay) {
                    this.map.removeOverlay(this.segmentOverlay);
                    this.segmentOverlay = null;
                }
                // 라이브 툴팁 제거
                if (this.liveTooltipOverlay) {
                    this.map.removeOverlay(this.liveTooltipOverlay);
                    this.liveTooltipOverlay = null;
                }
            } else {
                console.log('❌ 좌표가 부족합니다');
                document.getElementById('measurementResult').innerHTML = 
                    '<div class="measurement-guide">두 개 이상의 지점을 클릭해주세요.</div>';
            }
        });

        // 단축키: Enter/ESC/Backspace, 패널 버튼과 연동
        const keyHandler = (e) => {
            if (e.key === 'Enter') {
                this.draw.finishDrawing?.();
            } else if (e.key === 'Escape') {
                this.deactivateCurrentTool();
                if (this.liveTooltipOverlay) { this.map.removeOverlay(this.liveTooltipOverlay); this.liveTooltipOverlay = null; }
            } else if (e.key === 'Backspace') {
                this.draw.removeLastPoint?.();
            }
        };
        document.addEventListener('keydown', keyHandler, { once: false });
        const finishBtn = document.getElementById('finishMeasure');
        const cancelBtn = document.getElementById('cancelMeasure');
        if (finishBtn) finishBtn.onclick = () => this.draw.finishDrawing?.();
        if (cancelBtn) cancelBtn.onclick = () => { this.deactivateCurrentTool(); if (this.liveTooltipOverlay) { this.map.removeOverlay(this.liveTooltipOverlay); this.liveTooltipOverlay = null; } };
    }

    // 거리 포맷팅
    formatDistance(length) {
        if (length < 1000) {
            return `거리: ${length.toFixed(1)} m`;
        } else if (length < 100000) {
            return `거리: ${(length / 1000).toFixed(3)} km`;
        } else {
            return `거리: ${(length / 1000).toFixed(1)} km`;
        }
    }

    // 면적 측정 시작
    startAreaMeasurement() {
        console.log('📐 면적 측정 시작');
        
        // 사용자 안내 메시지
        document.getElementById('measurementResult').innerHTML = 
            '<div class="measurement-guide">지도에서 다각형을 그려 면적을 측정하세요.</div>';

        this.draw = new Draw({
            source: this.vectorSource,
            type: 'Polygon',
            style: this.getMeasurementStyle()
        });

        this.snap = new Snap({ source: this.vectorSource });
        this.modify = new Modify({ source: this.vectorSource });

        this.map.addInteraction(this.draw);
        this.map.addInteraction(this.snap);
        this.map.addInteraction(this.modify);

        this.measurementListener = this.draw.on('drawend', (event) => {
            console.log('✅ 면적 측정 완료');
            const feature = event.feature;
            const geometry = feature.getGeometry();
            const area = getArea(geometry);
            
            console.log('📐 계산된 면적:', area);
            
            // 측정 결과를 피처에 저장
            feature.set('type', 'measurement');
            feature.set('measurement', 'area');
            feature.set('value', area);
            
            // 측정 결과를 배열에 저장
            const resultText = this.formatArea(area);
            this.measurementResults.push({
                type: 'area',
                value: area,
                text: resultText
            });
            
            console.log('💾 측정 결과 추가됨:', resultText);
            
            // 측정 결과 표시 업데이트
            this.updateMeasurementDisplay();
            
            // 성공 메시지 표시
            document.getElementById('measurementResult').innerHTML = 
                `<div class="measurement-success">✅ ${resultText} 측정 완료!</div>`;
            
            // 측정 완료 후 도구 비활성화
            setTimeout(() => {
                this.deactivateCurrentTool();
                document.getElementById('measureArea').classList.remove('active');
                this.updateMeasurementDisplay();
            }, 3000);
        });
    }

    // 면적 포맷팅
    formatArea(area) {
        if (area < 1000000) {
            return `면적: ${(area / 10000).toFixed(2)} ha`;
        } else {
            return `면적: ${(area / 1000000).toFixed(3)} km²`;
        }
    }

    // 측정 결과 표시 업데이트
    updateMeasurementDisplay() {
        const resultElement = document.getElementById('measurementResult');
        if (this.measurementResults.length === 0) {
            resultElement.innerHTML = '측정 결과가 없습니다.';
            return;
        }
        
        let html = '<div class="measurement-list">';
        this.measurementResults.forEach((result, index) => {
            html += `<div class="measurement-item">
                <span class="measurement-text">${result.text}</span>
                <button class="remove-measurement" onclick="window.webgisMap.removeMeasurement(${index})">×</button>
            </div>`;
        });
        html += '</div>';
        
        resultElement.innerHTML = html;

        // 자동 스크롤 및 하이라이트: 최근 결과로 스크롤
        const container = resultElement;
        const lastItem = container.querySelector('.measurement-item:last-child');
        if (lastItem) {
            lastItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            container.classList.remove('panel-highlight');
            void container.offsetWidth; // reflow to restart animation
            container.classList.add('panel-highlight');
        }
        // 측정 이력도 동기 스크롤
        this.renderMeasureHistory();
    }

    renderMeasureHistory() {
        const el = document.getElementById('measureHistoryList');
        if (!el) return;
        if (!this.measurementHistory.length) {
            el.innerHTML = '<div class="empty">이력이 없습니다.</div>';
            return;
        }
        el.innerHTML = this.measurementHistory.slice(0, 10).map(h => `
            <div class="measurement-item">
                <span class="measurement-text">${h.text}</span>
                <small style="margin-left:6px;opacity:.7;">${h.when.slice(11,16)}</small>
            </div>
        `).join('');
    }

    // 개별 측정 결과 삭제
    removeMeasurement(index) {
        this.measurementResults.splice(index, 1);
        this.updateMeasurementDisplay();
    }

    // 마커 추가
    addMarker(coordinate) {
        console.log('📍 마커 추가:', coordinate);
        
        const marker = new Feature({
            geometry: new Point(coordinate)
        });
        
        marker.set('type', 'marker');
        marker.setStyle(this.getMarkerStyle());
        
        this.vectorSource.addFeature(marker);
        
        // 성공 메시지 표시
        const lonLat = transform(coordinate, 'EPSG:3857', 'EPSG:4326');
        document.getElementById('measurementResult').innerHTML = 
            `<div class="measurement-success">✅ 마커가 추가되었습니다! (${lonLat[1].toFixed(4)}, ${lonLat[0].toFixed(4)})</div>`;
        
        console.log('✅ 마커 추가 완료');
    }

    // 모든 피처 삭제
    clearAllFeatures() {
        // 확인 대화상자 표시
        if (confirm('모든 측정 데이터와 마커를 삭제하시겠습니까?')) {
            this.vectorSource.clear();
            this.measurementResults = [];
            this.updateMeasurementDisplay();
            
            // 버튼 상태 초기화
            document.querySelectorAll('.tool-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            
            // 현재 도구 비활성화
            this.deactivateCurrentTool();
        }
    }

    // 데이터 내보내기
    exportData() {
        const features = this.vectorSource.getFeatures();
        if (features.length === 0) {
            alert('내보낼 데이터가 없습니다.');
            return;
        }

        const exportData = {
            type: 'FeatureCollection',
            features: features.map(feature => {
                const geometry = feature.getGeometry();
                const coordinates = geometry.getCoordinates();
                
                // 좌표계 변환 (EPSG:3857 -> EPSG:4326)
                const transformedCoords = this.transformCoordinates(coordinates, geometry.getType());
                
                return {
                    type: 'Feature',
                    geometry: {
                        type: geometry.getType(),
                        coordinates: transformedCoords
                    },
                    properties: {
                        type: feature.get('type'),
                        measurement: feature.get('measurement'),
                        value: feature.get('value')
                    }
                };
            }),
            measurements: this.measurementResults
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `webgis_data_${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
    }

    // 좌표 변환
    transformCoordinates(coordinates, geometryType) {
        if (geometryType === 'Point') {
            return transform(coordinates, 'EPSG:3857', 'EPSG:4326');
        } else if (geometryType === 'LineString') {
            return coordinates.map(coord => transform(coord, 'EPSG:3857', 'EPSG:4326'));
        } else if (geometryType === 'Polygon') {
            return coordinates.map(ring => 
                ring.map(coord => transform(coord, 'EPSG:3857', 'EPSG:4326'))
            );
        }
        return coordinates;
    }

    // 피처별 스타일 적용
    getFeatureStyle(feature) {
        const type = feature.get('type');
        
        if (type === 'measurement') {
            const measurement = feature.get('measurement');
            const value = feature.get('value');
            
            if (measurement === 'distance') {
                return this.getDistanceStyle(value);
            } else if (measurement === 'area') {
                return this.getAreaStyle(value);
            }
        } else if (type === 'marker') {
            return this.getMarkerStyle();
        }
        
        return this.getDefaultStyle();
    }

    // 기본 스타일
    getDefaultStyle() {
        return new Style({
            stroke: new Stroke({
                color: '#ff4757',
                width: 2
            }),
            fill: new Fill({
                color: 'rgba(255, 71, 87, 0.2)'
            }),
            image: new CircleStyle({
                radius: 7,
                fill: new Fill({
                    color: '#ff4757'
                }),
                stroke: new Stroke({
                    color: '#fff',
                    width: 2
                })
            })
        });
    }

    // 거리 측정 그리기 스타일
    getDistanceDrawingStyle() {
        return new Style({
            stroke: new Stroke({
                color: '#2ed573',
                width: 3,
                lineDash: [5, 5]
            }),
            image: new CircleStyle({
                radius: 6,
                fill: new Fill({
                    color: '#2ed573'
                }),
                stroke: new Stroke({
                    color: '#fff',
                    width: 2
                })
            })
        });
    }

    // 측정용 스타일
    getMeasurementStyle() {
        return new Style({
            stroke: new Stroke({
                color: '#2ed573',
                width: 3
            }),
            fill: new Fill({
                color: 'rgba(46, 213, 115, 0.2)'
            }),
            image: new CircleStyle({
                radius: 6,
                fill: new Fill({
                    color: '#2ed573'
                }),
                stroke: new Stroke({
                    color: '#fff',
                    width: 2
                })
            })
        });
    }

    // 거리 측정 스타일
    getDistanceStyle(length) {
        return new Style({
            stroke: new Stroke({
                color: '#2ed573',
                width: 3
            }),
            image: new CircleStyle({
                radius: 6,
                fill: new Fill({
                    color: '#2ed573'
                }),
                stroke: new Stroke({
                    color: '#fff',
                    width: 2
                })
            }),
            text: new Text({
                text: this.formatDistance(length),
                font: '14px Arial',
                fill: new Fill({
                    color: '#2ed573'
                }),
                stroke: new Stroke({
                    color: '#fff',
                    width: 2
                }),
                offsetY: -10
            })
        });
    }

    // 면적 측정 스타일
    getAreaStyle(area) {
        return new Style({
            stroke: new Stroke({
                color: '#2ed573',
                width: 3
            }),
            fill: new Fill({
                color: 'rgba(46, 213, 115, 0.2)'
            }),
            text: new Text({
                text: this.formatArea(area),
                font: '14px Arial',
                fill: new Fill({
                    color: '#2ed573'
                }),
                stroke: new Stroke({
                    color: '#fff',
                    width: 2
                }),
                offsetY: 0
            })
        });
    }

    // 마커 스타일
    getMarkerStyle() {
        return new Style({
            image: new Icon({
                anchor: [0.5, 1],
                src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="%23ff4757"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>'
            })
        });
    }
}

// 애플리케이션 시작
document.addEventListener('DOMContentLoaded', () => {
    window.webgisMap = new WebGISMap();
    console.log('🌍 WebGIS 애플리케이션이 성공적으로 로드되었습니다!');
}); 