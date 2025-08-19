## 🌍 WebGIS - React + OpenLayers 기반 지도 서비스

### 배지

[![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react&logoColor=white)](https://reactjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.9.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![OpenLayers](https://img.shields.io/badge/OpenLayers-10.6.1-2E7D32)](https://openlayers.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-0EA5E9.svg)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Dev%20Ready-22c55e.svg)](#)

이 저장소는 React + TypeScript 기반의 OpenLayers WebGIS 애플리케이션(`webgis-react/`)을 중심으로 구성되어 있으며, 보조적으로 정적 HTML/JS 구현도 함께 제공합니다. 본 문서는 현재 구동 중인 React 프로젝트의 실제 UI/기능에 맞추어 최신 상태로 업데이트되었습니다.

## 주요 기능

- **검색(도시/나라)**: Nominatim API, 자동완성, 디바운싱, 캐시, 키보드 탐색(↑/↓/Enter/Esc)
- **스마트 측정**: 
  - 검색 결과에서 바로 시작하는 스마트 거리/면적 측정
  - 멀티-스마트 거리(여러 검색 결과를 연속 연결) 선택 패널 제공
- **측정 도구**: 
  - 거리 측정(실시간 총거리 툴팁, 구간 배지, Undo, Enter/ESC 단축키)
  - 면적 측정(폴리곤)
  - 측정 설정(지오데식 계산, 구간 길이 배지, 방위각 표시, 마지막 점 취소)
  - 측정 이력 패널 및 결과 자동 스크롤/하이라이트
- **마커 추가**: 지도 클릭으로 임시 마커 배치
- **데이터 관리**: 모두 지우기, 측정 결과 내보내기(GeoJSON 유사 포맷)
- **즐겨찾기**: 검색 결과 즐겨찾기 추가/삭제(로컬 저장)
- **UI/환경**: 라이트/다크 테마, 전체 화면, 레이어 전환(OSM/위성/지형)
- **알림/피드백**: 토스트 메시지, 패널 하이라이트 애니메이션

## 실행 방법 (React 프로젝트)

```bash
# 의존성 설치
npm install

# React 개발 서버 실행 (포트 3000)
npm run dev

# 또는 직접 React 프로젝트 실행
npm start

# React 프로덕션 빌드
cd webgis-react && npm run build

# 정적 Vite 프로젝트 실행 (보조, 포트 5173)
vite
```

- **React 앱 접속**: `http://localhost:3000`
- **정적 Vite 앱 접속**: `http://localhost:5173` (보조 프로젝트)
- 기본적으로 `npm run dev` 실행 시 React 프로젝트가 시작됩니다.

## 파일 구조 (요약)

```
9-mobile/
├── webgis-react/           # 메인 React + TypeScript 프로젝트
│   ├── src/
│   │   ├── components/     # React 컴포넌트들
│   │   │   ├── Map/        # 지도 컴포넌트 (WebGISMap.tsx)
│   │   │   ├── Search/     # 검색 기능 (SearchBar.tsx)
│   │   │   ├── Tools/      # 측정 도구 (MeasurementTools.tsx)
│   │   │   ├── Sidebar/    # 사이드바 (Sidebar.tsx)
│   │   │   ├── Favorites/  # 즐겨찾기 (FavoritesList.tsx)
│   │   │   └── Theme/      # 테마 토글 (ThemeToggle.tsx)
│   │   ├── hooks/          # 커스텀 훅들 (useMap, useSearch 등)
│   │   ├── types/          # TypeScript 타입 정의
│   │   └── utils/          # 유틸리티 함수들
│   ├── package.json        # React 프로젝트 의존성
│   └── build/              # 빌드 결과물
├── index.html              # 정적 HTML 버전 (보조)
├── main.js                 # OpenLayers 정적 버전 로직
├── styles.css              # 정적 버전 스타일
├── vite.config.js          # Vite 설정
├── test-*.html             # 기능 테스트 페이지들
└── package.json            # 루트 설정 (npm run dev → React 실행)
```

## UI 구성 (React 앱 기준)

- **헤더**: 검색창(자동완성/결과 리스트), 테마 토글, 줌/전체영역/전체화면, 레이어 선택
- **지도 영역**: `#map`과 실시간 좌표 표시, 멀티-스마트 거리 선택 패널(`routeChoice`)
- **사이드바 패널**:
  - `ℹ️ 정보`: 기능 요약, 기술 배지(Nominatim/EPSG:3857/WGS84)
  - `📘 사용 방법`: 검색/거리/면적/마커/환경/단축키/문제해결 안내
  - `🛠️ 도구`: 거리/면적/마커/모두 지우기/내보내기 버튼
  - `⚙️ 측정 설정`: 지오데식/구간배지/방위각/마지막 점 취소
  - `⭐ 즐겨찾기`: 로컬 저장된 즐겨찾기 관리
  - `📊 측정 결과`: 결과 리스트, 완료/취소/초기화 액션, `🧭 측정 이력`
  - `🎨 범례`: 거리/면적/마커 스타일
- **토스트 컨테이너**: 전역 알림 메시지 표시

## 측정 기능 상세

- **거리**: 그리는 동안 총거리 실시간 툴팁 + 마지막 선분 구간 배지 제공
- **Undo/완료/취소/초기화**: Backspace/Enter/Esc 및 패널 버튼으로 제어
- **지오데식 계산**: 타원체 기반 길이/면적(옵션) 지원
- **방위각**: 마지막 구간의 방위각(옵션) 표시
- **히스토리/피드백**: 최근 측정 이력, 결과 자동 스크롤 및 하이라이트

## 검색 · 스마트 측정

- **검색**: 입력 디바운싱, 캐시, 5초 타임아웃, 키보드 탐색, 결과 수 헤더
- **액션 버튼**: 결과별 ⭐ 즐겨찾기, 📏 스마트 거리, 📐 스마트 면적
- **스마트 거리**: 결과 클릭으로 시작점 지정 → 지도 클릭으로 이어서 측정
- **멀티-스마트 거리**: 여러 결과를 선택해 연속 구간을 구성(전용 패널에서 중간/마지막/취소 선택)

## 단축키

- Enter: 측정 완료
- Esc: 측정 취소/닫기
- Backspace: 마지막 점 되돌리기
- ↑/↓: 검색 결과 이동

## 테마/접근성

- **다크 테마 개선**: 본문/제목/메타/배지/툴팁 대비 강화, 부드러운 전환
- **포커스 링**: 키보드 사용자 접근성 향상
- **스크롤바/선택 영역**: 다크 전용 컬러 적용

## 기술 스택

| 기술 | 버전/비고 |
|---|---|
| React | 19.1.1 (메인 프레임워크) |
| TypeScript | 4.9.5 |
| OpenLayers | 10.6.1 |
| React Scripts | 5.0.1 (Create React App) |
| CSS Modules | 컴포넌트별 스타일링 |
| Custom Hooks | 상태 관리 (useMap, useSearch 등) |
| Nominatim API | 지오코딩 |
| LocalStorage | 즐겨찾기/테마/캐시 |
| Vite | 5.x (정적 버전용) |

## 정적 HTML 보조 프로젝트

- 루트 디렉토리에는 정적 HTML/JavaScript 버전의 동일한 기능이 포함되어 있습니다.
- 실행:

```bash
vite          # 포트 5173에서 정적 버전 실행
# 또는
npm run preview  # 빌드 후 미리보기
```

- React 앱(메인 프로젝트)과는 별도로 동작하며, 두 서버를 동시에 띄울 수 있습니다.

## 문제 해결

- **포트 충돌**: React 앱이 `3000` 포트를 사용 중일 때는 자동으로 다른 포트로 할당됩니다.
- **의존성 오류**: `webgis-react` 폴더에서 `npm install` 실행하여 React 프로젝트 의존성을 설치하세요.
- **검색 지연/오류**: 네트워크 상태 확인, API 타임아웃(5초) 처리, 재시도
- **컴파일 오류**: TypeScript 오류 발생 시 `webgis-react` 폴더에서 `npm run build`로 확인
- **화면 렌더링 문제**: 브라우저 새로고침(F5) 또는 개발자 도구에서 캐시 비우기

## 라이선스

MIT

## 스크린샷

아래 이미지는 라이트/다크 테마와 주요 패널 구성을 보여줍니다. 스크린샷 파일을 `docs/` 폴더에 추가하면 자동으로 렌더링됩니다.

| 라이트 테마 | 다크 테마 |
|---|---|
| ![Light](docs/screenshot-light.png) | ![Dark](docs/screenshot-dark.png) |

세부 화면:

- 검색 결과/액션 버튼: ![Search](docs/screenshot-search.png)
- 스마트 거리/멀티-스마트 패널: ![Smart Distance](docs/screenshot-smart-distance.png)
- 측정 결과/이력/설정: ![Measure Panels](docs/screenshot-measure-panels.png)

참고: `docs/` 폴더가 없다면 생성 후 위 파일명을 맞춰 이미지를 넣어주세요.


