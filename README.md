# data09-10 · Design Benchmarking Agent

Product Type·Tonnage·13개 경쟁사·목적으로 Scope를 정해 경쟁사 장비의 이미지·문서·제원을 모으고 Exterior/Cabin/CMF/Spec 기준으로 비교·리포트·정기 업데이트하는 디자인 벤치마킹 웹 에이전트

| 항목 | 내용 |
|---|---|
| 제출자 | 이동철 |
| 과정 | 현장 데이터 수집·디지털화 전문가과정 1차수 (2026) |
| 진행 단계 | 1단계 개발 완료 (2026-09-28) — https://aebonlee.github.io/data09-10/ |
| 다음 개발 | 2단계 — 코랩 Spec Extractor(PDF → 제원)·VLM 태그 PoC, 카탈로그 질의(Insight) PoC, 팀 공용 저장소 결정, Moodboard·Trend Matrix |

## 이 저장소 이용 안내

이 저장소는 수강생 본인의 과제입니다. **Fork 하거나 「Code → Download ZIP」으로 받아 가셔도 됩니다.**
강의 종료 후 일정 기간이 지나면 비공개로 전환되니, 계속 쓰실 분은 그 전에 받아 두세요.

## 실행 방법

**온라인에서 바로 쓰기: https://aebonlee.github.io/data09-10/**

내 PC에서 쓰려면 설치 없이 아래 두 방법 중 하나로 엽니다.

1. **파일로 바로 열기** — 이 폴더의 `index.html` 을 더블클릭해 크롬·엣지로 엽니다. 인터넷이 없어도 동작합니다(엑셀 라이브러리도 `vendor/` 에 들어 있습니다).
2. **간이 서버로 열기** — 폴더에서 `python3 -m http.server 8000` 을 실행하고 브라우저에서 `http://localhost:8000` 을 엽니다.

처음 열면 데이터가 비어 있습니다. 「06 가져오기·내보내기」의 **「예시 데이터 불러오기」** 를 누르면 시연용 가상 모델 14건과 Scope 1개가 들어가고, 화면 위에 「예시 데이터」 안내 띠가 표시됩니다.

- 예시 데이터는 **모두 가상**입니다. 모델명은 「예시-」로 시작하고, 제원·색·출처(example.com)·이미지(도형 SVG)는 시연용으로 만든 값입니다. 브랜드 칸만 부록 B 경쟁사 이름을 빌렸고, 그 회사의 실제 제품 정보가 아닙니다.
- 데이터는 **이 브라우저(localStorage)에만** 저장됩니다. 이미지는 긴 변 800px(설정 가능)로 줄여 보관하며, 브라우저 한도(대개 5MB 안팎)가 있으니 「JSON 백업(이미지 포함)」으로 나눠 보관하세요.
- 예시 파일(`samples/`, 모두 가상): `예시데이터_사내정리표.xlsx`·`.csv`(열 이름이 표준 Schema 와 다른 정리표 — 열 연결 연습용), `예시데이터_모델목록.xlsx`(이 도구의 내보내기 형식)
- 로직 테스트: `node test/logic.test.mjs` (의존성 없음)
- 예시 파일 다시 만들기: `node scripts/make-samples.js`

### 쓰는 순서

1. **01 Scope Setup** — Product Type → Tonnage(부록 C) → 경쟁사(부록 B 13개사) → Purpose 를 고르고 「범위 확정」. Scope ID 가 만들어지고 위쪽 칩에 표시됩니다.
2. **05 자료 등록** 또는 **06 가져오기** — 모델을 한 건씩 넣거나, 기존 엑셀 정리표를 열 연결로 한꺼번에 넣습니다.
3. **02 Status Dashboard** — 브랜드 × Tonnage 보유 현황, View 보유 현황, 필수 메타 누락을 확인하고 「보완」합니다.
4. **03 Card Gallery** — 필터로 좁혀 비교할 모델을 2~4개 담습니다.
5. **04 Side-by-Side** — 같은 View 끼리 이미지를 맞대고 비교표를 Excel·인쇄용 PDF 로 내보냅니다.

## 1단계 구현 범위

기획서 5장 기능 목록 기준입니다. 완료 = 이번 1단계 웹 도구에 들어감, 다음 단계 = 기획서 8장 2·3단계.

| 기능 (기획서 5장) | 상태 | 1단계에서 한 것 / 남은 것 |
|---|---|---|
| Scope Setup | 완료 | Excavator 6단계·Wheel Loader 5단계 조건부 톤급, 13개사 Multi-select(전체 선택·해제, 이 범위 보유 건수 표시), Purpose 7종, Scope ID 생성·저장·재적용·해제. ID 형식은 가정(기획서 10장 6번) |
| 자료 등록 | 완료 | 6절 Schema 10개 블록 전 필드, 제원(FACT)과 관찰(OBSERVATION) 구분, 이미지 파일 또는 경로 + View 지정(18절 5종 + 기타), 단위 변환(t→kg, hp→kW), 운전중량으로 톤급 자동, 중복 모델 차단, schema_version 기록 |
| 엑셀 일괄 가져오기 | 완료 | xlsx·csv, 시트·머리글 행 선택, 열 → Schema 자동 연결 후 수정, 머리글 단위 인식, 미리보기, 같은 브랜드+모델명은 갱신 |
| 필수 메타 점검 | 완료 | brand·model·category·collected_at·source URL·image 누락 표시(대시보드·갤러리·상세), 톤급과 운전중량 불일치 경고 |
| Status Dashboard | 완료 | 브랜드 × Tonnage 모델 수·이미지 수, View 보유 현황, 최근 수집일, Scope 브랜드만 보기 |
| Card Gallery | 완료 | 이미지 Grid + 핵심 스펙·태그, Scope·장비군·톤급·브랜드·연식·View·검증 상태·검색어·누락 필터 |
| Side-by-Side | 완료 | 2~4개, 같은 View 끼리 이미지 비교, 블록별 비교표(차이 행 강조·빈 항목 숨기기·차이만 보기) |
| Detail / Evidence | 완료 | 원본 이미지(View 전환), 제원, 관찰 블록(입력 출처 표시), Source URL·수집일·신뢰도, 입력자·검증 상태 |
| Report 내보내기 | 완료 | 비교표 Excel(비교표·출처·근거 시트), 인쇄용 PDF(브라우저 인쇄), CSV. 전체 KB 는 Excel·CSV·JSON 백업 |
| Moodboard · Trend Matrix | 다음 단계 | 2단계 |
| VLM 분석 · Spec Extractor | 다음 단계 | 2단계(코랩 PoC). 1단계는 결과를 붙일 자리(관찰 입력 출처 「AI 관찰」, confidence, extracted_text, 검증 상태)만 마련 |
| Hybrid 검색·Insight Chat | 다음 단계 | 2단계 PoC(Dify·NotebookLM) → 3단계 |
| 자동 수집 · 정기 업데이트 | 다음 단계 | 3단계 |
| Designer Validation → Tuning, PPTX 자동 생성, 권한·감사 로그 | 다음 단계 | 3단계 |

개발 기록: [docs/개발일지.md](docs/개발일지.md)

## 문서

- [프로젝트 기획서 (Markdown)](docs/01_프로젝트_기획서.md)
- [프로젝트 기획서 (Word, docx)](docs/01_프로젝트_기획서.docx)
- [패들릿 제출 원문](docs/source/패들릿_제출_원문.md)

## 제출 자료 (`docs/source/`)

- `01___________Design_Benchmarking_Agent__________v3_docx.pdf`
- `02_Design_Benchmarking_Agent_Web_Prototype.zip`

## 진행 순서

1. 기획서 확정 — 수강생 확인 후 v1.0
2. 1단계 개발 — 지금 있는 자료로 만들 수 있는 부분부터
3. 수강생 실제 데이터로 검증 · 보완
