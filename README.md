# 🌍 WebGIS React - OpenLayers 기반 지도 서비스

[![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react&logoColor=white)](https://reactjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.9.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![OpenLayers](https://img.shields.io/badge/OpenLayers-10.6.1-2E7D32)](https://openlayers.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-0EA5E9.svg)](LICENSE)

React + TypeScript 기반의 인터랙티브 WebGIS 애플리케이션입니다. OpenLayers를 활용하여 지도 검색, 거리/면적 측정, 즐겨찾기 등 다양한 지도 기반 서비스를 제공합니다.

## 🚀 라이브 데모

**[https://h2aler.github.io/WebGIS_React/](https://h2aler.github.io/WebGIS_React/)**

## ✨ 주요 기능

- **🔍 지도 검색**: Nominatim API를 활용한 도시/나라 검색 (자동완성, 키보드 탐색)
- **📏 거리 측정**: 실시간 거리 측정 및 구간별 배지 표시
- **📐 면적 측정**: 폴리곤 기반 면적 계산
- **⭐ 즐겨찾기**: 검색 결과 즐겨찾기 저장/관리 (로컬 스토리지)
- **🌓 테마 전환**: 라이트/다크 모드 지원
- **📱 반응형**: 모바일 친화적 디자인
- **🎛️ 레이어 전환**: OSM, 위성 이미지, 지형도 레이어 지원
- **💾 데이터 내보내기**: 측정 결과 GeoJSON 형태로 다운로드

## 🛠️ 기술 스택

| 기술 | 버전 | 용도 |
|---|---|---|
| React | 19.1.1 | UI 프레임워크 |
| TypeScript | 4.9.5 | 정적 타입 시스템 |
| OpenLayers | 10.6.1 | 지도 라이브러리 |
| Create React App | 5.0.1 | 프로젝트 설정 |
| CSS3 | - | 스타일링 |
| Nominatim API | - | 지오코딩 서비스 |

## 🚀 실행 방법

### 개발 환경

```bash
# 의존성 설치
npm install

# 개발 서버 실행 (포트 3000)
npm start
```

브라우저에서 [http://localhost:3000](http://localhost:3000)으로 접속하여 확인할 수 있습니다.

### 프로덕션 빌드

```bash
# 프로덕션 빌드
npm run build

# GitHub Pages 배포
npm run deploy
```

### 기타 스크립트

```bash
# 테스트 실행
npm test

# 프로젝트 설정 추출 (비권장)
npm run eject
```

## 📁 프로젝트 구조

```
src/
├── components/          # React 컴포넌트
│   ├── Map/            # 지도 컴포넌트
│   ├── Search/         # 검색 기능
│   ├── Tools/          # 측정 도구
│   ├── Sidebar/        # 사이드바
│   ├── Favorites/      # 즐겨찾기
│   └── Theme/          # 테마 토글
├── hooks/              # 커스텀 훅
│   ├── useMap.ts       # 지도 관련 훅
│   ├── useSearch.ts    # 검색 관련 훅
│   ├── useMeasurement.ts # 측정 관련 훅
│   ├── useFavorites.ts # 즐겨찾기 훅
│   └── useTheme.ts     # 테마 관련 훅
├── types/              # TypeScript 타입 정의
├── utils/              # 유틸리티 함수
└── App.tsx             # 메인 앱 컴포넌트
```

## 🎮 사용법

### 기본 조작
- **검색**: 상단 검색창에서 도시나 나라 이름 입력
- **측정**: 사이드바의 거리/면적 측정 도구 사용
- **즐겨찾기**: 검색 결과에서 ⭐ 버튼으로 추가
- **테마 변경**: 헤더의 🌓 버튼으로 라이트/다크 모드 전환

### 키보드 단축키
- `Enter`: 측정 완료
- `Esc`: 측정 취소
- `Backspace`: 마지막 점 되돌리기
- `↑/↓`: 검색 결과 탐색

## 🔧 개발 환경 설정

### 필수 요구사항
- Node.js 16 이상
- npm 또는 yarn

### VSCode 확장 프로그램 (권장)
- TypeScript Importer
- ES7+ React/Redux/React-Native snippets
- Prettier - Code formatter
- ESLint

## 📦 배포

이 프로젝트는 GitHub Pages에 자동 배포되도록 설정되어 있습니다.

```bash
# 배포 실행
npm run deploy
```

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 `LICENSE` 파일을 참조하세요.

## 🙏 감사 인사

- [OpenLayers](https://openlayers.org/) - 강력한 지도 라이브러리
- [Nominatim](https://nominatim.org/) - 오픈소스 지오코딩 서비스
- [Create React App](https://create-react-app.dev/) - React 프로젝트 설정
