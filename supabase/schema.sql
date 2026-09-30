-- ============================================================================
-- data09-10 — Design Benchmarking Agent (경쟁사 디자인 벤치마킹 자료 DB)
-- Supabase(PostgreSQL) DB 스키마 + RLS
--
--  실행 위치 : 수강생 본인 Supabase 프로젝트의 SQL Editor 에서 실행
--              (Dashboard → SQL Editor → 이 파일 전체를 붙여넣고 Run)
--  재실행    : 안전합니다 (IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS 선행)
--
--  지금 도구는 브라우저 localStorage 의 `data09-10.db` 한 칸에 전부 저장합니다.
--  그 안의 묶음을 아래 표로 나눴습니다. 필드 이름은 도구의 이름(제출 기획서 6절
--  Schema)을 그대로 썼습니다. 모델·Scope 의 id 는 표의 기본키 id 와 겹치므로
--  model_id('M0001')·scope_id('EXC-MED-006-TT') 로 둡니다.
--
--  표 목록
--    workspace        설정 · 적용 중인 Scope · 비교 목록 · 예시 여부   (1인 1행)
--    benchmark_scope  Benchmark Scope (장비군 × 톤급 × 경쟁사 × 목적)
--    benchmark_model  모델 1건 = 6절 Schema 10개 블록의 필드
--    model_media      모델 이미지(View 별) — 모델마다 여러 장
--    design_feedback  전문가(디자이너) 피드백 — 리포트 항목·모델별 평가·코멘트 (기록성, 2026-09-29)
--    ops_history      정기 업데이트 사이클 완료 이력 (기록성, 2026-09-29)
--  과제 B — 업무보고 Agent (2026-09-29 추가, report/index.html · localStorage `data09-10.report`)
--    report_period    보고서 1건 = 보고 유형(주간·월간) × 기간 · 제목 · 요약 · 승인 상태
--    report_mail      근거 메일 메타(보낸이·날짜·제목·첨부 파일명·업무 묶음) — 본문 원문은 저장하지 않는다
--    report_item      실적·계획·이슈 항목 1건 + 근거 메일 ID 목록
--    report_carryover 이전 보고서 계획 대비 판정(완료·진행·지연·이월)
--    report_history   승인한 보고서 기록(계획 스냅숏) — 다음 보고의 「이전 계획」 (기록성)
--
--  권한 원칙 : 모든 행은 만든 사람(owner_id = auth.uid())만 보고 고칩니다.
--              기록성 표(design_feedback·ops_history·report_history)는 고치거나 지울 수 없습니다.
--              피드백은 상태(status·resolved_at) 칸만 바꿀 수 있습니다(칸 단위 GRANT).
--  이 스키마는 수강생 본인 프로젝트 전제라 테이블 이름에 접두사를 붙이지 않았습니다.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. 테이블
-- ----------------------------------------------------------------------------

-- 작업 공간 — localStorage 의 settings · activeScope · compare · _sample
create table if not exists public.workspace (
  owner_id        uuid primary key default auth.uid(),
  image_max_px    int not null default 800 check (image_max_px between 200 and 4000),
  image_quality   numeric not null default 0.8 check (image_quality > 0.1 and image_quality <= 1),
  active_scope    text not null default '',              -- 적용 중인 scope_id ('' = 전체 보기)
  compare         text[] not null default '{}'           -- 비교 선택 model_id, 최대 4개
                  check (cardinality(compare) <= 4),
  sample          boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Benchmark Scope — 같은 선택이면 재사용, 기본 ID 가 겹치면 -2, -3 … 을 붙인다
create table if not exists public.benchmark_scope (
  id              bigint generated always as identity primary key,
  owner_id        uuid not null default auth.uid(),
  scope_id        text not null check (scope_id ~ '^(EXC|WHL)-[A-Z]{3}-[0-9]{3}-[A-Z]+(-[0-9]+)?$'),
  equipment_type  text not null check (equipment_type in ('Excavator', 'Wheel Loader')),
  tonnage_class   text not null,
  brands          text[] not null check (cardinality(brands) >= 1),
  purposes        text[] not null check (cardinality(purposes) >= 1),
  scope_version   int  not null default 1 check (scope_version >= 1),
  schema_version  text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- 부록 C: 장비군마다 고를 수 있는 톤급 코드가 다르다
  constraint benchmark_scope_tonnage check (
    (equipment_type = 'Excavator'    and tonnage_class in ('MIC', 'MNI', 'MID', 'MED', 'LRG', 'MNG')) or
    (equipment_type = 'Wheel Loader' and tonnage_class in ('CMP', 'SML', 'MED', 'LRG', 'MNG'))),
  -- 경쟁사 Universe 제약(benchmark_scope_brands)은 아래 1-b 에서 붙인다 — 목록이 바뀌면 지우고 다시 만들기 위해
  -- 제출 기획서 3절 Benchmark Purpose 7종
  constraint benchmark_scope_purposes check (purposes <@ array[
    'Exterior', 'Cabin', 'CMF', 'Trend', 'Serviceability', 'Safety', 'Full Benchmark']::text[]),
  -- upsert onConflict = 'owner_id,scope_id'
  constraint benchmark_scope_uniq unique (owner_id, scope_id)
);

-- 모델 1건 — 6절 Schema 10개 블록. 비어 있는 칸은 '' 로 둔다(도구와 같다).
create table if not exists public.benchmark_model (
  id                      bigint generated always as identity primary key,
  owner_id                uuid not null default auth.uid(),
  model_id                text not null check (model_id ~ '^M[0-9]{4,}$'),       -- 'M0001'
  -- Identity
  equipment_type          text not null check (equipment_type in ('Excavator', 'Wheel Loader')),
  brand                   text not null check (length(trim(brand)) > 0),
  model_name              text not null check (length(trim(model_name)) > 0),
  product_class           text not null default '',
  tonnage_class           text not null default ''
                          check (tonnage_class in ('', 'MIC', 'MNI', 'MID', 'MED', 'LRG', 'MNG', 'CMP', 'SML')),
  operating_weight_range  text not null default '',
  generation              text not null default '',
  release_year            int check (release_year between 1900 and 2100),
  -- Source / Provenance
  source_url              text not null default '',
  source_type             text not null default ''
                          check (source_type in ('', 'OEM 공식', '공식 Press/Exhibition', '신뢰 미디어', '카탈로그 PDF', '사내 자료', '기타')),
  publisher               text not null default '',
  collected_at            date,
  original_file           text not null default '',
  source_reliability      text not null default ''
                          check (source_reliability in ('', '1 공식 OEM', '2 공식 Press/Exhibition', '3 신뢰 미디어', '4 기타')),
  -- Design
  form_language           text not null default '',
  character_line          text not null default '',
  volume_balance          text not null default '',
  surface_edge            text not null default '',
  proportion              text not null default '',
  design_tags             text[] not null default '{}',
  -- Cabin / HMI
  glass_area              text not null default '',
  pillar_design           text not null default '',
  visibility              text not null default '',
  console_layout          text not null default '',
  joystick                text not null default '',
  seat                    text not null default '',
  display                 text not null default '',
  hvac                    text not null default '',
  -- CMF
  main_color              text not null default '',
  accent_color            text not null default '',
  underbody_color         text not null default '',
  material                text not null default '',
  finish                  text not null default '',
  gloss                   text not null default '',
  texture                 text not null default '',
  -- Engineering (FACT — 원문 대조 대상)
  operating_weight        numeric check (operating_weight >= 0),   -- kg
  engine_power            numeric check (engine_power >= 0),       -- kW
  dimensions              text not null default '',
  bucket_capacity         numeric check (bucket_capacity >= 0),    -- m³
  powertrain              text not null default '',
  -- Service / Safety
  maintenance_access      text not null default '',
  door_parting            text not null default '',
  hinge                   text not null default '',
  sensor_camera           text not null default '',
  safety_label            text not null default '',
  access                  text not null default '',
  -- AI / Evidence
  obs_origin              text not null default '디자이너 입력' check (obs_origin in ('디자이너 입력', 'AI 관찰')),
  confidence              numeric check (confidence between 0 and 1),
  extracted_text          text not null default '',
  evidence_image          text not null default '',
  human_review_status     text not null default '미검토' check (human_review_status in ('미검토', '검토중', '확정', '반려')),
  reviewer_note           text not null default '',
  entered_by              text not null default '',
  prompt_version          text not null default '',
  embedding_id            text not null default '',
  -- Benchmark Scope
  benchmark_scope_id      text not null default '',
  schema_version          text not null default '',
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  -- upsert onConflict = 'owner_id,model_id'
  constraint benchmark_model_uniq unique (owner_id, model_id),
  -- 같은 브랜드·모델명이 두 번 등록되지 않게 한다 (도구의 duplicate 검사를 DB 에서도)
  constraint benchmark_model_brand_model_uniq unique (owner_id, brand, model_name)
);
create index if not exists benchmark_model_filter_idx
  on public.benchmark_model (owner_id, equipment_type, tonnage_class, brand);

-- 모델 이미지 — 도구의 media[] 한 칸이 한 행
--  data 는 브라우저에서 줄인 JPEG 의 data URL 이다. 장수가 늘면 Supabase Storage 로
--  옮기고 여기에는 경로(path)만 남기는 것이 낫다(다음 단계).
create table if not exists public.model_media (
  id           bigint generated always as identity primary key,
  owner_id     uuid not null default auth.uid(),
  model_ref    bigint not null references public.benchmark_model(id) on delete cascade,
  media_id     text not null,                                   -- 'img1'
  view_type    text not null default '기타'
               check (view_type in ('Side', 'Front-Quarter', 'Rear-Quarter', 'Rear', 'Cabin', 'CMF Detail', '기타')),
  path         text not null default '',
  data         text not null default '',
  media_type   text not null default '',
  resolution   text not null default '',
  crop_region  text not null default '',
  caption      text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- 경로도 파일도 없는 이미지는 도구가 버린다
  constraint model_media_has_source check (length(trim(path)) > 0 or length(data) > 0),
  -- upsert onConflict = 'model_ref,media_id'
  constraint model_media_uniq unique (model_ref, media_id)
);
create index if not exists model_media_model_idx on public.model_media (model_ref);

-- ----------------------------------------------------------------------------
-- 1-b. 2026-09-29 변경분 — 이미 표를 만든 프로젝트에도 그대로 다시 실행하면 적용된다
-- ----------------------------------------------------------------------------

-- 경쟁사 Universe: 부록 B 13개사 + Mecalac(수강생 요청) = 14개사
alter table public.benchmark_scope drop constraint if exists benchmark_scope_brands;
alter table public.benchmark_scope add constraint benchmark_scope_brands check (brands <@ array[
  'Caterpillar (CAT)', 'Komatsu', 'XCMG', 'John Deere', 'Liebherr', 'Sany', 'Volvo CE',
  'Hitachi Construction Machinery', 'JCB', 'Bobcat', 'Kubota', 'Yanmar', 'Kobelco', 'Mecalac']::text[]);

-- 디자이너 평가 점수 4축(1~5, 관찰 OBSERVATION)
alter table public.benchmark_model add column if not exists score_exterior int check (score_exterior between 1 and 5);
alter table public.benchmark_model add column if not exists score_cabin    int check (score_cabin between 1 and 5);
alter table public.benchmark_model add column if not exists score_cmf      int check (score_cmf between 1 and 5);
alter table public.benchmark_model add column if not exists score_service  int check (score_service between 1 and 5);

-- 운영 루프 설정 · 인사이트 요약 코멘트 (localStorage 의 ops · insightNote · lastAuthor)
alter table public.workspace add column if not exists update_cycle text not null default 'monthly'
  check (update_cycle in ('weekly', 'biweekly', 'monthly', 'quarterly'));
alter table public.workspace add column if not exists stale_days int not null default 180 check (stale_days between 7 and 3650);
alter table public.workspace add column if not exists last_update date;
alter table public.workspace add column if not exists ops_steps jsonb not null default '{}'::jsonb;  -- {단계id: 체크한 날}
alter table public.workspace add column if not exists insight_note text not null default '';
alter table public.workspace add column if not exists insight_note_origin text not null default ''
  check (insight_note_origin in ('', '디자이너 작성', 'AI 요약(검토 필요)'));
alter table public.workspace add column if not exists insight_note_saved_at text not null default '';
alter table public.workspace add column if not exists last_author text not null default '';

-- 전문가(디자이너) 피드백 — 쌓기만 한다. 내용은 못 고치고 상태만 바꾼다
create table if not exists public.design_feedback (
  id            bigint generated always as identity primary key,
  owner_id      uuid not null default auth.uid(),
  feedback_id   text not null check (feedback_id ~ '^FB[0-9]{4,}$'),               -- 'FB0001'
  target        text not null check (target ~ '^model:M[0-9]{4,}$' or target in
                ('overview', 'brands', 'scores', 'sw', 'trend', 'note', 'compare', 'feedback', 'ops')),
  type          text not null check (type in ('동의(수정 없음)', '분석 결과 수정 필요', '디자인 Tag 보정',
                                              'Taxonomy·기준 조정', '예외 사례 등록', '추가 분석 요청')),
  rating        int  not null check (rating between 1 and 5),
  comment       text not null default '',
  author        text not null check (length(trim(author)) > 0),
  scope_id      text not null default '',
  written_at    timestamptz not null default now(),
  status        text not null default '열림' check (status in ('열림', '반영됨')),
  resolved_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- 「동의」가 아니면 무엇을 고칠지 적어야 한다 (도구의 validateFeedback 과 같다)
  constraint design_feedback_comment check (type = '동의(수정 없음)' or length(trim(comment)) > 0),
  -- upsert onConflict = 'owner_id,feedback_id'
  constraint design_feedback_uniq unique (owner_id, feedback_id)
);

-- 정기 업데이트 사이클 완료 이력 — 쌓기만 한다
create table if not exists public.ops_history (
  id            bigint generated always as identity primary key,
  owner_id      uuid not null default auth.uid(),
  done_on       date not null,
  cycle         text not null default '' check (cycle in ('', 'weekly', 'biweekly', 'monthly', 'quarterly')),
  steps_done    text[] not null default '{}',
  note          text not null default '',
  models        int  not null default 0 check (models >= 0),
  created_at    timestamptz not null default now()
);
create index if not exists ops_history_owner_idx on public.ops_history (owner_id, done_on desc);

-- ----------------------------------------------------------------------------
-- 1-d. 2026-09-29 오후 수강생 답변 반영 — 다시 실행하면 이미 만든 표에도 적용된다
--   · 디자인 평가 점수 0~5 (예전 1~5 값은 그대로 유효)
--   · 운영 기본값: 주간 · 오래된 자료 15년(5479일), 기준 상한 30년(10958일)
--   · 리포트 항목에 「디자인 평가」(evaluation) 추가 → 피드백 대상 허용
--   제약 이름은 PostgreSQL 이 칸 제약에 붙인 이름(<표>_<칸>_check)이다. 지우고 다시 만든다.
-- ----------------------------------------------------------------------------
do $sc$
declare c text;
begin
  foreach c in array array['score_exterior', 'score_cabin', 'score_cmf', 'score_service']
  loop
    execute format('alter table public.benchmark_model drop constraint if exists %I', 'benchmark_model_' || c || '_check');
    execute format('alter table public.benchmark_model add constraint %I check (%I between 0 and 5)', 'benchmark_model_' || c || '_check', c);
  end loop;
end;
$sc$;
alter table public.workspace alter column update_cycle set default 'weekly';
alter table public.workspace alter column stale_days set default 5479;
alter table public.workspace drop constraint if exists workspace_stale_days_check;
alter table public.workspace add constraint workspace_stale_days_check check (stale_days between 7 and 10958);
alter table public.design_feedback drop constraint if exists design_feedback_target_check;
alter table public.design_feedback add constraint design_feedback_target_check check (target ~ '^model:M[0-9]{4,}$' or target in
  ('overview', 'evaluation', 'brands', 'scores', 'sw', 'trend', 'note', 'compare', 'feedback', 'ops'));

-- ----------------------------------------------------------------------------
-- 1-e. 2026-09-29 오후 늦게 — 수강생 「BM Agent 평가 점수 기준 자료」 · 오래된 자료 20년
--   · 평가 8기준(비중 15·15·10·15·10·15·10·10) × 디자이너 점수(score_*) · AI 점수(ai_*) · 근거/코멘트(note_*)
--     척도는 자료의 5점 Scale(1 개선 필요 ~ 5 Benchmark 수준) → 1~5
--   · 예전 4축 칸(score_exterior·score_cabin·score_cmf·score_service, 0~5)은 지우지 않고 남긴다(도구의 legacy_scores)
--   · 오래된 자료 기준 기본값 20년(7305일) — 수집일 기준
--   다시 실행해도 된다(칸은 if not exists, 제약은 지우고 다시 만든다).
-- ----------------------------------------------------------------------------
do $ev$
declare c text;
begin
  foreach c in array array['proportion', 'form', 'ext_cmf', 'int_arch', 'int_cmf', 'ergonomics', 'hmi', 'identity']
  loop
    execute format('alter table public.benchmark_model add column if not exists %I int', 'score_' || c);
    execute format('alter table public.benchmark_model add column if not exists %I int', 'ai_' || c);
    execute format('alter table public.benchmark_model add column if not exists %I text not null default %L', 'note_' || c, '');
    execute format('alter table public.benchmark_model drop constraint if exists %I', 'benchmark_model_score_' || c || '_check');
    execute format('alter table public.benchmark_model add constraint %I check (%I between 1 and 5)', 'benchmark_model_score_' || c || '_check', 'score_' || c);
    execute format('alter table public.benchmark_model drop constraint if exists %I', 'benchmark_model_ai_' || c || '_check');
    execute format('alter table public.benchmark_model add constraint %I check (%I between 1 and 5)', 'benchmark_model_ai_' || c || '_check', 'ai_' || c);
  end loop;
end;
$ev$;
comment on column public.benchmark_model.score_exterior is '예전 4축(v0.2~v0.3) — 계산에 쓰지 않음. 2026-09-29 오후 늦게 8기준(score_proportion …)으로 바뀜';
alter table public.workspace alter column stale_days set default 7305;

-- ----------------------------------------------------------------------------
-- 1-f. 2026-09-30 — 보고서 목적별 비중 프로필 · 버전 관리 (평가 기준 자료 8절 「가중치 버전 관리」)
--   · workspace.weight_profile — 지금 쓰는 프로필 id (full · exterior · cabin · cmf · usability · identity · u1 …)
--   · weight_version — 프로필마다 비중을 바꿀 때마다 한 줄씩 쌓는다(기록성: 고치거나 지울 수 없다)
--     비중 8칸은 0~100 정수, 합 100. 도구의 validateWeights 와 같은 규칙.
-- ----------------------------------------------------------------------------
alter table public.workspace add column if not exists weight_profile text not null default 'full';
create table if not exists public.weight_version (
  id            bigint generated always as identity primary key,
  owner_id      uuid not null default auth.uid(),
  profile_id    text not null check (profile_id ~ '^(full|exterior|cabin|cmf|usability|identity|u[0-9]+)$'),
  profile_name  text not null check (length(trim(profile_name)) > 0),
  version       int  not null check (version >= 1),
  weights       jsonb not null,
  saved_at      timestamptz not null default now(),
  author        text not null default '',
  memo          text not null default '',
  constraint weight_version_keys check (weights ?& array['proportion','form','ext_cmf','int_arch','int_cmf','ergonomics','hmi','identity']),
  constraint weight_version_range check (
    (weights->>'proportion')::int between 0 and 100 and (weights->>'form')::int between 0 and 100 and
    (weights->>'ext_cmf')::int between 0 and 100 and (weights->>'int_arch')::int between 0 and 100 and
    (weights->>'int_cmf')::int between 0 and 100 and (weights->>'ergonomics')::int between 0 and 100 and
    (weights->>'hmi')::int between 0 and 100 and (weights->>'identity')::int between 0 and 100),
  constraint weight_version_sum check (
    (weights->>'proportion')::int + (weights->>'form')::int + (weights->>'ext_cmf')::int + (weights->>'int_arch')::int +
    (weights->>'int_cmf')::int + (weights->>'ergonomics')::int + (weights->>'hmi')::int + (weights->>'identity')::int = 100),
  -- upsert 하지 않는다(쌓기만). 같은 프로필·버전 중복만 막는다
  constraint weight_version_uniq unique (owner_id, profile_id, version)
);

-- ----------------------------------------------------------------------------
-- 1-g. 2026-09-30 — 이미지 View 에 Rear-Quarter(후면 사선) 추가 (수강생 요청 「장비 이미지 View 에 'Rear quarter'」)
--   이미 표를 만든 프로젝트는 위 create table 이 건너뛰어지므로 CHECK 를 다시 건다(다시 실행해도 안전).
-- ----------------------------------------------------------------------------
alter table public.model_media drop constraint if exists model_media_view_type_check;
alter table public.model_media add constraint model_media_view_type_check
  check (view_type in ('Side', 'Front-Quarter', 'Rear-Quarter', 'Rear', 'Cabin', 'CMF Detail', '기타'));

-- ----------------------------------------------------------------------------
-- 1-c. 과제 B — 업무보고 Agent (2026-09-29 추가)
--
--  설계: 메일 본문 원문은 DB 에 두지 않는다. 사내 메일은 기밀·개인정보가 섞여 있고
--        (제출 기획서 7.1 「필요 최소한으로 처리」), 보고서에 필요한 것은 항목 문장과
--        「어느 메일이 근거인가」뿐이라서다. 원문이 필요하면 Outlook 에서 mail_id·
--        message_id·제목·날짜로 다시 찾는다. (도구는 브라우저 안에서만 본문을 읽는다)
-- ----------------------------------------------------------------------------

-- 보고서 1건 — 같은 사용자·유형·시작일이면 같은 보고서(upsert onConflict = 'owner_id,report_type,period_start')
create table if not exists public.report_period (
  id              bigint generated always as identity primary key,
  owner_id        uuid not null default auth.uid(),
  report_type     text not null check (report_type in ('weekly', 'monthly')),
  period_start    date not null,
  period_end      date not null,
  title           text not null default '',
  author          text not null default '',
  summary         text not null default '',          -- 직접 쓴 요약(비우면 도구가 계산)
  status          text not null default '초안' check (status in ('초안', '승인')),
  approved_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint report_period_range check (period_end >= period_start and period_end - period_start <= 31),
  constraint report_period_approved check ((status = '승인') = (approved_at is not null)),
  constraint report_period_uniq unique (owner_id, report_type, period_start)
);

-- 근거 메일 메타 — 본문 칸이 없다(위 설계). 첨부는 파일 이름만.
create table if not exists public.report_mail (
  id              bigint generated always as identity primary key,
  owner_id        uuid not null default auth.uid(),
  mail_id         text not null check (mail_id ~ '^E[0-9]{3,}$'),       -- 'E001'
  message_id      text not null default '',                              -- Message-ID 머리글(중복 판정)
  in_reply_to     text not null default '',
  from_name       text not null default '',
  from_email      text not null default '',
  to_list         text[] not null default '{}',
  sent_at         timestamptz,
  sent_day        date,                                                  -- 보낸 쪽 시간대의 날짜(기간 판정)
  subject         text not null default '',
  subject_norm    text not null default '',                              -- RE:/FW: 를 뗀 제목(업무 묶음)
  attachments     text[] not null default '{}',                          -- 첨부 파일 이름만
  project         text not null default '',
  task_key        text not null default '',
  file_name       text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint report_mail_uniq unique (owner_id, mail_id)
);
-- 같은 메일을 두 번 넣지 않는다(Message-ID 가 있을 때)
create unique index if not exists report_mail_msgid_uniq on public.report_mail (owner_id, message_id) where message_id <> '';
create index if not exists report_mail_day_idx on public.report_mail (owner_id, sent_day);

-- 실적·계획·이슈 항목 — 규칙·AI 항목은 근거 메일이 있거나 「확인 필요」여야 한다(설계 원칙 7.2)
create table if not exists public.report_item (
  id              bigint generated always as identity primary key,
  owner_id        uuid not null default auth.uid(),
  period_ref      bigint not null references public.report_period(id) on delete cascade,
  item_id         text not null check (item_id ~ '^[RAM][0-9]{3,}$'),  -- R 규칙 · A AI · M 직접 입력
  origin          text not null check (origin in ('rule', 'ai', 'manual')),
  category        text not null check (category in ('실적', '계획', '이슈')),
  status          text not null default '확인 필요' check (status in ('예정', '진행 중', '완료', '지연', '보류', '확인 필요')),
  project         text not null default '',
  task_name       text not null default '',
  body            text not null check (length(trim(body)) > 0),        -- 보고서에 쓰는 한 문장(메일 원문 아님)
  item_date       date,
  evidence        text[] not null default '{}',                        -- 근거 mail_id 목록
  explicit        boolean not null default true,                       -- false = AI 가 문맥으로 추론
  decision        boolean not null default false,
  conflict        text not null default '',
  reviewed        boolean not null default false,
  excluded        boolean not null default false,
  note            text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint report_item_evidence check (origin = 'manual' or cardinality(evidence) >= 1 or status = '확인 필요'),
  constraint report_item_uniq unique (period_ref, item_id)
);
create index if not exists report_item_period_idx on public.report_item (period_ref);

-- 이전 보고서 계획 대비 — 도구의 제안(suggestion)과 사람이 고른 확정(final)을 나눠 둔다
create table if not exists public.report_carryover (
  id              bigint generated always as identity primary key,
  owner_id        uuid not null default auth.uid(),
  period_ref      bigint not null references public.report_period(id) on delete cascade,
  plan_project    text not null default '',
  plan_text       text not null check (length(trim(plan_text)) > 0),
  suggestion      text not null check (suggestion in ('완료', '진행', '지연', '이월')),
  final           text not null default '' check (final in ('', '완료', '진행', '지연', '이월')),
  matched_item    text not null default '',
  similarity      numeric not null default 0 check (similarity between 0 and 1),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint report_carryover_uniq unique (period_ref, plan_project, plan_text)
);

-- 승인한 보고서 기록 — 쌓기만 한다. 같은 기간을 다시 승인하면 새 행이 쌓이고 최신 행을 쓴다
create table if not exists public.report_history (
  id              bigint generated always as identity primary key,
  owner_id        uuid not null default auth.uid(),
  report_type     text not null check (report_type in ('weekly', 'monthly')),
  period_start    date not null,
  period_end      date not null,
  approved_at     timestamptz not null default now(),
  counts          jsonb not null default '{}'::jsonb,                  -- {performance, plan, issue, check, mails}
  plans           jsonb not null default '[]'::jsonb                   -- [{project, text}] — 다음 보고의 이전 계획
                  check (jsonb_typeof(plans) = 'array'),
  created_at      timestamptz not null default now(),
  constraint report_history_range check (period_end >= period_start)
);
create index if not exists report_history_owner_idx on public.report_history (owner_id, period_end desc);

-- ----------------------------------------------------------------------------
-- 2. 함수 · 트리거
--
--  search_path 를 고정한다. 고정하지 않으면 호출자의 search_path 에 따라
--  엉뚱한 스키마의 객체를 잡을 수 있다.
-- ----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $fn$
begin
  new.updated_at := now();
  return new;
end;
$fn$;

do $trg$
declare t text;
begin
  foreach t in array array['workspace', 'benchmark_scope', 'benchmark_model', 'model_media', 'design_feedback',
                           'report_period', 'report_mail', 'report_item', 'report_carryover']
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_updated_at', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
                   t || '_updated_at', t);
  end loop;
end;
$trg$;

-- ----------------------------------------------------------------------------
-- 3. RLS — 본인 행만
-- ----------------------------------------------------------------------------

alter table public.workspace       enable row level security;
alter table public.benchmark_scope enable row level security;
alter table public.benchmark_model enable row level security;
alter table public.model_media     enable row level security;
alter table public.design_feedback enable row level security;
alter table public.ops_history     enable row level security;
alter table public.report_period   enable row level security;
alter table public.report_mail     enable row level security;
alter table public.report_item     enable row level security;
alter table public.report_carryover enable row level security;
alter table public.report_history  enable row level security;
alter table public.weight_version  enable row level security;

do $rls$
declare t text;
begin
  foreach t in array array['workspace', 'benchmark_scope', 'benchmark_model', 'report_period', 'report_mail']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format('create policy %I on public.%I for select to authenticated using (owner_id = auth.uid())',
                   t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (owner_id = auth.uid())',
                   t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid())',
                   t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (owner_id = auth.uid())',
                   t || '_delete', t);
  end loop;
end;
$rls$;

-- 이미지는 본인 행이면서, 붙는 모델도 본인 것이어야 한다.
-- (그렇지 않으면 남의 model 행 id 를 알아내 이미지를 끼워 넣을 수 있다)
drop policy if exists model_media_select on public.model_media;
drop policy if exists model_media_insert on public.model_media;
drop policy if exists model_media_update on public.model_media;
drop policy if exists model_media_delete on public.model_media;
create policy model_media_select on public.model_media for select to authenticated
  using (owner_id = auth.uid());
create policy model_media_insert on public.model_media for insert to authenticated
  with check (owner_id = auth.uid() and exists (
    select 1 from public.benchmark_model m where m.id = model_ref and m.owner_id = auth.uid()));
create policy model_media_update on public.model_media for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and exists (
    select 1 from public.benchmark_model m where m.id = model_ref and m.owner_id = auth.uid()));
create policy model_media_delete on public.model_media for delete to authenticated
  using (owner_id = auth.uid());

-- 과제 B: 항목·이전 계획 판정은 본인 행이면서, 붙는 보고서(period_ref)도 본인 것이어야 한다
do $rls_b$
declare t text;
begin
  foreach t in array array['report_item', 'report_carryover']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format('create policy %I on public.%I for select to authenticated using (owner_id = auth.uid())', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (owner_id = auth.uid() and exists ('
                   'select 1 from public.report_period r where r.id = period_ref and r.owner_id = auth.uid()))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid() and exists ('
                   'select 1 from public.report_period r where r.id = period_ref and r.owner_id = auth.uid()))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (owner_id = auth.uid())', t || '_delete', t);
  end loop;
end;
$rls_b$;

-- 기록성 표 — 지우기 정책 없음. 피드백 수정은 아래 칸 단위 GRANT 로 status·resolved_at 만
drop policy if exists design_feedback_select on public.design_feedback;
drop policy if exists design_feedback_insert on public.design_feedback;
drop policy if exists design_feedback_update on public.design_feedback;
create policy design_feedback_select on public.design_feedback for select to authenticated using (owner_id = auth.uid());
create policy design_feedback_insert on public.design_feedback for insert to authenticated with check (owner_id = auth.uid());
create policy design_feedback_update on public.design_feedback for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists ops_history_select on public.ops_history;
drop policy if exists ops_history_insert on public.ops_history;
create policy ops_history_select on public.ops_history for select to authenticated using (owner_id = auth.uid());
create policy ops_history_insert on public.ops_history for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists report_history_select on public.report_history;
drop policy if exists report_history_insert on public.report_history;
create policy report_history_select on public.report_history for select to authenticated using (owner_id = auth.uid());
create policy report_history_insert on public.report_history for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists weight_version_select on public.weight_version;
drop policy if exists weight_version_insert on public.weight_version;
create policy weight_version_select on public.weight_version for select to authenticated using (owner_id = auth.uid());
create policy weight_version_insert on public.weight_version for insert to authenticated with check (owner_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 4. 표 권한 — Supabase 는 새 표마다 anon 에도 전 권한을 자동으로 붙인다.
--    정책이 anon 을 막지만, 권한 자체도 끊어 두 겹으로 막는다.
-- ----------------------------------------------------------------------------

revoke all on public.workspace, public.benchmark_scope, public.benchmark_model, public.model_media,
              public.report_period, public.report_mail, public.report_item, public.report_carryover
  from anon;
grant select, insert, update, delete
  on public.workspace, public.benchmark_scope, public.benchmark_model, public.model_media,
     public.report_period, public.report_mail, public.report_item, public.report_carryover
  to authenticated;

-- 기록성 표: 표 전체 권한을 먼저 끊고(재실행 때 예전 권한이 남지 않게) 필요한 것만 준다
revoke all on public.design_feedback, public.ops_history, public.report_history, public.weight_version from anon, authenticated;
grant select, insert on public.design_feedback, public.ops_history, public.report_history, public.weight_version to authenticated;
grant update (status, resolved_at) on public.design_feedback to authenticated;

-- ----------------------------------------------------------------------------
-- 5. 함수 실행 권한
--
--  GRANT 만으로는 제한되지 않는다. 권한이 두 겹으로 미리 붙는다.
--    ① PostgreSQL 이 함수 생성 시 PUBLIC 에 EXECUTE 기본 부여
--    ② Supabase 가 ALTER DEFAULT PRIVILEGES 로 신규 함수마다
--       anon·authenticated·service_role 에 자동 부여
--  PUBLIC 만 지우면 anon=X 가 남아 비로그인 호출이 그대로 뚫린다.
--  (RLS 정책 식은 auth.uid() 만 쓰므로 anon 에 남겨 둘 함수가 없다.)
-- ----------------------------------------------------------------------------

revoke all on function public.set_updated_at() from public, anon;
-- 트리거 전용 함수는 authenticated 를 남긴다. 직접 호출하면
-- "can only be called as trigger" 로 죽으므로 무해하다.
grant execute on function public.set_updated_at() to authenticated;

-- ============================================================================
-- 끝.
-- ============================================================================
