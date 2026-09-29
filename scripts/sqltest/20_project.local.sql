-- ============================================================================
-- 로컬 검증 전용 — data09-10 프로젝트별 검증 (운영 실행 금지, 가드 내장)
--
--  사용자 A·B 두 명과 비로그인(anon)을 번갈아 흉내 내어
--  ① 본인 행만 보이는가 ② 남의 모델에 이미지를 끼워 넣을 수 없는가
--  ③ anon 은 아무것도 못 하는가 ④ CHECK·UNIQUE 가 걸리는가
--  ⑤ 함수 권한에 PUBLIC·anon 이 남지 않았는가 를 잰다.
-- ============================================================================

do $guard$
begin
  if exists (select 1 from pg_roles where rolname in ('supabase_admin', 'authenticator'))
     or exists (select 1 from pg_namespace where nspname = 'graphql') then
    raise exception '이 파일은 로컬 검증 전용입니다. 운영 데이터베이스에서 실행할 수 없습니다.';
  end if;
end;
$guard$;

-- 지정한 SQLSTATE 로 실패해야 통과. 현재 역할(invoker)로 실행된다.
create or replace function public._assert_raises(p_sql text, p_state text, p_label text)
returns void language plpgsql set search_path = public as $fn$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlstate = p_state then raise notice '  OK   %', p_label; return; end if;
    raise exception 'FAIL  %  (기대 SQLSTATE %, 실제 % — %)', p_label, p_state, sqlstate, sqlerrm;
  end;
  raise exception 'FAIL  %  (기대 SQLSTATE % 인데 성공했다)', p_label, p_state;
end;
$fn$;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'b@example.com')
on conflict (id) do nothing;

do $t$ begin raise notice '[프로젝트] data09-10 — 소유자 격리 · 이미지 소속 · anon 차단 · 제약 · 함수 권한'; end $t$;

-- ----------------------------------------------------------------------------
-- 1. 사용자 A 가 Scope·모델·이미지를 등록한다
-- ----------------------------------------------------------------------------
begin;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
set local role authenticated;
do $t$
declare v_model bigint;
begin
  insert into public.workspace (active_scope, compare) values ('EXC-MED-002-XT', '{M0001}');
  insert into public.benchmark_scope (scope_id, equipment_type, tonnage_class, brands, purposes)
  values ('EXC-MED-002-XT', 'Excavator', 'MED', '{Komatsu,"Volvo CE"}', '{Exterior,Trend}');
  insert into public.benchmark_model (model_id, equipment_type, brand, model_name, tonnage_class,
                                      operating_weight, collected_at, source_url, design_tags, confidence)
  values ('M0001', 'Excavator', 'Komatsu', '예시-K220', 'MED', 22000, '2026-09-01', 'https://example.com',
          '{라운드,수평라인}', 0.8)
  returning id into v_model;
  insert into public.model_media (model_ref, media_id, view_type, path)
  values (v_model, 'img1', 'Side', 'images/k220_side.jpg');

  perform public._assert_eq((select owner_id from public.benchmark_model where model_id = 'M0001'),
    '11111111-1111-1111-1111-111111111111'::uuid, 'owner_id 기본값이 auth.uid() 로 채워진다');
  perform public._assert_eq((select count(*) from public.model_media), 1::bigint, 'A 는 자기 모델 이미지를 본다');
end $t$;
commit;

-- updated_at 트리거
begin;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
set local role authenticated;
do $t$
begin
  update public.benchmark_model set human_review_status = '확정' where model_id = 'M0001';
  perform public._assert((select updated_at > created_at from public.benchmark_model where model_id = 'M0001'),
    'updated_at 트리거가 수정 시각을 갱신한다');
end $t$;
commit;

-- A 모델의 내부 id 를 기억해 둔다 — B 가 이것을 알아냈다고 가정하고 끼워 넣기를 시도한다
select set_config('test.a_model', id::text, false) as a_model
  from public.benchmark_model where model_id = 'M0001' \gset

-- ----------------------------------------------------------------------------
-- 2. 사용자 B — A 의 행을 보지도, 고치지도, 지우지도, 대신 쓰지도 못한다
-- ----------------------------------------------------------------------------
begin;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
set local role authenticated;
do $t$
declare n bigint; v_a_model bigint;
begin
  perform public._assert_eq(
    (select count(*) from public.workspace) + (select count(*) from public.benchmark_scope)
    + (select count(*) from public.benchmark_model) + (select count(*) from public.model_media),
    0::bigint, 'B 에게는 A 의 행이 4개 표 어디에서도 보이지 않는다');

  update public.benchmark_model set brand = 'B가 고침' where model_id = 'M0001';
  get diagnostics n = row_count;
  perform public._assert_eq(n, 0::bigint, 'B 의 UPDATE 는 A 의 모델에 닿지 않는다');

  delete from public.benchmark_scope;
  get diagnostics n = row_count;
  perform public._assert_eq(n, 0::bigint, 'B 의 DELETE 는 A 의 Scope 에 닿지 않는다');

  perform public._assert_raises(
    $s$insert into public.benchmark_model (owner_id, model_id, equipment_type, brand, model_name)
       values ('11111111-1111-1111-1111-111111111111', 'M0099', 'Excavator', 'JCB', '끼워넣기')$s$,
    '42501', 'B 는 owner_id 를 A 로 적어 대신 쓸 수 없다');

  v_a_model := current_setting('test.a_model')::bigint;
  perform public._assert_raises(
    format($s$insert into public.model_media (model_ref, media_id, path) values (%s, 'imgX', 'x.jpg')$s$, v_a_model),
    '42501', 'B 는 자기 owner_id 로라도 A 의 모델에 이미지를 붙일 수 없다');

  -- UNIQUE 는 사용자별이다 — B 도 같은 model_id·브랜드·모델명을 쓸 수 있다
  insert into public.benchmark_model (model_id, equipment_type, brand, model_name)
  values ('M0001', 'Excavator', 'Komatsu', '예시-K220');
  perform public._assert_eq((select count(*) from public.benchmark_model), 1::bigint,
    '같은 model_id 라도 사용자가 다르면 따로 저장된다');

  -- 자기 행을 A 에게 넘기는 UPDATE 는 WITH CHECK 가 막는다. WHERE 없이 쓴다 — WHERE 가 있으면
  -- SELECT 정책이 새 행에도 걸려 WITH CHECK 가 빠져도 막히므로 검사가 헛돈다.
  -- 다른 제약에 먼저 걸리지 않도록 A 와 겹치지 않는 행으로 잰다.
  insert into public.benchmark_scope (scope_id, equipment_type, tonnage_class, brands, purposes) values ('WHL-SML-001-X', 'Wheel Loader', 'SML', '{JCB}', '{Exterior}');
  perform public._assert_raises(
    $s$update public.benchmark_scope set owner_id = '11111111-1111-1111-1111-111111111111'$s$,
    '42501', 'B 는 자기 행의 owner_id 를 A 로 넘길 수 없다 (with check)');
end $t$;
commit;

do $t$
begin
  perform public._assert_eq((select brand from public.benchmark_model
      where owner_id = '11111111-1111-1111-1111-111111111111' and model_id = 'M0001'),
    'Komatsu', 'B 의 시도 뒤에도 A 의 모델은 그대로다');
  perform public._assert_eq((select count(*) from public.benchmark_scope
      where owner_id = '11111111-1111-1111-1111-111111111111'), 1::bigint,
    'B 의 시도 뒤에도 A 의 Scope 는 그대로다');
  perform public._assert_eq((select count(*) from public.model_media where media_id = 'imgX'), 0::bigint,
    'A 의 모델에 B 의 이미지가 붙지 않았다');
end $t$;

-- ----------------------------------------------------------------------------
-- 3. 비로그인(anon) — 읽기도 쓰기도 막힌다
-- ----------------------------------------------------------------------------
begin;
set local request.jwt.claim.sub = '';
set local role anon;
do $t$
declare t text;
begin
  foreach t in array array['workspace','benchmark_scope','benchmark_model','model_media']
  loop
    perform public._assert_raises(format('select * from public.%I', t), '42501', 'anon 은 ' || t || ' 를 읽을 수 없다');
  end loop;
  perform public._assert_raises(
    $s$insert into public.benchmark_model (model_id, equipment_type, brand, model_name) values ('M0500', 'Excavator', 'JCB', 'x')$s$,
    '42501', 'anon 은 모델을 등록할 수 없다');
end $t$;
commit;

-- ----------------------------------------------------------------------------
-- 4. 정책 구조
-- ----------------------------------------------------------------------------
do $t$
declare v_bad text;
begin
  select string_agg(p.polname, ', ') into v_bad
    from pg_policy p join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and coalesce(pg_get_expr(p.polqual, p.polrelid), '') || coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '')
         not like '%owner_id = auth.uid()%';
  perform public._assert(v_bad is null,
    '모든 정책이 owner_id = auth.uid() 로 묶여 있다' || coalesce(' (발견: ' || v_bad || ')', ''));

  perform public._assert_eq((select count(*) from pg_policy p join pg_class c on c.oid = p.polrelid
     join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public'),
    16::bigint, '정책 수가 16개다 (4개 표 × 4, 재실행해도 늘지 않는다)');
end $t$;

-- ----------------------------------------------------------------------------
-- 5. CHECK · UNIQUE
-- ----------------------------------------------------------------------------
begin;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
set local role authenticated;
do $t$
begin
  perform public._assert_raises($s$insert into public.benchmark_scope (scope_id, equipment_type, tonnage_class, brands, purposes)
     values ('WHL-MIC-001-X', 'Wheel Loader', 'MIC', '{JCB}', '{Exterior}')$s$,
    '23514', 'Wheel Loader 에 굴착기 전용 톤급(MIC)은 고를 수 없다');
  perform public._assert_raises($s$insert into public.benchmark_scope (scope_id, equipment_type, tonnage_class, brands, purposes)
     values ('EXC-MED-001-X', 'Excavator', 'MED', '{"없는 회사"}', '{Exterior}')$s$,
    '23514', 'Scope 경쟁사는 부록 B 13개사 안에서만 고른다');
  perform public._assert_raises($s$insert into public.benchmark_scope (scope_id, equipment_type, tonnage_class, brands, purposes)
     values ('EXC-MED-000-X', 'Excavator', 'MED', '{}', '{Exterior}')$s$,
    '23514', 'Scope 경쟁사는 1개 이상이어야 한다');
  perform public._assert_raises($s$insert into public.benchmark_scope (scope_id, equipment_type, tonnage_class, brands, purposes)
     values ('EXC-MED-001-Z', 'Excavator', 'MED', '{JCB}', '{Marketing}')$s$,
    '23514', 'Benchmark Purpose 는 7종 안에서만 고른다');
  perform public._assert_raises($s$insert into public.benchmark_scope (scope_id, equipment_type, tonnage_class, brands, purposes)
     values ('EXC-MED-002-XT', 'Excavator', 'MED', '{Komatsu,"Volvo CE"}', '{Exterior,Trend}')$s$,
    '23505', '같은 사용자의 scope_id 중복은 UNIQUE 가 막는다');
  perform public._assert_raises($s$insert into public.benchmark_model (model_id, equipment_type, brand, model_name)
     values ('M0002', 'Excavator', 'Komatsu', '예시-K220')$s$,
    '23505', '같은 브랜드·모델명 중복 등록은 UNIQUE 가 막는다');
  perform public._assert_raises($s$insert into public.benchmark_model (model_id, equipment_type, brand, model_name)
     values ('M0001', 'Excavator', 'JCB', '다른모델')$s$,
    '23505', '같은 사용자의 model_id 중복은 UNIQUE 가 막는다');
  perform public._assert_raises($s$insert into public.benchmark_model (model_id, equipment_type, brand, model_name)
     values ('M0003', 'Bulldozer', 'JCB', 'x')$s$,
    '23514', '장비군은 Excavator / Wheel Loader 만 받는다');
  perform public._assert_raises($s$insert into public.benchmark_model (model_id, equipment_type, brand, model_name)
     values ('M0004', 'Excavator', '  ', 'x')$s$,
    '23514', '브랜드는 비워 둘 수 없다');
  perform public._assert_raises($s$insert into public.benchmark_model (model_id, equipment_type, brand, model_name, confidence)
     values ('M0005', 'Excavator', 'JCB', 'y', 1.5)$s$,
    '23514', 'confidence 는 0~1 이다');
  perform public._assert_raises($s$insert into public.benchmark_model (model_id, equipment_type, brand, model_name, operating_weight)
     values ('M0006', 'Excavator', 'JCB', 'z', -1)$s$,
    '23514', '운전중량은 음수가 될 수 없다');
  perform public._assert_raises($s$insert into public.benchmark_model (model_id, equipment_type, brand, model_name, human_review_status)
     values ('M0007', 'Excavator', 'JCB', 'w', '승인')$s$,
    '23514', '검증 상태는 미검토/검토중/확정/반려 만 받는다');
  perform public._assert_raises($s$insert into public.benchmark_model (model_id, equipment_type, brand, model_name)
     values ('X-1', 'Excavator', 'JCB', 'v')$s$,
    '23514', 'model_id 는 M0001 형식만 받는다');
  perform public._assert_raises($s$insert into public.model_media (model_ref, media_id)
     select id, 'img9' from public.benchmark_model where model_id = 'M0001'$s$,
    '23514', '경로도 파일도 없는 이미지는 막는다');
  perform public._assert_raises($s$insert into public.model_media (model_ref, media_id, view_type, path)
     select id, 'img8', 'Top', 'a.jpg' from public.benchmark_model where model_id = 'M0001'$s$,
    '23514', 'View 는 18절 5종 + 기타 만 받는다');
  perform public._assert_raises($s$insert into public.model_media (model_ref, media_id, path)
     select id, 'img1', 'dup.jpg' from public.benchmark_model where model_id = 'M0001'$s$,
    '23505', '한 모델 안에서 media_id 중복은 UNIQUE 가 막는다');
  perform public._assert_raises($s$update public.workspace set compare = '{M0001,M0002,M0003,M0004,M0005}'$s$,
    '23514', '비교 목록은 최대 4개다');
  perform public._assert_raises($s$update public.workspace set image_max_px = 100$s$,
    '23514', '이미지 최대 크기는 200~4000px 이다');
end $t$;
commit;

-- 모델을 지우면 이미지도 함께 지워진다
begin;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
set local role authenticated;
do $t$
begin
  delete from public.benchmark_model where model_id = 'M0001';
  perform public._assert_eq((select count(*) from public.model_media), 0::bigint,
    '모델을 지우면 그 이미지도 함께 지워진다 (on delete cascade)');
end $t$;
commit;

-- ----------------------------------------------------------------------------
-- 6. 함수 권한 · search_path · 표 권한
-- ----------------------------------------------------------------------------
do $t$
declare v_bad text;
begin
  -- proacl 이 NULL 이면 "기본값 = PUBLIC 에 EXECUTE" 라는 뜻이다. NULL 도 실패로 본다.
  select string_agg(p.proname, ', ') into v_bad
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname not like '\_assert%'
     and (p.proacl is null
          or exists (select 1 from aclexplode(p.proacl) a
                      where a.privilege_type = 'EXECUTE'
                        and (a.grantee = 0 or a.grantee = 'anon'::regrole::oid)));
  perform public._assert(v_bad is null,
    'proacl 에 PUBLIC·anon EXECUTE 가 없다 (예외로 둔 함수도 없음)' || coalesce(' (발견: ' || v_bad || ')', ''));

  select string_agg(p.proname, ', ') into v_bad
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname not like '\_assert%'
     and not coalesce('search_path=public' = any(p.proconfig), false);
  perform public._assert(v_bad is null,
    '모든 함수에 search_path = public 이 고정돼 있다' || coalesce(' (발견: ' || v_bad || ')', ''));

  select string_agg(c.relname, ', ') into v_bad
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
     and (has_table_privilege('anon', c.oid, 'SELECT') or has_table_privilege('anon', c.oid, 'INSERT')
          or has_table_privilege('anon', c.oid, 'UPDATE') or has_table_privilege('anon', c.oid, 'DELETE'));
  perform public._assert(v_bad is null,
    'anon 에 표 권한이 남지 않았다 (Supabase 자동 부여를 끊었다)' || coalesce(' (발견: ' || v_bad || ')', ''));
end $t$;

-- 정리
delete from public.model_media;
delete from public.benchmark_model;
delete from public.benchmark_scope;
delete from public.workspace;
delete from auth.users where email in ('a@example.com', 'b@example.com');

do $t$ begin raise notice ''; raise notice '전부 통과했습니다.'; end $t$;
