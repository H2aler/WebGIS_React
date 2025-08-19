import React from 'react';
import { ToolType, MeasurementResult } from '../../types';
import './Sidebar.css';

export interface SidebarProps {
  isOpen: boolean;
  onToggle?: () => void;
  measurements: MeasurementResult[];
  activeTool: ToolType | null;
  previewText: string;
  activateTool: (tool: ToolType) => void;
  clearMeasurements: () => void;
  favorites: any[];
  onFavoriteClick: (favorite: any) => void;
  onRemoveFavorite: (favorite: any) => void;
  selectedLocation?: string;
}

const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  measurements,
  activeTool,
  previewText,
  activateTool,
  clearMeasurements,
  favorites,
  onFavoriteClick,
  onRemoveFavorite,
  selectedLocation
}) => {
  if (!isOpen) return null;

  return (
    <aside className="sidebar">
      {/* 정보 패널 */}
      <div className="info-panel">
        <h3>ℹ️ 정보</h3>
        <p>OpenLayers 기반 WebGIS입니다. 검색, 거리/면적 측정, 마커, 즐겨찾기, 테마를 제공합니다.</p>
        <ul className="info-list">
          <li>🔍 검색·즐겨찾기 및 키보드 탐색</li>
          <li>📏/📐 지오데식 계산·구간 배지·방위각 지원</li>
          <li>📍 마커 · 🗑️ 초기화 · 💾 데이터 내보내기</li>
          <li>🌓 라이트/다크 · ⛶ 전체 화면</li>
        </ul>
        <div className="info-badges">
          <span className="badge">Geocoding: Nominatim (OSM)</span>
          <span className="badge">Projection: EPSG:3857</span>
          <span className="badge">Coords: WGS84</span>
        </div>
      </div>

      {/* 사용 방법 패널 */}
      <div className="help-panel">
        <h3>📘 사용 방법</h3>
        <div className="help-section">
          <h4>🔍 검색</h4>
          <ul>
            <li>검색창에 도시/나라를 입력하고 Enter 또는 돋보기 버튼 클릭</li>
            <li>결과 항목 클릭: 해당 위치로 이동하며 스마트 거리 측정 시작점으로 설정</li>
            <li>결과 우측 버튼:
              <ul>
                <li>⭐ 즐겨찾기 추가</li>
                <li>📏 스마트 거리 측정 시작</li>
                <li>📐 스마트 면적 측정 시작</li>
              </ul>
            </li>
          </ul>
        </div>
        <div className="help-section">
          <h4>📏 거리 측정</h4>
          <ul>
            <li>좌측 패널의 "📏 거리 측정" 클릭 → 지도에서 점을 순서대로 클릭</li>
            <li>끝점 근처에 전체 거리 툴팁, 마지막 선분 중앙에 구간 거리 배지 표시</li>
            <li>Enter: 측정 완료, Esc: 측정 취소, Backspace: 마지막 점 되돌리기</li>
            <li>스마트 거리: 검색 결과 클릭 또는 📏 버튼으로 시작점 자동 설정 → 지도 클릭으로 지점 추가 → 더블클릭으로 완료</li>
          </ul>
        </div>
        <div className="help-section">
          <h4>📐 면적 측정</h4>
          <ul>
            <li>좌측 패널의 "📐 면적 측정" 클릭 → 지도에서 다각형을 그려 면적 계산</li>
          </ul>
        </div>
        <div className="help-section">
          <h4>📍 마커/데이터</h4>
          <ul>
            <li>📍 마커 추가: 지도 클릭 위치에 임시 마커</li>
            <li>🗑️ 모두 지우기: 모든 측정/마커 초기화</li>
            <li>💾 데이터 내보내기: 측정 결과를 GeoJSON 유사 포맷으로 다운로드</li>
          </ul>
        </div>
        <div className="help-section">
          <h4>🖥️ UI/환경</h4>
          <ul>
            <li>🌓 테마 토글: 라이트/다크 전환</li>
            <li>⛶ 전체 화면: 브라우저 전체 화면 토글</li>
            <li>레이어 선택: OSM/위성/지형도 전환</li>
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
        <details className="help-section">
          <summary>문제 해결 팁</summary>
          <ul>
            <li>검색이 느릴 때: 네트워크 상태 확인, 다시 시도</li>
            <li>버튼이 보이지 않을 때: 브라우저 새로고침(F5) 또는 캐시 비우기</li>
            <li>지도가 느릴 때: 레이어를 OSM으로 전환</li>
          </ul>
        </details>
      </div>

      {/* 도구 패널 */}
      <div className="tools-panel">
        <h3>🛠️ 도구</h3>
        <button 
          className={`tool-btn ${activeTool === 'distance' ? 'active' : ''}`}
          onClick={() => activateTool('distance')}
        >
          📏 거리 측정
        </button>
        <button 
          className={`tool-btn ${activeTool === 'area' ? 'active' : ''}`}
          onClick={() => activateTool('area')}
        >
          📐 면적 측정
        </button>
        <button 
          className={`tool-btn ${activeTool === 'marker' ? 'active' : ''}`}
          onClick={() => activateTool('marker')}
        >
          📍 마커 추가
        </button>
        <button 
          className="tool-btn"
          onClick={clearMeasurements}
        >
          🗑️ 모두 지우기
        </button>
        <button className="tool-btn">
          💾 데이터 내보내기
        </button>
      </div>

      {/* 측정 설정 패널 */}
      <div className="tools-panel">
        <h3>⚙️ 측정 설정</h3>
        <div className="measure-settings">
          <label className="setting-item">
            <input type="checkbox" defaultChecked /> 지오데식 계산(타원체)
          </label>
          <label className="setting-item">
            <input type="checkbox" defaultChecked /> 구간 길이 배지 표시
          </label>
          <label className="setting-item">
            <input type="checkbox" defaultChecked /> 마지막 구간 방위각 표시
          </label>
          <div className="setting-actions">
            <button className="tool-btn">↩️ 마지막 점 취소</button>
          </div>
        </div>
      </div>

      {/* 즐겨찾기 패널 */}
      <div className="favorites-panel">
        <h3>⭐ 즐겨찾기</h3>
        <div className="favorites-list">
          {favorites.length === 0 ? (
            <p>즐겨찾기가 없습니다.</p>
          ) : (
            favorites.map((favorite, index) => (
              <div key={index} className="favorite-item">
                <span 
                  className="favorite-name"
                  onClick={() => onFavoriteClick(favorite)}
                >
                  {favorite.name}
                </span>
                <button 
                  className="favorite-remove"
                  onClick={() => onRemoveFavorite(favorite)}
                >
                  ✖
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 측정 결과 패널 */}
      <div className="measurement-panel">
        <h3>📊 측정 결과</h3>
        <div className="measurement-result">
          {previewText || "측정 도구를 사용하여 결과를 확인하세요."}
        </div>
        <div className="measure-actions">
          <button className="inline-btn" title="측정 완료(Enter)">✅ 완료</button>
          <button className="inline-btn secondary" title="측정 취소(Esc)">✖ 취소</button>
          <button className="inline-btn secondary" title="처음 지점으로 초기화(R)">↺ 초기화</button>
        </div>
        <div className="measure-history-panel">
          <h3>🧭 측정 이력</h3>
          <div className="measure-history-list">
            {measurements.length === 0 ? (
              <p>측정 이력이 없습니다.</p>
            ) : (
              measurements.map((measurement, index) => (
                <div key={index} className="history-item">
                  {measurement.type === 'distance' && `거리: ${measurement.distance?.toFixed(2)}km`}
                  {measurement.type === 'area' && `면적: ${measurement.area?.toFixed(2)}km²`}
                  {measurement.type === 'marker' && `마커: ${measurement.coordinates?.join(', ')}`}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 범례 패널 */}
      <div className="legend-panel">
        <h3>🎨 범례</h3>
        <div className="legend-item">
          <div className="legend-color distance-color"></div>
          <span>거리 측정</span>
        </div>
        <div className="legend-item">
          <div className="legend-color area-color"></div>
          <span>면적 측정</span>
        </div>
        <div className="legend-item">
          <div className="legend-color marker-color"></div>
          <span>마커</span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;