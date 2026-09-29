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
--
--  권한 원칙 : 모든 행은 만든 사람(owner_id = auth.uid())만 보고 고칩니다.
--              이 도구에는 기록성(이력·로그) 데이터가 없습니다.
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
  -- 부록 B 경쟁사 Universe 13개사
  constraint benchmark_scope_brands check (brands <@ array[
    'Caterpillar (CAT)', 'Komatsu', 'XCMG', 'John Deere', 'Liebherr', 'Sany', 'Volvo CE',
    'Hitachi Construction Machinery', 'JCB', 'Bobcat', 'Kubota', 'Yanmar', 'Kobelco']::text[]),
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
               check (view_type in ('Side', 'Front-Quarter', 'Rear', 'Cabin', 'CMF Detail', '기타')),
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
  foreach t in array array['workspace', 'benchmark_scope', 'benchmark_model', 'model_media']
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

do $rls$
declare t text;
begin
  foreach t in array array['workspace', 'benchmark_scope', 'benchmark_model']
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

-- ----------------------------------------------------------------------------
-- 4. 표 권한 — Supabase 는 새 표마다 anon 에도 전 권한을 자동으로 붙인다.
--    정책이 anon 을 막지만, 권한 자체도 끊어 두 겹으로 막는다.
-- ----------------------------------------------------------------------------

revoke all on public.workspace, public.benchmark_scope, public.benchmark_model, public.model_media
  from anon;
grant select, insert, update, delete
  on public.workspace, public.benchmark_scope, public.benchmark_model, public.model_media
  to authenticated;

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
