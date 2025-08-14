## 🌍 WebGIS - OpenLayers 기반 지도 서비스 (Vite)

### 배지

[![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![OpenLayers](https://img.shields.io/badge/OpenLayers-8.2.0-2E7D32)](https://openlayers.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-0EA5E9.svg)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Dev%20Ready-22c55e.svg)](#)

이 저장소는 정적 HTML/JS 기반의 OpenLayers WebGIS 애플리케이션을 중심으로 구성되어 있으며, 보조적으로 React + TypeScript 구현(`webgis-react/`)을 함께 제공합니다. 본 문서는 현재 구동 중인 정적 Vite 프로젝트와 `index.html`의 실제 UI/기능에 맞추어 최신 상태로 업데이트되었습니다.

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

## 실행 방법 (정적 Vite 프로젝트)

```bash
# 의존성 설치
npm install

# 개발 서버 실행 (기본 5173, 이미 사용 중이면 5174+로 자동 증가)
npm run dev

# 프로덕션 빌드
npm run build

# 빌드 미리보기 (Vite)
npm run preview

# 또는 정적 서빙 (http-server, 8080)
npm run serve
```

- 접속: `http://localhost:5173` (또는 로그에 표시된 포트)
- 동시에 React 앱을 실행하는 경우, 포트 충돌을 피하기 위해 자동으로 `5174+` 포트를 사용합니다.

## 파일 구조 (요약)

```
e_three/
├── index.html              # 메인 앱(헤더/사이드바/지도/패널/도구/UI)
├── main.js                 # OpenLayers 로직(검색/측정/스마트측정/토스트/테마 등)
├── styles.css              # 라이트/다크 테마, 레이아웃/컴포넌트/애니메이션 스타일
├── vite.config.js          # Vite 설정 (개발 포트)
├── test-*.html             # 기능 확인용 테스트 페이지 모음
└── webgis-react/           # 보조 React + TS 구현 (별도 실행 가능)
```

## UI 구성 (index.html 기준)

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
| OpenLayers | 8.2.0 |
| Vite | 5.x |
| ES Modules | 모듈 시스템 |
| CSS Variables | 라이트/다크 테마 |
| Nominatim API | 지오코딩 |
| LocalStorage | 즐겨찾기/테마/캐시 |

## React 보조 프로젝트(webgis-react)

- `webgis-react/`에는 동일한 기능 목표의 React + TypeScript 버전이 포함되어 있습니다.
- 실행(Windows):

```bash
npm run start  # 루트에서 실행하면 webgis-react로 위임되어 포트 3000에서 구동
```

- 정적 Vite 앱(본 프로젝트)과는 별도로 동작하며, 두 서버를 동시에 띄울 수 있습니다.

## 문제 해결

- 포트 충돌: Vite가 `5173` 사용 중이면 자동으로 `5174+`로 할당됩니다.
- 검색 지연/오류: 네트워크 상태 확인, API 타임아웃(5초) 처리, 재시도
- 버튼/아이콘 미표시: 새로고침(F5) 또는 브라우저 캐시 비우기

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


