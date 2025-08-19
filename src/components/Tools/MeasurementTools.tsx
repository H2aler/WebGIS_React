import React from 'react';
import { ToolType } from '../../types';
import { exportToGeoJSON, exportToCSV, exportToJSON, downloadFile } from '../../utils/exportUtils';
import './MeasurementTools.css';

interface MeasurementToolsProps {
  activeTool: ToolType;
  previewText: string;
  onToolActivate: (tool: ToolType) => void;
  onClear: () => void;
  measurements?: any[];
  favorites?: any[];
}

export const MeasurementTools: React.FC<MeasurementToolsProps> = ({
  activeTool,
  previewText,
  onToolActivate,
  onClear,
  measurements = [],
  favorites = []
}) => {
  const handleToolClick = (tool: ToolType) => {
    onToolActivate(tool);
  };

  const handleExport = (format: 'geojson' | 'csv' | 'json') => {
    let content: string;
    let filename: string;
    let mimeType: string;

    switch (format) {
      case 'geojson':
        content = JSON.stringify(exportToGeoJSON(measurements, favorites), null, 2);
        filename = `webgis-export-${new Date().toISOString().split('T')[0]}.geojson`;
        mimeType = 'application/geo+json';
        break;
      case 'csv':
        content = exportToCSV(measurements, favorites);
        filename = `webgis-export-${new Date().toISOString().split('T')[0]}.csv`;
        mimeType = 'text/csv';
        break;
      case 'json':
        content = exportToJSON(measurements, favorites);
        filename = `webgis-export-${new Date().toISOString().split('T')[0]}.json`;
        mimeType = 'application/json';
        break;
      default:
        return;
    }

    downloadFile(content, filename, mimeType);
  };

  const getInstructions = () => {
    switch (activeTool) {
      case 'distance':
        return '지도에서 두 점을 순서대로 클릭하여 거리를 측정하세요. Enter로 완료, Esc로 취소할 수 있습니다.';
      case 'area':
        return '지도에서 여러 점을 클릭하여 면적을 측정하세요. 최소 3점이 필요합니다. Enter로 완료, Esc로 취소할 수 있습니다.';
      case 'marker':
        return '지도에서 원하는 위치를 클릭하여 마커를 추가하세요.';
      default:
        return '측정 도구를 선택하여 사용하세요.';
    }
  };

  return (
    <div className="measurement-tools">
      <div className="tools-header">
        <h3>측정 도구</h3>
        <p className="tools-description">
          거리, 면적, 마커를 측정하고 관리할 수 있습니다.
        </p>
      </div>
      
      <div className="tools-grid">
        <button
          className={`tool-button ${activeTool === 'distance' ? 'active' : ''}`}
          onClick={() => handleToolClick('distance')}
          title="거리 측정"
        >
          <span className="tool-icon">📏</span>
          <span className="tool-label">거리 측정</span>
        </button>
        
        <button
          className={`tool-button ${activeTool === 'area' ? 'active' : ''}`}
          onClick={() => handleToolClick('area')}
          title="면적 측정"
        >
          <span className="tool-icon">📐</span>
          <span className="tool-label">면적 측정</span>
        </button>
        
        <button
          className={`tool-button ${activeTool === 'marker' ? 'active' : ''}`}
          onClick={() => handleToolClick('marker')}
          title="마커 추가"
        >
          <span className="tool-icon">📍</span>
          <span className="tool-label">마커 추가</span>
        </button>
      </div>

      <div className="tools-actions">
        <button
          className="clear-button"
          onClick={onClear}
          title="모든 측정 결과 삭제"
        >
          🗑️ 모든 측정 삭제
        </button>
        
        <div className="export-buttons">
          <button
            className="export-button"
            onClick={() => handleExport('geojson')}
            title="GeoJSON 형식으로 내보내기"
          >
            📄 GeoJSON
          </button>
          <button
            className="export-button"
            onClick={() => handleExport('csv')}
            title="CSV 형식으로 내보내기"
          >
            📊 CSV
          </button>
          <button
            className="export-button"
            onClick={() => handleExport('json')}
            title="JSON 형식으로 내보내기"
          >
            📋 JSON
          </button>
        </div>
      </div>

      {activeTool && (
        <div className="instructions">
          <h4>사용법</h4>
          <p>{getInstructions()}</p>
        </div>
      )}

      {previewText && (
        <div className="preview-text">
          <span className="preview-label">미리보기:</span>
          <span className="preview-value">{previewText}</span>
        </div>
      )}

      <div className="measurement-settings">
        <h4>⚙️ 측정 설정</h4>
        <div className="setting-items">
          <label className="setting-item">
            <input type="checkbox" defaultChecked /> 지오데식 계산(타원체)
          </label>
          <label className="setting-item">
            <input type="checkbox" defaultChecked /> 구간 길이 배지 표시
          </label>
          <label className="setting-item">
            <input type="checkbox" defaultChecked /> 마지막 구간 방위각 표시
          </label>
        </div>
        <div className="setting-actions">
          <button className="tool-btn">↩️ 마지막 점 취소</button>
        </div>
      </div>
    </div>
  );
};
