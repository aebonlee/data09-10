# Supabase DB 스크립트

이 폴더에는 이 도구의 저장 데이터를 PostgreSQL(Supabase)로 옮길 때 쓰는 스키마가 들어 있습니다.
지금 도구는 아직 브라우저 저장소(localStorage)만 씁니다.
DB 에 연결하는 코드는 다음 단계에서 붙입니다.

## 왜 DB 가 필요한가

지금은 모든 저장값이 브라우저 localStorage 의 `data09-10.db` 한 칸에 들어 있습니다.
그래서 다음과 같은 한계가 있습니다.

- **이미지 때문에 금방 가득 찹니다.** 모델마다 View 별 이미지를 줄여 넣어도 localStorage 는 보통 5MB 안팎입니다. 모델이 수십 건만 되어도 저장이 실패하고, 도구는 「이번 창의 메모리에만 있음」 상태로 떨어집니다.
- **디자이너끼리 자료를 모을 수 없습니다.** 벤치마킹 자료는 여러 사람이 나눠 수집합니다. 그런데 각자의 브라우저에만 있으면 Status Dashboard 의 브랜드 × 톤급 현황이 사람마다 다르게 나옵니다.
- **자료가 사라질 수 있습니다.** 브라우저 데이터를 지우거나 PC 를 바꾸면 수집일·출처·검증 상태가 함께 사라집니다.
- **Scope 로 걸러 보는 일이 느려집니다.** 모델이 늘면 장비군·톤급·브랜드로 거르는 일은 DB 색인이 훨씬 빠릅니다.

## 테이블

| 테이블 | 용도 | localStorage 대응 |
|---|---|---|
| `workspace` | 이미지 설정, 적용 중인 Scope, 비교 선택 목록(최대 4개), 예시 여부 (1인 1행) | `data09-10.db` 의 `settings` · `activeScope` · `compare` · `_sample` |
| `benchmark_scope` | Benchmark Scope (장비군 × 톤급 × 경쟁사 × 목적) | `data09-10.db` 의 `scopes[]` |
| `benchmark_model` | 모델 1건 — 제출 기획서 6절 Schema 10개 블록의 필드 | `data09-10.db` 의 `models[]` |
| `model_media` | 모델 이미지(View 별), 모델마다 여러 장 | `data09-10.db` 의 `models[].media[]` |
| `design_feedback` | 전문가(디자이너) 피드백 — 리포트 항목·모델별 평가(1~5)·코멘트·작성자·시각·상태 (2026-09-29) | `data09-10.db` 의 `feedback[]` |
| `ops_history` | 정기 업데이트 사이클 완료 이력 (2026-09-29) | `data09-10.db` 의 `ops.history[]` |
| `report_period` | **과제 B** 보고서 1건 — 주간/월간 · 기간 · 제목 · 요약 · 초안/승인 | `data09-10.report` 의 `settings` · `summaryOverride` · `approved` |
| `report_mail` | **과제 B** 근거 메일 **메타만** — 보낸이·날짜·제목·정규화 제목·첨부 파일명·Message-ID. **본문 칸 없음** | `data09-10.report` 의 `mails[]` (본문 `text`·`main` 은 옮기지 않음) |
| `report_item` | **과제 B** 실적·계획·이슈 항목 + 근거 메일 ID 목록 | `data09-10.report` 의 `items[]` |
| `report_carryover` | **과제 B** 이전 보고서 계획 대비(제안·확정) | `data09-10.report` 의 `prevPlansText` · `carryFinal` |
| `report_history` | **과제 B** 승인한 보고서 기록(계획 스냅숏, 기록성) | `data09-10.report` 의 `history[]` |

**과제 B 는 메일 본문을 DB 에 저장하지 않는 설계입니다.** 사내 메일에는 기밀·개인정보가 섞여 있고(제출 기획서 7.1 「필요 최소한으로 처리」), 보고서에 필요한 것은 항목 문장과 「어느 메일이 근거인가」뿐입니다. 원문이 필요하면 Message-ID·제목·날짜로 Outlook 에서 다시 찾습니다. 규칙·AI 항목은 근거 메일이 있거나 상태가 「확인 필요」여야 저장됩니다(제출 기획서 설계 원칙 「확인 못 한 것은 확정하지 않는다」를 DB 제약으로도 막음). 보고서를 지우면 항목·이전 계획 판정도 지워지지만 승인 이력(`report_history`)은 남습니다. 도구의 「이력 삭제」 버튼과 달리 DB 에서는 이력을 지울 수 없습니다.

2026-09-29 에 `workspace` 에 운영 루프 설정(`update_cycle`·`stale_days`·`last_update`·`ops_steps`)과 인사이트 요약 코멘트(`insight_note`…)가, `benchmark_model` 에 평가 점수 4칸(`score_exterior`·`score_cabin`·`score_cmf`·`score_service`, 1~5)이 붙었습니다. 이미 표를 만든 프로젝트도 `schema.sql` 을 다시 실행하면 칸이 더해지고 경쟁사 제약이 14개사로 바뀝니다.

필드 이름은 도구의 이름(제출 기획서 6절 Schema)을 그대로 썼습니다.
모델·Scope 의 `id` 는 표의 기본키 `id` 와 겹치므로 `model_id`('M0001')·`scope_id`('EXC-MED-006-TT')로 둡니다.
이미지 한 장이 붙는 모델은 `model_ref`(모델 행의 기본키)로 가리킵니다.

기록성 데이터는 `design_feedback`·`ops_history`·`report_history` 세 표입니다. 쌓기만 하고 고치거나 지울 수 없습니다. 피드백은 반영 여부(`status`·`resolved_at`) 칸만 바꿀 수 있습니다(칸 단위 GRANT).

### 권한

- 모든 표에 RLS(행 수준 보안)를 켰습니다.
- 모든 행은 만든 사람만 보고 고칠 수 있습니다(`owner_id = auth.uid()`). `owner_id` 는 로그인한 사용자로 자동으로 채워집니다.
- 이미지는 본인 행이면서 붙는 모델도 본인 것이어야 등록됩니다. 남의 모델 번호를 알아내도 이미지를 끼워 넣을 수 없습니다.
- 로그인하지 않은 사용자(anon)는 어떤 표도 읽거나 쓸 수 없습니다.
- 장비군·톤급 조합(부록 C), 경쟁사 14개사(부록 B 13개사 + Mecalac), Benchmark Purpose 7종, View 6종, 검증 상태 4종은 DB 제약(CHECK)으로 막습니다.
- 같은 브랜드·모델명, 같은 model_id·scope_id 가 두 번 들어가지 않도록 UNIQUE 제약을 두었습니다. 앱에서 upsert 할 때는 `onConflict` 를 표의 UNIQUE 조합(예: `owner_id,model_id`)으로 지정해야 합니다.
- 모델을 지우면 그 모델의 이미지도 함께 지워집니다.

### 이미지 저장에 대해

`model_media.data` 에는 지금 도구처럼 브라우저에서 줄인 JPEG 의 data URL 을 그대로 넣을 수 있습니다.
장수가 많아지면 Supabase Storage 에 파일을 올리고 `path` 에 경로만 남기는 방식이 낫습니다.
이것도 다음 단계에서 정합니다.

## 적용 방법

1. <https://supabase.com> 에 가입합니다.
2. 새 프로젝트를 만듭니다. 이 도구 전용으로 본인 프로젝트를 쓰는 것을 전제로 하므로 테이블 이름에 접두사를 붙이지 않았습니다.
3. 왼쪽 메뉴에서 **SQL Editor** 를 엽니다.
4. `supabase/schema.sql` 의 내용을 전부 붙여넣습니다.
5. **Run** 을 누릅니다.

여러 번 실행해도 안전합니다. 이미 있는 표는 건너뛰고 정책·트리거는 지우고 다시 만듭니다.

## 확인 방법

1. 왼쪽 메뉴 **Table Editor** 에 위 11개 표(과제 A 6 + 과제 B 5)가 보이는지 확인합니다.
2. 각 표 이름 옆에 RLS 가 켜져 있는지(「RLS disabled」 경고가 없는지) 확인합니다.
3. **Authentication → Policies** 에서 처음 4개 표에는 SELECT·INSERT·UPDATE·DELETE 정책 4개, `design_feedback` 에는 SELECT·INSERT·UPDATE 3개, `ops_history` 에는 SELECT·INSERT 2개, 과제 B 의 `report_period`·`report_mail`·`report_item`·`report_carryover` 에는 4개씩, `report_history` 에는 SELECT·INSERT 2개(모두 39개)가 붙어 있는지 봅니다.
4. SQL Editor 에서 아래를 실행해 함수 권한에 `anon` 이 없는지 봅니다.

```sql
select proname, proacl from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public';
```

## 앱 연결은 다음 단계입니다

이 스크립트는 표와 권한만 만듭니다. 도구의 `js/store.js` 는 아직 localStorage 를 씁니다.
Supabase 에 저장하려면 다음 단계에서 로그인과 저장·불러오기 코드를 붙여야 합니다.

## 로컬 검증 방법

운영에서 처음 실행하지 않도록, 임시 로컬 PostgreSQL 에 실제로 적용해 검사하는 도구를 함께 두었습니다.

```sh
./scripts/sqltest/run.sh
```

PostgreSQL 16 이상이 필요합니다(macOS: `brew install postgresql@17`).
임시 DB 를 만들어 쓰고 끝나면 지우므로 기존 설치에는 영향이 없습니다.

검사 내용은 다음과 같습니다.

- 스키마를 두 번 적용해도 오류가 없는가
- 사용자 A 의 행이 사용자 B 에게 보이지 않고, 고치거나 지울 수도 없는가
- 남의 모델에 이미지를 끼워 넣을 수 없는가
- (과제 B) 남의 보고서에 항목·이전 계획 판정을 끼워 넣을 수 없는가, 근거 없는 규칙·AI 항목이 「완료」로 저장되지 않는가, 메일 본문 칸이 없는가, 보고 이력을 고치거나 지울 수 없는가
- 로그인하지 않은 사용자는 아무것도 읽거나 쓸 수 없는가
- CHECK·UNIQUE 제약이 잘못된 값과 중복을 막는가
- 함수 실행 권한에 PUBLIC·anon 이 남지 않았는가

검사용 SQL(`scripts/sqltest/*.local.sql`)은 로컬 전용입니다.
Supabase 운영 DB 에서 실행하면 스스로 멈추도록 가드가 들어 있습니다.
