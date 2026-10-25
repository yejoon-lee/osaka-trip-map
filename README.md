# 오사카 장소 지도

한국어 모바일 우선 Explore 지도. 빌드 단계나 런타임 npm 의존성 없이 정적 파일로 실행합니다.

## 로컬 실행

```sh
cd osaka-trip-map
python3 -m http.server 8080 --bind 127.0.0.1
```

브라우저에서 `http://127.0.0.1:8080`을 엽니다. `places.json`을 fetch하므로 파일을 직접 더블클릭하는 방식은 지원하지 않습니다.

## 테스트

Node.js 22 이상을 사용합니다. 순수 함수와 실제 데이터 검증:

```sh
node --test tests/core.test.mjs tests/data.test.mjs
```

실제 Chromium 브라우저 테스트까지 실행하려면 (테스트 전용 도구이며 앱 의존성이 아님):

```sh
npm install --prefix .test-tools --no-save --package-lock=false playwright
node .test-tools/node_modules/playwright/cli.js install chromium
node --test tests/*.test.mjs
```

브라우저 테스트는 임시 로컬 HTTP 서버를 자동으로 띄우고 종료합니다. 테스트용 장소는 네트워크 응답으로만 주입하며 실제 `places.json`은 수정하지 않습니다. 390×844 및 1440×844 레이아웃, 검색·지역·호텔 필터, 초기화, 빈 결과, 비신뢰 문자열, 라이브러리/타일 실패, 실제 Leaflet 마커 클러스터·팝업, 필터 유지, 위치 권한의 클릭 전 미요청을 검증합니다.

## 동작과 데이터

- 카테고리 수는 현재 검색어와 지역 조건을 반영하며, 선택한 카테고리 자체는 집계에서 제외합니다.
- 초기 지도는 오사카 도심을 우선합니다. USJ 필터 또는 검색은 해당 장소를 지도에 포함하며, `전체 범위`는 모든 장소 좌표에 맞춥니다. `결과 맞춤`은 현재 필터 결과 전체에 맞춥니다.
- 카드 → 마커 팝업, 마커 → 카드 강조, 팝업의 `목록에서 보기`로 키보드 포커스 이동을 지원합니다. 겹치는 좌표는 클러스터/펼침으로 접근합니다.
- `호텔 보기`는 다른 필터를 초기화하고 일반 호텔 카테고리만 표시합니다.
- `내 위치`를 누르기 전에는 위치 권한을 요청하지 않습니다. 앱은 위치를 별도로 저장하지 않습니다. 지도 이용 시 OpenStreetMap 타일 서버에 네트워크 요청이 발생합니다.
- `places.json`의 원본 메타데이터만 표시합니다. 빈 주소/메모는 생략하며, 출처 링크가 없거나 안전하지 않으면 이름·좌표 기반 Google Maps 검색 링크를 생성합니다.
- 출처는 Google Maps 저장 목록의 스냅샷입니다. 가격·재고·영업 정보는 실시간이 아닙니다.
- 외부 지도 또는 타일이 실패해도 장소 목록과 Google Maps 링크는 사용할 수 있습니다. 최초 데이터 로딩 실패 시 오류 메시지를 표시합니다.

## 파일

`index.html`, `styles.css`, `app.js`는 UI, `core.mjs`는 순수 필터·집계·지도 범위·링크 함수입니다. `vendor/`에는 Leaflet 1.9.4와 Leaflet.markercluster 1.5.3 및 라이선스가 있습니다. 지도 타일은 OpenStreetMap을 사용하며 지도에 저작자 표시를 유지합니다. `.nojekyll`은 정적 호스팅용입니다.

배포 시 테스트 도구 `.test-tools/`와 테스트 증거 파일은 제외하세요. GitHub Pages는 `main` 브랜치 루트에서 정적 파일을 제공합니다. 원본 공유 목록의 변경 사항은 자동 동기화되지 않습니다.
