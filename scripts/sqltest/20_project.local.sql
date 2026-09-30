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
  foreach t in array array['workspace','benchmark_scope','benchmark_model','model_media','design_feedback','ops_history','weight_version',
                           'report_period','report_mail','report_item','report_carryover','report_history']
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
    41::bigint, '정책 수가 41개다 (과제 A: 4개 표 × 4 + 피드백 3 + 운영 이력 2 + 비중 버전 2 = 23, 과제 B: 4개 표 × 4 + 보고 이력 2 = 18, 재실행해도 늘지 않는다)');
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
    '23514', 'Scope 경쟁사는 부록 B 13개사 + Mecalac 안에서만 고른다');
  insert into public.benchmark_scope (scope_id, equipment_type, tonnage_class, brands, purposes)
    values ('EXC-MED-001-V', 'Excavator', 'MED', '{Mecalac}', '{Serviceability}');
  perform public._assert(true, 'Mecalac 은 Scope 경쟁사로 고를 수 있다 (2026-09-29 추가)');
  perform public._assert_raises($s$insert into public.benchmark_model (model_id, equipment_type, brand, model_name, score_cmf)
     values ('M0008', 'Excavator', 'JCB', 's', 6)$s$,
    '23514', '평가 점수는 0~5 이다 (6 은 막힌다)');
  perform public._assert_raises($s$insert into public.benchmark_model (model_id, equipment_type, brand, model_name, score_cmf)
     values ('M0009', 'Excavator', 'JCB', 's9', -1)$s$,
    '23514', '평가 점수는 음수가 될 수 없다');
  insert into public.benchmark_model (model_id, equipment_type, brand, model_name, score_exterior, score_cmf)
    values ('M0010', 'Excavator', 'JCB', '영점', 0, 1);
  perform public._assert(true, '평가 점수 0 과 예전 척도의 1 은 저장된다 (2026-09-29 오후 0~5)');
  insert into public.benchmark_scope (scope_id, equipment_type, tonnage_class, brands, purposes)
    values ('WHL-SML-001-X', 'Wheel Loader', 'SML', '{Mecalac}', '{Exterior}');
  perform public._assert(true, 'Mecalac 은 휠로더 Scope 에도 고를 수 있다 (모든 장비로 구분)');
  perform public._assert_eq((select column_default from information_schema.columns where table_name = 'workspace' and column_name = 'update_cycle'),
    '''weekly''::text', '업데이트 주기 기본값은 주간이다');
  perform public._assert_eq((select column_default from information_schema.columns where table_name = 'workspace' and column_name = 'stale_days'),
    '7305', '오래된 자료 기준 기본값은 수집일 기준 20년(7305일)이다 (2026-09-29 오후 늦게)');
  -- 평가 8기준(1~5) — 디자이너 점수 · AI 점수 · 근거
  insert into public.benchmark_model (model_id, equipment_type, brand, model_name, score_proportion, ai_proportion, note_proportion, score_identity)
    values ('M0011', 'Excavator', 'JCB', '8기준', 5, 4, '비례 안정(가상)', 1);
  perform public._assert(true, '8기준 점수 1~5 · AI 점수 · 근거가 저장된다');
  perform public._assert_eq((select count(*)::text from information_schema.columns where table_name = 'benchmark_model' and column_name ~ '^(score|ai|note)_(proportion|form|ext_cmf|int_arch|int_cmf|ergonomics|hmi|identity)$'),
    '24', '8기준 × (디자이너·AI·근거) = 24칸');
  perform public._assert_raises($s$insert into public.benchmark_model (model_id, equipment_type, brand, model_name, score_hmi)
     values ('M0012', 'Excavator', 'JCB', 'h0', 0)$s$,
    '23514', '8기준 점수는 1~5 다 (평가 기준 자료의 5점 Scale — 0 은 막힌다)');
  perform public._assert_raises($s$insert into public.benchmark_model (model_id, equipment_type, brand, model_name, ai_form)
     values ('M0013', 'Excavator', 'JCB', 'a6', 6)$s$,
    '23514', 'AI 점수도 1~5 다');
  perform public._assert_eq((select score_exterior::text from public.benchmark_model where model_id = 'M0010'), '0', '예전 4축 점수 칸은 남아 있다(legacy)');
  update public.workspace set stale_days = 10958;
  perform public._assert_raises($s$update public.workspace set stale_days = 10959$s$, '23514', '오래된 자료 기준은 30년(10958일)까지다');
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
-- 5-b. 기록성 표 (2026-09-29) — 피드백은 상태만 바꾸고, 내용 수정·삭제는 막힌다
-- ----------------------------------------------------------------------------
begin;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
set local role authenticated;
do $t$
declare n bigint;
begin
  insert into public.design_feedback (feedback_id, target, type, rating, comment, author)
    values ('FB0001', 'scores', '분석 결과 수정 필요', 3, 'CMF 기준 재검토', '디자이너A');
  insert into public.design_feedback (feedback_id, target, type, rating, author)
    values ('FB0002', 'model:M0001', '동의(수정 없음)', 5, '디자이너B');
  insert into public.ops_history (done_on, cycle, steps_done, note, models)
    values ('2026-09-29', 'monthly', '{collect,qa}', '1차 수집', 15);
  update public.design_feedback set status = '반영됨', resolved_at = now() where feedback_id = 'FB0001';
  get diagnostics n = row_count;
  perform public._assert_eq(n, 1::bigint, '피드백 상태(status·resolved_at)는 바꿀 수 있다');
  perform public._assert_raises($s$update public.design_feedback set comment = '고쳐 씀' where feedback_id = 'FB0001'$s$,
    '42501', '피드백 코멘트는 고칠 수 없다 (칸 단위 GRANT)');
  perform public._assert_raises($s$update public.design_feedback set rating = 5$s$,
    '42501', '피드백 평가 점수는 고칠 수 없다');
  perform public._assert_raises($s$delete from public.design_feedback$s$,
    '42501', '피드백 기록은 지울 수 없다');
  perform public._assert_raises($s$update public.ops_history set note = 'x'$s$,
    '42501', '운영 이력은 고칠 수 없다');
  perform public._assert_raises($s$delete from public.ops_history$s$,
    '42501', '운영 이력은 지울 수 없다');
  -- 2026-09-30 비중 프로필 버전 — 쌓기만, 합 100, 0~100
  insert into public.weight_version (profile_id, profile_name, version, weights, author, memo)
    values ('cabin', 'Cabin·HMI 보고', 2, '{"proportion":5,"form":5,"ext_cmf":5,"int_arch":20,"int_cmf":10,"ergonomics":25,"hmi":20,"identity":10}', '디자이너A', 'C6 상향');
  perform public._assert(true, '비중 버전을 쌓을 수 있다');
  perform public._assert_raises($s$insert into public.weight_version (profile_id, profile_name, version, weights)
     values ('cabin', 'x', 3, '{"proportion":5,"form":5,"ext_cmf":5,"int_arch":20,"int_cmf":10,"ergonomics":25,"hmi":20,"identity":11}')$s$,
    '23514', '비중 합이 100 이 아니면 거절');
  perform public._assert_raises($s$insert into public.weight_version (profile_id, profile_name, version, weights)
     values ('cabin', 'x', 3, '{"proportion":-5,"form":15,"ext_cmf":5,"int_arch":20,"int_cmf":10,"ergonomics":25,"hmi":20,"identity":10}')$s$,
    '23514', '비중은 0~100');
  perform public._assert_raises($s$insert into public.weight_version (profile_id, profile_name, version, weights)
     values ('cabin', 'x', 3, '{"proportion":100}')$s$,
    '23514', '비중 8칸이 모두 있어야 한다');
  perform public._assert_raises($s$insert into public.weight_version (profile_id, profile_name, version, weights)
     values ('cabin', 'x', 2, '{"proportion":5,"form":5,"ext_cmf":5,"int_arch":20,"int_cmf":10,"ergonomics":25,"hmi":20,"identity":10}')$s$,
    '23505', '같은 프로필·버전은 한 번만');
  perform public._assert_raises($s$update public.weight_version set memo = 'x'$s$,
    '42501', '비중 버전은 고칠 수 없다');
  perform public._assert_raises($s$delete from public.weight_version$s$,
    '42501', '비중 버전은 지울 수 없다');
  perform public._assert_raises($s$insert into public.design_feedback (feedback_id, target, type, rating, author)
     values ('FB0003', 'scores', 'Taxonomy·기준 조정', 2, '디자이너A')$s$,
    '23514', '「동의」가 아닌 피드백은 코멘트가 필요하다');
  insert into public.design_feedback (feedback_id, target, type, rating, comment, author)
    values ('FB0006', 'evaluation', '분석 결과 수정 필요', 3, '0점 기준 확인', '디자이너A');
  perform public._assert(true, '리포트 「디자인 평가」 항목(evaluation)에 피드백을 남길 수 있다');
  perform public._assert_raises($s$insert into public.design_feedback (feedback_id, target, type, rating, comment, author)
     values ('FB0004', 'unknown', '예외 사례 등록', 2, 'x', '디자이너A')$s$,
    '23514', '피드백 대상은 리포트 항목 9개 또는 model:M0000 형식이다');
  perform public._assert_raises($s$insert into public.design_feedback (feedback_id, target, type, rating, comment, author)
     values ('FB0005', 'scores', '예외 사례 등록', 7, 'x', '디자이너A')$s$,
    '23514', '피드백 평가는 1~5 이다');
  perform public._assert_raises($s$update public.workspace set update_cycle = 'daily'$s$,
    '23514', '업데이트 주기는 주간·격주·월간·분기만 받는다');
end $t$;
commit;

-- B 는 A 의 피드백·운영 이력을 보지 못한다
begin;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
set local role authenticated;
do $t$
declare n bigint;
begin
  perform public._assert_eq((select count(*) from public.design_feedback) + (select count(*) from public.ops_history), 0::bigint,
    'B 에게는 A 의 피드백·운영 이력이 보이지 않는다');
  update public.design_feedback set status = '열림';
  get diagnostics n = row_count;
  perform public._assert_eq(n, 0::bigint, 'B 는 A 의 피드백 상태를 바꿀 수 없다');
end $t$;
commit;

-- ----------------------------------------------------------------------------
-- 5-c. 과제 B — 업무보고 Agent (2026-09-29)
-- ----------------------------------------------------------------------------
begin;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
set local role authenticated;
do $t$
declare v_period bigint; n bigint;
begin
  insert into public.report_period (report_type, period_start, period_end, title)
    values ('weekly', '2026-09-21', '2026-09-27', '디자인팀(가상)') returning id into v_period;
  insert into public.report_mail (mail_id, message_id, from_name, sent_day, subject, subject_norm, attachments)
    values ('E002', 'cab-001@example.com', '디자인팀장(가상)', '2026-09-21', '[캡] 시안 검토', '[캡] 시안 검토', '{CMF_샘플목록.xlsx}');
  insert into public.report_item (period_ref, item_id, origin, category, status, body, evidence)
    values (v_period, 'R001', 'rule', '실적', '완료', 'B안을 최종 시안으로 선정', '{E002}');
  insert into public.report_item (period_ref, item_id, origin, category, status, body)
    values (v_period, 'A001', 'ai', '이슈', '확인 필요', '근거 없는 AI 항목은 확인 필요로만 둔다');
  insert into public.report_item (period_ref, item_id, origin, category, status, body)
    values (v_period, 'M001', 'manual', '계획', '예정', '직접 입력은 근거 없이도 된다');
  insert into public.report_carryover (period_ref, plan_project, plan_text, suggestion, final, matched_item, similarity)
    values (v_period, '캡', '최종 시안 선정', '완료', '완료', 'R001', 0.93);
  insert into public.report_history (report_type, period_start, period_end, counts, plans)
    values ('weekly', '2026-09-21', '2026-09-27', '{"plan":1}', '[{"project":"캡","text":"모델링 업데이트"}]');
  perform public._assert_eq((select count(*) from public.report_item), 3::bigint, 'A 는 보고서 항목 3건(규칙·AI·직접)을 저장한다');

  perform public._assert((select count(*) = 0 from information_schema.columns
      where table_schema = 'public' and table_name = 'report_mail' and column_name in ('body', 'text', 'main', 'html')),
    'report_mail 에는 메일 본문 칸이 없다 (메타만 저장하는 설계)');
  perform public._assert_raises($s$insert into public.report_item (period_ref, item_id, origin, category, status, body)
     select id, 'R002', 'rule', '실적', '완료', '근거 없는 완료' from public.report_period$s$,
    '23514', '규칙·AI 항목이 근거 메일 없이 「완료」로 확정될 수 없다 (확인 필요만 허용)');
  perform public._assert_raises($s$insert into public.report_item (period_ref, item_id, origin, category, body, evidence)
     select id, 'R003', 'rule', '잡담', 'x', '{E002}' from public.report_period$s$,
    '23514', '분류는 실적·계획·이슈만 받는다');
  perform public._assert_raises($s$insert into public.report_item (period_ref, item_id, origin, category, status, body, evidence)
     select id, 'R004', 'rule', '실적', '끝남', 'x', '{E002}' from public.report_period$s$,
    '23514', '상태는 기획서 3.2 의 6종만 받는다');
  perform public._assert_raises($s$insert into public.report_item (period_ref, item_id, origin, category, body, evidence)
     select id, 'R001', 'rule', '실적', 'dup', '{E002}' from public.report_period$s$,
    '23505', '한 보고서 안에서 item_id 중복은 UNIQUE 가 막는다');
  perform public._assert_raises($s$insert into public.report_mail (mail_id, message_id) values ('E003', 'cab-001@example.com')$s$,
    '23505', '같은 Message-ID 메일은 두 번 넣을 수 없다');
  insert into public.report_mail (mail_id) values ('E004');
  insert into public.report_mail (mail_id) values ('E005');
  perform public._assert(true, 'Message-ID 가 없는 메일(붙여넣기)은 여러 통 넣을 수 있다');
  perform public._assert_raises($s$insert into public.report_period (report_type, period_start, period_end) values ('weekly', '2026-09-28', '2026-09-20')$s$,
    '23514', '보고 기간 끝이 시작보다 앞설 수 없다');
  perform public._assert_raises($s$update public.report_period set status = '승인'$s$,
    '23514', '승인 상태에는 승인 시각이 있어야 한다');
  update public.report_period set status = '승인', approved_at = now();
  get diagnostics n = row_count;
  perform public._assert_eq(n, 1::bigint, '승인 시각과 함께면 승인할 수 있다');
  perform public._assert_raises($s$insert into public.report_carryover (period_ref, plan_text, suggestion) select id, 'x', '취소' from public.report_period$s$,
    '23514', '이전 계획 판정은 완료·진행·지연·이월만 받는다');
  perform public._assert_raises($s$update public.report_history set plans = '[]'$s$, '42501', '보고 이력은 고칠 수 없다');
  perform public._assert_raises($s$delete from public.report_history$s$, '42501', '보고 이력은 지울 수 없다');
end $t$;
commit;

select set_config('test.a_period', id::text, false) as a_period from public.report_period \gset

begin;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
set local role authenticated;
do $t$
declare n bigint;
begin
  perform public._assert_eq((select count(*) from public.report_period) + (select count(*) from public.report_mail)
    + (select count(*) from public.report_item) + (select count(*) from public.report_carryover) + (select count(*) from public.report_history),
    0::bigint, 'B 에게는 A 의 보고서·메일 메타·항목·판정·이력이 보이지 않는다');
  perform public._assert_raises(format($s$insert into public.report_item (period_ref, item_id, origin, category, status, body, evidence)
     values (%s, 'R009', 'rule', '실적', '완료', '끼워넣기', '{E002}')$s$, current_setting('test.a_period')),
    '42501', 'B 는 A 의 보고서에 항목을 끼워 넣을 수 없다');
  perform public._assert_raises(format($s$insert into public.report_carryover (period_ref, plan_text, suggestion) values (%s, 'x', '이월')$s$, current_setting('test.a_period')),
    '42501', 'B 는 A 의 보고서에 이전 계획 판정을 끼워 넣을 수 없다');
  delete from public.report_item;
  get diagnostics n = row_count;
  perform public._assert_eq(n, 0::bigint, 'B 의 DELETE 는 A 의 항목에 닿지 않는다');
end $t$;
commit;

-- A 의 보고서를 지우면 항목·판정도 함께 지워진다(이력은 남는다)
begin;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
set local role authenticated;
do $t$
begin
  delete from public.report_period;
  perform public._assert_eq((select count(*) from public.report_item) + (select count(*) from public.report_carryover), 0::bigint,
    '보고서를 지우면 항목·이전 계획 판정도 함께 지워진다 (on delete cascade)');
  perform public._assert_eq((select count(*) from public.report_history), 1::bigint, '승인 이력은 보고서를 지워도 남는다');
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
delete from public.report_history;
delete from public.report_mail;
delete from public.report_period;
delete from public.design_feedback;
delete from public.ops_history;
delete from public.model_media;
delete from public.benchmark_model;
delete from public.benchmark_scope;
delete from public.workspace;
delete from auth.users where email in ('a@example.com', 'b@example.com');

do $t$ begin raise notice ''; raise notice '전부 통과했습니다.'; end $t$;
