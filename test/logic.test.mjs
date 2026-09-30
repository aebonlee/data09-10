// 실행: node test/logic.test.mjs   (의존성 없음)
// 기대값은 제출 기획서 부록 B·C, 12절, 18절과 손으로 계산한 값입니다.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const L = require('../js/logic.js');
const Sample = require('../js/sample-data.js');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { console.error('  FAIL ' + name + '\n       ' + e.message); process.exitCode = 1; }
}
const NOW = new Date(2026, 8, 28);

console.log('부록 B·C 분류');
test('경쟁사 14개사 — 제출 13개사 순서 그대로 + Mecalac(2026-09-29 요청)', () => {
  assert.equal(L.BRANDS.length, 14);
  assert.equal(L.BRANDS[0].name, 'Caterpillar (CAT)');
  assert.equal(L.BRANDS[12].name, 'Kobelco');
  assert.equal(L.BRANDS[13].name, 'Mecalac');
  assert.equal(L.normalizeBrand('MECALAC'), 'Mecalac');
  assert.equal(L.normalizeBrand('메카락'), 'Mecalac');
  assert.equal(new Set(L.BRANDS.map(b => b.id)).size, L.BRANDS.length); // id 중복 없음
});
test('Excavator 6단계 · Wheel Loader 5단계', () => {
  assert.equal(L.productByName('Excavator').classes.length, 6);
  assert.equal(L.productByName('Wheel Loader').classes.length, 5);
});
test('운전중량 → Excavator 톤급 (경계는 「미만」)', () => {
  assert.equal(L.suggestTonnage('Excavator', 800), 'MIC');     // 0.8t
  assert.equal(L.suggestTonnage('Excavator', 1000), 'MNI');    // 1t 은 Mini 시작
  assert.equal(L.suggestTonnage('Excavator', 5999), 'MNI');
  assert.equal(L.suggestTonnage('Excavator', 6000), 'MID');
  assert.equal(L.suggestTonnage('Excavator', 9999), 'MID');
  assert.equal(L.suggestTonnage('Excavator', 10000), 'MED');
  assert.equal(L.suggestTonnage('Excavator', 21500), 'MED');
  assert.equal(L.suggestTonnage('Excavator', 35000), 'LRG');
  assert.equal(L.suggestTonnage('Excavator', 90000), 'MNG');
});
test('운전중량 → Wheel Loader 톤급', () => {
  assert.equal(L.suggestTonnage('Wheel Loader', 5500), 'CMP');
  assert.equal(L.suggestTonnage('Wheel Loader', 12000), 'MED');
  assert.equal(L.suggestTonnage('Wheel Loader', 16800), 'MED');
  assert.equal(L.suggestTonnage('Wheel Loader', 50000), 'MNG');
});
test('중량 없거나 장비군 모르면 빈 값', () => {
  assert.equal(L.suggestTonnage('Excavator', ''), '');
  assert.equal(L.suggestTonnage('Crane', 20000), '');
});
test('한글·약칭 장비군과 톤급 글자 인식', () => {
  assert.equal(L.productByName('굴착기').name, 'Excavator');
  assert.equal(L.productByName('휠로더').name, 'Wheel Loader');
  assert.equal(L.tonnageFromText('Excavator', 'Medium'), 'MED');
  assert.equal(L.tonnageFromText('Excavator', 'Midi / Compact Excavator'), 'MID');
  assert.equal(L.tonnageFromText('Wheel Loader', '소형'), 'SML');
  assert.equal(L.tonnageFromText('Excavator', '모름'), '');
});
test('브랜드 별칭 정규화', () => {
  assert.equal(L.normalizeBrand('CAT'), 'Caterpillar (CAT)');
  assert.equal(L.normalizeBrand('hitachi'), 'Hitachi Construction Machinery');
  assert.equal(L.normalizeBrand('Volvo'), 'Volvo CE');
  assert.equal(L.normalizeBrand('Doosan'), 'Doosan'); // 목록 외는 그대로
  assert.equal(L.brandInUniverse('Doosan'), false);
});

console.log('단위 변환');
test('무게: t·kg·쉼표', () => {
  assert.equal(L.parseQuantity('21.5 t', 'weight', 'kg'), 21500);
  assert.equal(L.parseQuantity('21,500 kg', 'weight', 't'), 21500);
  assert.equal(L.parseQuantity('30.5', 'weight', 't'), 30500);
  assert.equal(L.parseQuantity(21500, 'weight', 'kg'), 21500);
});
test('출력: hp → kW (1 hp = 0.745699872 kW)', () => {
  assert.equal(L.parseQuantity('100 hp', 'power', 'kW'), 74.57);
  assert.equal(L.parseQuantity('118', 'power', 'kW'), 118);
});
test('숫자 아니면 null', () => assert.equal(L.parseQuantity('없음', 'weight', 'kg'), null));
test('날짜: 점 표기·엑셀 일련번호', () => {
  assert.equal(L.toDateStr('2026.9.3'), '2026-09-03');
  assert.equal(L.toDateStr(46293), '2026-09-28'); // 엑셀 1900 체계 46293 = 2026-09-28
  assert.equal(L.toDateStr('언젠가'), '');
});

console.log('Scope');
const draft = { equipment_type: 'Excavator', tonnage_class: 'MED', brands: ['Caterpillar (CAT)', 'Komatsu', 'Volvo CE', 'Hitachi Construction Machinery', 'JCB', 'Bobcat'], purposes: ['Exterior', 'Trend'] };
test('Scope ID = 장비군-톤급-브랜드 수-목적', () => assert.equal(L.baseScopeId(draft), 'EXC-MED-006-XT'));
test('목적 코드는 정해진 순서, Full 이면 F 하나', () => {
  assert.equal(L.purposeCode(['Trend', 'CMF', 'Exterior']), 'XMT');
  assert.equal(L.purposeCode(['Cabin', 'Full Benchmark']), 'F');
});
test('4개 항목 중 빠진 것 알려줌', () => {
  assert.deepEqual(L.validateScope({ equipment_type: 'Excavator', tonnage_class: 'SML', brands: [], purposes: [] }), ['tonnage_class', 'brands', 'purposes']);
});
test('같은 선택은 기존 Scope 재사용, 브랜드 구성만 다르면 -2', () => {
  const a = L.assignScope([], draft, NOW);
  assert.equal(a.scope.scope_id, 'EXC-MED-006-XT');
  assert.equal(a.scope.created_at, '2026-09-28');
  const again = L.assignScope([a.scope], { ...draft, brands: draft.brands.slice().reverse() }, NOW);
  assert.equal(again.reused, true);
  const other = L.assignScope([a.scope], { ...draft, brands: ['Sany', 'XCMG', 'Kubota', 'Yanmar', 'Kobelco', 'Liebherr'] }, NOW);
  assert.equal(other.reused, false);
  assert.equal(other.scope.scope_id, 'EXC-MED-006-XT-2');
});
test('inScope: 장비군·톤급·브랜드 모두 맞아야', () => {
  const sc = L.assignScope([], draft, NOW).scope;
  assert.equal(L.inScope({ equipment_type: 'Excavator', tonnage_class: 'MED', brand: 'Komatsu' }, sc), true);
  assert.equal(L.inScope({ equipment_type: 'Excavator', tonnage_class: 'MNI', brand: 'Komatsu' }, sc), false);
  assert.equal(L.inScope({ equipment_type: 'Excavator', tonnage_class: 'MED', brand: 'Sany' }, sc), false);
});

console.log('모델·필수 메타(12절)');
const full = L.cleanModel({ brand: 'cat', model_name: 'X1', equipment_type: '굴착기', collected_at: '2026.09.01', source_url: 'https://example.com/x1', operating_weight: '21.5t', media: [{ path: 'a.jpg', view_type: 'Side' }] });
test('cleanModel: 브랜드 정규화·단위 변환·톤급 자동', () => {
  assert.equal(full.brand, 'Caterpillar (CAT)');
  assert.equal(full.equipment_type, 'Excavator');
  assert.equal(full.operating_weight, 21500);
  assert.equal(full.tonnage_class, 'MED');
  assert.equal(full.collected_at, '2026-09-01');
  assert.equal(full.schema_version, L.SCHEMA_VERSION);
});
test('필수 6개 다 있으면 완전', () => assert.deepEqual(L.completeness(full), { missing: [], total: 6, filled: 6, ok: true }));
test('이미지·출처 없으면 누락 2개', () => {
  const m = L.cleanModel({ ...full, source_url: '', media: [] });
  assert.deepEqual(L.missingFields(m), ['source_url', 'media']);
});
test('톤급과 운전중량이 어긋나면 알려줌', () => {
  const m = L.cleanModel({ ...full, tonnage_class: 'LRG' });
  assert.equal(L.tonnageMismatch(m), 'MED');
  assert.equal(L.tonnageMismatch(full), '');
});
test('validateModel: 필수·중복', () => {
  const errs = L.validateModel(L.cleanModel({ brand: 'CAT', model_name: 'x1' }), [{ ...full, id: 'M0001' }]);
  assert.deepEqual(errs.map(e => e.field + ':' + e.code), ['equipment_type:required', 'model_name:duplicate']);
});
test('nextId', () => assert.equal(L.nextId([{ id: 'M0003' }, { id: 'M0010' }]), 'M0011'));

console.log('예시 데이터·현황표');
const db = Sample.build(NOW);
test('예시 데이터: 모델 15건, 모두 「예시-」 모델명, 출처는 example.com 또는 빈 칸', () => {
  assert.equal(db.models.length, 15);
  assert.ok(db.models.every(m => m.model_name.startsWith('예시-')));
  assert.ok(db.models.every(m => !m.source_url || m.source_url.startsWith('https://example.com/')));
  assert.equal(db._sample, true);
  assert.equal(db.activeScope, 'EXC-MED-006-XT');
});
test('statusMatrix: Excavator 11건, CAT Medium 1건 이미지 6장', () => {
  const mx = L.statusMatrix(db.models, 'Excavator');
  assert.equal(mx.totals.models, 11);
  const cat = mx.rows.find(r => r.brand === 'Caterpillar (CAT)');
  assert.deepEqual(cat.cells.MED, { models: 1, images: 6 });
  assert.equal(cat.views.Rear, 1);
  assert.equal(cat.views['Rear-Quarter'], 1); // 2026-09-30 추가 View
  // 이미지 수: 예시 목록 view 개수 + Side 1장씩 = 6+4+5+3+2+4+2+1+3+2 + Mecalac 3 = 35 (CAT·Volvo 에 Rear-Quarter 1장씩)
  assert.equal(mx.totals.images, 35);
  assert.deepEqual(mx.rows.find(r => r.brand === 'Mecalac').cells.MED, { models: 1, images: 3 });
  assert.equal(mx.totals.incomplete, 2); // XCMG 수집일, Sany 출처
});
test('statusMatrix: Scope 브랜드만 → 6행', () => {
  const sc = db.scopes[0];
  const mx = L.statusMatrix(db.models, 'Excavator', sc.brands);
  assert.equal(mx.rows.length, 6);
  assert.equal(mx.totals.models, 6);          // 6개사 각 1건 (XCMG·Sany·Kubota·Yanmar 제외)
  assert.equal(mx.totals.incomplete, 0);      // 누락 예시(XCMG·Sany)는 Scope 밖
  assert.equal(mx.totals.latest, '2026-09-22'); // Bobcat 예시: 9/28 − 6일
});
test('filterModels: Scope 적용 시 Medium 6개사 → 6건', () => {
  assert.equal(L.filterModels(db.models, { scope: db.scopes[0] }).length, 6);
  assert.equal(L.filterModels(db.models, { view: 'Rear' }).length, 2); // CAT·Volvo 예시만 Rear
  assert.equal(L.filterModels(db.models, { view: 'Rear-Quarter' }).length, 2); // CAT·Volvo 예시만 Rear-Quarter
  assert.equal(L.filterModels(db.models, { year_from: 2025 }).length, 3); // Volvo EX230·Bobcat EX145·Volvo WL150 (Mecalac MW12 는 20년 넘은 자료 시연으로 2005년)
  assert.equal(L.filterModels(db.models, { q: '넓은 글라스' }).length, 5);
  assert.equal(L.filterModels(db.models, { incomplete: true }).length, 3);
});
test('missingSummary', () => {
  const s = L.missingSummary(db.models);
  assert.equal(s.source_url, 1); assert.equal(s.collected_at, 1); assert.equal(s.media, 1); assert.equal(s.brand, 0);
});

console.log('Side-by-Side');
test('비교함은 최대 4개', () => {
  let r = { list: [] };
  ['a', 'b', 'c', 'd'].forEach(id => { r = L.toggleCompare(r.list, id); });
  const over = L.toggleCompare(r.list, 'e');
  assert.equal(over.ok, false); assert.equal(over.list.length, 4);
  assert.deepEqual(L.toggleCompare(r.list, 'b').list, ['a', 'c', 'd']);
});
test('compareRows: 제원은 FACT, 값이 다르면 differs', () => {
  const rows = L.compareRows([db.models[0], db.models[1]]);
  const w = rows.find(r => r.key === 'operating_weight');
  assert.equal(w.kind, '제원(FACT)');
  assert.deepEqual(w.values, ['21,800 kg', '22,400 kg']);
  assert.equal(w.differs, true);
  const et = rows.find(r => r.key === 'equipment_type');
  assert.equal(et.differs, false);
  assert.equal(rows.find(r => r.key === 'form_language').kind, '관찰(OBSERVATION)');
});
test('compareSheet: 머리 4행 + 모델 열', () => {
  const aoa = L.compareSheet([db.models[0], db.models[2]], db.scopes[0], { hideEmpty: true });
  assert.equal(aoa[1][1], 'EXC-MED-006-XT');
  assert.deepEqual(aoa[3].slice(3), ['CAT 예시-EX210', 'Volvo CE 예시-EX230', '차이']);
});

console.log('엑셀 가져오기·열 연결');
const sheet = Sample.importSheet();
const map = L.guessMapping(sheet[0]);
test('사내 정리표 머리글 자동 연결', () => {
  assert.deepEqual(Object.values(map), ['brand', 'model_name', 'equipment_type', 'tonnage_class', 'operating_weight', 'engine_power', 'bucket_capacity', 'release_year', 'source_url', 'collected_at', '_image_path', '_image_view', 'reviewer_note']);
});
test('머리글 단위 읽기', () => {
  assert.equal(L.headerUnit('운전중량(t)'), 't');
  assert.equal(L.headerUnit('엔진출력(hp)'), 'hp');
  assert.equal(L.headerUnit('브랜드'), '');
});
const imported = L.rowsToModels(sheet, map, { weight: 'kg' });
test('rowsToModels: 4건 + 브랜드 없는 행 건너뜀', () => {
  assert.equal(imported.models.length, 4);
  assert.deepEqual(imported.skipped, [{ row: 6, reason: '브랜드·모델명 없음' }]);
});
test('rowsToModels: 머리글 (t)·(hp) 가 기본 단위보다 우선', () => {
  const m = imported.models[0];
  assert.equal(m.brand, 'Caterpillar (CAT)');
  assert.equal(m.operating_weight, 30500);
  assert.equal(m.engine_power, 152.123); // 204 hp × 0.745699872
  assert.equal(m.tonnage_class, 'MED');
  assert.equal(m.collected_at, '2026-09-10');
  assert.deepEqual(m.media.map(x => x.view_type + ':' + x.path), ['Side:images/예시-EX330_side.jpg']);
});
test('rowsToModels: 이미지 여러 개·사선 전면 → Front-Quarter·톤급 자동', () => {
  assert.equal(imported.models[1].media.length, 2);
  assert.equal(imported.models[1].tonnage_class, 'LRG');
  assert.equal(imported.models[3].media[0].view_type, 'Front-Quarter');
  assert.equal(imported.models[3].tonnage_class, 'MED'); // 17.1 t
  assert.equal(imported.models[2].equipment_type, 'Wheel Loader');
  assert.equal(imported.models[2].tonnage_class, 'MED'); // 12.8 t
});
test('View 에 Rear-Quarter(후면 사선) — 목록 순서·엑셀 표기 연결·저장본 유지 (2026-09-30)', () => {
  assert.deepEqual(L.VIEWS, ['Side', 'Front-Quarter', 'Rear-Quarter', 'Rear', 'Cabin', 'CMF Detail', '기타']);
  const views = ['Rear quarter', 'rear-quarter', 'Rear 3/4', '후면 사선', '후방사선', '리어 쿼터', '3/4 rear'];
  const got = L.rowsToModels([['브랜드', '모델명', '이미지', 'View']].concat(views.map((v, i) => ['CAT', 'RQ' + i, 'a' + i + '.jpg', v])),
    { 0: 'brand', 1: 'model_name', 2: '_image_path', 3: '_image_view' }).models.map(m => m.media[0].view_type);
  assert.deepEqual(got, views.map(() => 'Rear-Quarter'));
  // 앞쪽 사선·후면은 그대로
  const other = L.rowsToModels([['브랜드', '모델명', '이미지', 'View'], ['CAT', 'F', 'f.jpg', 'Front 3/4'], ['CAT', 'Q', 'q.jpg', 'quarter'], ['CAT', 'R', 'r.jpg', 'Rear'], ['CAT', 'B', 'b.jpg', '후면']],
    { 0: 'brand', 1: 'model_name', 2: '_image_path', 3: '_image_view' }).models.map(m => m.media[0].view_type);
  assert.deepEqual(other, ['Front-Quarter', 'Front-Quarter', 'Rear', 'Rear']);
  const m = L.cleanModel({ brand: 'cat', model_name: 'X', media: [{ path: 'a.jpg', view_type: 'Rear-Quarter' }] });
  assert.equal(m.media[0].view_type, 'Rear-Quarter');
});
test('mergeModels: 새 모델 추가, 같은 모델은 빈 칸 빼고 갱신', () => {
  const base = [{ ...L.cleanModel({ brand: 'CAT', model_name: '예시-EX330', equipment_type: 'Excavator', publisher: '기존' }), id: 'M0001' }];
  const r = L.mergeModels(base, imported.models);
  assert.equal(r.added, 3); assert.equal(r.updated, 1);
  const hit = r.models.find(m => m.id === 'M0001');
  assert.equal(hit.publisher, '기존');
  assert.equal(hit.operating_weight, 30500);
  assert.deepEqual(r.models.map(m => m.id), ['M0001', 'M0002', 'M0003', 'M0004']);
});
test('내보내기 → 다시 가져오기 왕복(값 보존)', () => {
  const aoa = L.modelsToSheet(db.models);
  const back = L.rowsToModels(aoa, L.guessMapping(aoa[0]), {});
  assert.equal(back.models.length, 15);
  const a = db.models[0], b = back.models[0];
  ['brand', 'model_name', 'equipment_type', 'tonnage_class', 'operating_weight', 'engine_power', 'collected_at', 'human_review_status', 'main_color'].forEach(k => assert.equal(b[k], a[k], k));
  assert.deepEqual(b.design_tags, a.design_tags);
  L.SCORE_AXES.forEach(ax => assert.equal(b[ax.key], a[ax.key], ax.key)); // 평가 점수도 왕복
  assert.equal(b.media.length, 0); // 브라우저 보관 이미지는 엑셀로 안 옮겨짐(JSON 백업 몫)
});
test('CSV 쓰기·읽기 (쉼표·따옴표·줄바꿈)', () => {
  const aoa = [['a', 'b'], ['1,2', 'say "hi"\n둘째 줄']];
  assert.deepEqual(L.parseCsv(L.toCsv(aoa)), aoa);
});
test('restoreDb: 깨진 값 무시, 비교함은 있는 모델만', () => {
  const r = L.restoreDb({ models: db.models, scopes: db.scopes, compare: ['M0001', 'NOPE'], settings: { imageMaxPx: 10 } });
  assert.deepEqual(r.compare, ['M0001']);
  assert.equal(r.settings.imageMaxPx, 800);
  assert.equal(L.restoreDb(null).models.length, 0);
});

console.log('평가 점수·인사이트 (2026-09-29)');
test('평가 기준 8개·권장 비중(합 100%)·5점 Scale — 수강생 평가 기준 자료 그대로', () => {
  assert.deepEqual(L.SCORE_AXES.map(a => a.name), ['Exterior Proportion & Stance', 'Exterior Form & Surface Quality', 'Exterior CMF & Brand Expression',
    'Interior Architecture & Styling', 'Interior CMF & Perceived Quality', 'Ergonomics & Operator Usability', 'HMI & Control Integration', 'Design Identity & Differentiation']);
  assert.deepEqual(L.SCORE_AXES.map(a => a.weight), [15, 15, 10, 15, 10, 15, 10, 10]);
  assert.equal(L.SCORE_AXES.reduce((n, a) => n + a.weight, 0), 100);
  assert.deepEqual(L.SCORE_AXES.map(a => a.checks.length), [4, 4, 4, 4, 4, 5, 4, 5]);
  assert.deepEqual(L.SCORE_LEVELS.map(l => l.value + l.label), ['1개선 필요', '2기본 수준', '3경쟁 평균', '4우수', '5Benchmark 수준']);
  assert.deepEqual(L.SCORE_OPTIONS.map(o => o.value), ['1', '2', '3', '4', '5']);
  // 기준마다 디자이너·AI·근거 칸 3개, 평가 블록에만
  assert.equal(L.fieldsOf('evaluation').length, 24);
  assert.equal(new Set(L.FIELDS.map(f => f.key)).size, L.FIELDS.length);
});
test('cleanScore: 1~5 정수만(평가 기준 자료 5점 Scale), 0·6·빈칸은 빈 값', () => {
  assert.equal(L.cleanScore('4'), 4);
  assert.equal(L.cleanScore('4점'), 4);
  assert.equal(L.cleanScore(3.6), 4);
  assert.equal(L.cleanScore(1), 1);
  assert.equal(L.cleanScore(0), '');          // 자료의 척도는 1부터
  assert.equal(L.cleanScore(6), '');
  assert.equal(L.cleanScore(null), '');
  assert.equal(L.cleanScore(''), '');
  assert.equal(L.cleanScore('점'), '');       // 숫자 없는 글자는 0 이 아니라 빈 값
  assert.equal(L.cleanModel({ brand: 'x', model_name: 'y', score_hmi: '7' }).score_hmi, '');
  assert.equal(L.displayValue({ score_hmi: 5 }, L.fieldByKey('score_hmi')), '5 / 5 (Benchmark 수준)');
  assert.equal(L.displayValue({ ai_form: 3 }, L.fieldByKey('ai_form')), '3 / 5 (경쟁 평균)');
});
test('가중 점수: 평가한 기준의 비중으로 다시 나눔, 최종 = 디자이너 → 없으면 AI', () => {
  const z = L.cleanModel({ brand: 'JCB', model_name: 'z', score_proportion: 5, score_hmi: 2, ai_hmi: 5, ai_identity: 4, note_identity: '근거' });
  const e = L.modelEvaluations([z])[0];
  // (15×5 + 10×2 + 10×4) / (15+10+10) = 135/35 = 3.857…
  assert.deepEqual([e.avg, e.coverage, e.rated, e.aiOnly, e.complete], [3.86, 35, 3, 1, false]);
  assert.deepEqual([e.source.score_hmi, e.source.score_identity, e.source.score_form], ['designer', 'ai', '']);
  assert.equal(e.notes.score_identity, '근거');
  assert.deepEqual(L.weightedScore({}), { value: null, coverage: 0 });
  const full = {}; L.SCORE_AXES.forEach(a => { full[a.key] = 3; });
  assert.deepEqual(L.weightedScore(full), { value: 3, coverage: 100 });
});
test('예전 4축 점수(v0.3)는 legacy_scores 로 옮기고 계산에 쓰지 않음', () => {
  const m = L.cleanModel({ brand: 'JCB', model_name: 'old', score_exterior: 4, score_cmf: 0, score_cabin: '' });
  assert.deepEqual(m.legacy_scores, { exterior: 4, cmf: 0 });
  assert.ok(!('score_exterior' in m) && !('score_cabin' in m));
  assert.equal(L.modelEvaluations([m])[0].avg, null);
  assert.deepEqual(L.cleanModel(m).legacy_scores, { exterior: 4, cmf: 0 });   // 다시 정리해도 그대로
  assert.equal(L.restoreDb({ models: [{ id: 'M0001', brand: 'JCB', model_name: 'a', score_service: 3 }] }).models[0].legacy_scores.service, 3);
});
// 예시 Scope(EXC-MED-006-XT) 6개사 8기준 점수 — 비중 15·15·10·15·10·15·10·10
// CAT 44344344=3.75 · Komatsu 33333433=3.15 · Volvo 44454544=4.3 · Hitachi 3333 2 3 - 3=260/90=2.89 · JCB 54333334=3.55 · Bobcat 33443233=3.1
const scoped = L.filterModels(db.models, { scope: db.scopes[0] });
const ins = L.buildInsight(scoped);
test('brandSummary: 브랜드 6개, 평균·출력대비중량', () => {
  assert.equal(ins.summary.length, 6);
  const volvo = ins.summary.find(r => r.brand === 'Volvo CE');
  assert.equal(volvo.overall, 4.3);         // (60+60+40+75+40+75+40+40)/100
  assert.equal(volvo.scores.score_int_arch, 5);
  assert.equal(ins.summary.find(r => r.short === 'Hitachi').overall, 2.89); // C7 미평가 → 260 / 90
  const jcb = ins.summary.find(r => r.brand === 'JCB');
  assert.equal(jcb.pwr, 5.89);              // 129 kW / 21.9 t
  assert.deepEqual(jcb.weight, { min: 21.9, max: 21.9 });
  assert.equal(ins.summary[0].brand, 'Caterpillar (CAT)'); // 부록 B 순서
});
test('scoreComparison: 축 평균은 모델 단위 평균', () => {
  const ax = Object.fromEntries(ins.scores.axes.map(a => [a.key, a.avg]));
  assert.deepEqual(ax, { score_proportion: 3.67, score_form: 3.5, score_ext_cmf: 3.33, score_int_arch: 3.67, score_int_cmf: 3.17, score_ergonomics: 3.33, score_hmi: 3.4, score_identity: 3.5 });
  assert.equal(ins.scores.axes.find(a => a.key === 'score_hmi').n, 5);   // Hitachi 는 C7 미평가
  const jcb = ins.scores.rows.find(r => r.brand === 'JCB');
  assert.equal(jcb.diff.score_proportion, 1.33);
  assert.equal(ins.scores.axes[0].best.brand, 'JCB');
});
test('strengthsWeaknesses: ±0.5점 기준', () => {
  const by = Object.fromEntries(ins.sw.map(r => [r.short, r]));
  assert.deepEqual(by['JCB'].strengths.map(x => x.key), ['score_proportion', 'score_form', 'score_identity']); // +1.33, +0.5, +0.5
  assert.deepEqual(by['JCB'].weaknesses.map(x => x.key), ['score_int_arch']);                                // 3 − 3.67
  assert.deepEqual(by['Bobcat'].weaknesses.map(x => x.key), ['score_ergonomics', 'score_proportion', 'score_form', 'score_identity']); // 2 − 3.33, 3 − 3.67, 3 − 3.5 ×2
  assert.deepEqual(by['Hitachi'].weaknesses.map(x => x.key).sort(), ['score_form', 'score_identity', 'score_int_arch', 'score_int_cmf', 'score_proportion']);
  assert.equal(by['CAT'].weaknesses.length, 0);
  assert.ok(by['JCB'].strengths[0].text.startsWith('C1 Exterior Proportion & Stance 5점'));
});
test('strengthsWeaknesses: 출력 대비 중량 ±10% 이면 제원 강·약점', () => {
  const two = [
    L.cleanModel({ brand: 'JCB', model_name: 'a', equipment_type: 'Excavator', operating_weight: 20000, engine_power: 150 }), // 7.5 kW/t
    L.cleanModel({ brand: 'Sany', model_name: 'b', equipment_type: 'Excavator', operating_weight: 20000, engine_power: 100 }) // 5.0 kW/t
  ];
  const sw = L.strengthsWeaknesses(two);
  assert.equal(sw.find(r => r.brand === 'JCB').strengths[0].key, 'pwr');   // 평균 6.25 대비 +20%
  assert.equal(sw.find(r => r.brand === 'Sany').weaknesses[0].diff, -20);
  assert.ok(sw[0].notes.some(n => n.includes('평가 점수가 없어')));
});
test('tagTrends: 「넓은 글라스」 3건 50%, 최근 2개 연식 3건', () => {
  assert.deepEqual(ins.tags[0], { tag: '넓은 글라스', count: 3, share: 50, brands: ['CAT', 'Volvo CE', 'Bobcat'], recent: 3 });
});
test('whiteSpace·headline', () => {
  assert.equal(ins.whitespace[0].name, 'C5 Interior CMF & Perceived Quality'); // 3.17 가장 낮음
  assert.equal(ins.whitespace[0].open, false);       // CAT·Volvo 4점
  const brandLine = ins.headline.find(x => x.startsWith('가중 점수 평균이 가장 높은 브랜드'));
  assert.ok(brandLine.includes('Volvo CE(4.3점)') && brandLine.includes('Hitachi(2.89점)'));
  assert.equal(ins.headline[0], '디자인 평가: 모델 6건 중 6건 평가(8기준 모두 입력 5건), 척도 1~5점 · 가중 점수(비중 합 100%).');
  const ws = L.whiteSpace(L.scoreComparison([L.cleanModel({ brand: 'JCB', model_name: 'a', score_int_cmf: 3 })]));
  assert.equal(ws[0].open, true);                    // 최고도 4점 미만
});
test('점수 없는 자료면 안내 문장, 빈 목록도 오류 없음', () => {
  const x = L.buildInsight([L.cleanModel({ brand: 'JCB', model_name: 'a' })]);
  assert.ok(x.headline.some(h => h.includes('평가 점수가 아직 없습니다')));
  assert.ok(x.headline[0].includes('1건 중 0건 평가'));
  assert.equal(L.buildInsight([]).summary.length, 0);
});
test('insightPrompt: 수치·태그만, 출처 URL 은 넣지 않음', () => {
  const p = L.insightPrompt(ins, db.scopes[0]);
  assert.ok(p.includes('EXC-MED-006-XT'));
  assert.ok(p.includes('- Volvo CE (1건): C1 4, C2 4, C3 4, C4 5, C5 4, C6 5, C7 4, C8 4 · 가중 4.3'));
  assert.ok(p.includes('C4 실내 구성(15%) 3.67'));
  assert.ok(!p.includes('example.com'));
});
test('AI 1차 평가: 프롬프트(관찰 기록만, 제원은 맥락), 답 읽기(범위 밖·빈 점수 거름), 디자이너 점수는 그대로', () => {
  const m = L.cleanModel({ brand: 'Volvo CE', model_name: '예시-EX230', equipment_type: 'Excavator', operating_weight: 23500, visibility: '전방·측방 양호',
    source_url: 'https://example.com/x', design_tags: ['슬림 필러'], score_form: 2 });
  const p = L.evalPrompt(m);
  assert.ok(p.includes('Visibility: 전방·측방 양호') && p.includes('운전중량 23,500 kg') && p.includes('슬림 필러'));
  assert.ok(!p.includes('example.com'));                                   // 출처 URL 은 보내지 않음
  assert.ok(p.includes('ergonomics — C6 Ergonomics & Operator Usability (비중 15%)'));
  const ans = '```json\n{"proportion":{"score":4,"confidence":0.7,"evidence":"비례 안정"},"form":{"score":5,"evidence":"x"},"ext_cmf":{"score":null,"evidence":"관찰 기록 없음"},' +
    '"int_arch":{"score":9},"int_cmf":3,"ergonomics":{"score":"4점","evidence":"측방 시야"},"hmi":{"score":0}}\n```';
  const r = L.parseEvalAnswer(ans);
  assert.deepEqual(r.scores, { ai_proportion: 4, ai_form: 5, ai_int_cmf: 3, ai_ergonomics: 4 });
  assert.equal(r.notes.note_proportion, 'AI: 비례 안정 (confidence 0.7)');
  assert.ok(r.errors.some(e => e.startsWith('C4: 1~5 밖')) && r.errors.some(e => e.startsWith('C7: 1~5 밖')) && r.errors.some(e => e === 'C8: 답에 없음'));
  const x = L.applyEvalAnswer({ ...m, note_ergonomics: '디자이너 메모' }, r);
  assert.deepEqual([x.score_form, x.ai_form, x.ai_proportion, x.note_ergonomics, x.prompt_version], [2, 5, 4, '디자이너 메모', L.EVAL_PROMPT_VERSION]);
  assert.equal(L.modelEvaluations([L.cleanModel(x)])[0].scores.score_form, 2);   // 디자이너 점수가 이김
  assert.throws(() => L.parseEvalAnswer('모르겠습니다'), /JSON 객체/);
});

console.log('전문가 피드백');
const T1 = new Date(2026, 8, 29, 9, 5);
test('validateFeedback: 대상·분류·평가·작성자, 동의가 아니면 코멘트 필수', () => {
  assert.deepEqual(L.validateFeedback({ target: 'nope', type: 'x', rating: 0, author: '' }), ['target', 'type', 'rating', 'author', 'comment']);
  assert.deepEqual(L.validateFeedback({ target: 'scores', type: '동의(수정 없음)', rating: 5, author: '디자이너A' }), []);
  assert.deepEqual(L.validateFeedback({ target: 'model:M0001', type: '디자인 Tag 보정', rating: 3, author: '디자이너A', comment: '' }), ['comment']);
});
let fb = L.addFeedback([], { target: 'scores', type: '분석 결과 수정 필요', rating: 3, author: '디자이너A', comment: 'CMF 기준을 다시 봐 주세요' }, T1, 'EXC-MED-006-XT');
test('addFeedback: FB0001·작성 시각·Scope 기록, 상태 열림', () => {
  assert.equal(fb.ok, true);
  assert.deepEqual([fb.item.id, fb.item.created_at, fb.item.scope_id, fb.item.status], ['FB0001', '2026-09-29 09:05', 'EXC-MED-006-XT', '열림']);
  fb = L.addFeedback(fb.list, { target: 'scores', type: '동의(수정 없음)', rating: 5, author: '디자이너B' }, T1);
  assert.equal(fb.item.id, 'FB0002');
  assert.equal(L.addFeedback(fb.list, { target: 'scores' }, T1).ok, false);
});
test('feedbackSummary·상태 변경(내용은 그대로)', () => {
  const s = L.feedbackSummary(fb.list).find(r => r.target === 'scores');
  assert.deepEqual([s.count, s.avg, s.open], [2, 4, 2]);
  const done = L.setFeedbackStatus(fb.list, 'FB0001', '반영됨', new Date(2026, 8, 30, 14, 0));
  assert.deepEqual([done[0].status, done[0].resolved_at, done[0].comment], ['반영됨', '2026-09-30 14:00', 'CMF 기준을 다시 봐 주세요']);
  assert.equal(fb.list[0].status, '열림'); // 원본은 안 바뀜
  assert.equal(L.feedbackSummary(done).find(r => r.target === 'scores').open, 1);
  assert.equal(L.feedbackTargetLabel('model:M0001', db.models), '모델 · CAT 예시-EX210');
});
test('restoreDb: 피드백은 형식이 맞는 것만', () => {
  const r = L.restoreDb({ models: db.models, feedback: fb.list.concat([{ id: 'X', target: 'scores' }]) });
  assert.equal(r.feedback.length, 2);
});

console.log('정기 업데이트·운영 루프');
test('nextDue: 주간·월간(말일 보정)·분기', () => {
  assert.equal(L.nextDue('2026-09-28', 'weekly'), '2026-10-05');
  assert.equal(L.nextDue('2026-01-31', 'monthly'), '2026-02-28');
  assert.equal(L.nextDue('2028-01-31', 'monthly'), '2028-02-29'); // 윤년
  assert.equal(L.nextDue('2026-11-30', 'quarterly'), '2027-02-28');
  assert.equal(L.nextDue('', 'monthly'), '');
});
test('opsStatus: 예시는 주간 주기·한 주 전 갱신 → 오늘 예정, 이틀 뒤면 지남', () => {
  const a = L.opsStatus(db.ops, db.models, NOW);
  assert.deepEqual([a.cycle.id, a.last, a.next, a.daysLeft, a.state], ['weekly', '2026-09-21', '2026-09-28', 0, 'due']);
  const b = L.opsStatus(db.ops, db.models, new Date(2026, 8, 30));
  assert.deepEqual([b.daysLeft, b.state], [-2, 'overdue']);
  assert.equal(L.opsStatus(L.defaultOps(), [], NOW).state, 'none');
});
test('오래된 자료: 수집일 기준 최장 20년(7305일, 2026-09-29 오후 늦게 답변) — 넘은 Mecalac 예시 1건, 수집일 없는 XCMG 1건', () => {
  const a = L.opsStatus(db.ops, db.models, NOW);
  assert.equal(a.staleDays, 7305);
  assert.deepEqual(a.stale.map(x => x.model_name + ':' + x.age), ['예시-MW12:7400']);
  assert.deepEqual(a.undated.map(x => x.model_name), ['예시-EX215C']);
  assert.deepEqual(L.staleModels(db.models, NOW, 26).stale.map(x => x.age), [7400, 27]); // 기준을 줄이면 WL380(27일)도, 오래된 순
  assert.equal(L.staleModels(db.models, NOW, 7400).stale.length, 0);                     // 경계: 「넘은」 것만 — 7400일은 7400일 기준에 안 걸림
  assert.equal(L.staleModels(db.models, NOW, 7399).stale.length, 1);
  assert.equal(L.staleLabel(7305), '20년(7305일)');
  assert.equal(L.staleLabel(5479), '15년(5479일)');
  assert.equal(L.staleLabel(180), '180일');
});
test('단계 체크 → 사이클 완료: 이력 추가, 마지막 갱신일 오늘, 체크 비움', () => {
  let o = L.toggleStep(db.ops, 'collect', true, NOW);
  o = L.toggleStep(o, 'report', true, NOW);
  o = L.toggleStep(o, 'nope', true, NOW);
  assert.equal(L.opsStatus(o, [], NOW).stepsDone, 2);
  const c = L.completeCycle(o, new Date(2026, 8, 29), '신규 2건 반영', 15);
  assert.equal(c.last_update, '2026-09-29');
  assert.deepEqual(c.history[0], { date: '2026-09-29', cycle: 'weekly', steps_done: ['collect', 'report'], note: '신규 2건 반영', models: 15 });
  assert.equal(c.history.length, 2);
  assert.deepEqual(c.steps, {});
  assert.equal(L.nextDue(c.last_update, c.cycle), '2026-10-06');
});
test('restoreOps: 잘못된 값은 기본값', () => {
  const o = L.restoreOps({ cycle: 'daily', stale_days: 1, last_update: '언젠가', steps: { qa: '2026-09-01', x: 1 } });
  assert.deepEqual([o.cycle, o.stale_days, o.last_update, Object.keys(o.steps)], ['weekly', 7305, '', ['qa']]);
  assert.equal(L.restoreOps({ stale_days: 10958, cycle: 'quarterly' }).stale_days, 10958);   // 30년까지
  assert.equal(L.restoreOps({ stale_days: 10959, cycle: 'quarterly' }).stale_days, 7305);
});
test('기본값 변경(주간·20년): 예전 기본값(월간·180일, 15년) 저장본은 한 번 옮기고, 사용자가 고른 값은 둠', () => {
  assert.deepEqual([L.defaultOps().cycle, L.defaultOps().stale_days], ['weekly', 7305]);
  const old = L.restoreOps({ cycle: 'monthly', stale_days: 180, last_update: '2026-09-01' });
  assert.deepEqual([old.cycle, old.stale_days, old.last_update, old.defaults], ['weekly', 7305, '2026-09-01', 3]);
  const p15 = L.restoreOps({ cycle: 'biweekly', stale_days: 5479, defaults: 2 });           // 15년 기본값 그대로 → 20년, 주기는 사용자 값
  assert.deepEqual([p15.cycle, p15.stale_days, p15.defaults], ['biweekly', 7305, 3]);
  assert.equal(L.restoreOps({ cycle: 'weekly', stale_days: 5479, defaults: 3 }).stale_days, 5479); // 20년 뒤 사용자가 15년을 고름
  assert.equal(L.restoreOps({ cycle: 'weekly', stale_days: 3650, defaults: 2 }).stale_days, 3650); // 사용자가 고친 값
  const kept = L.restoreOps({ cycle: 'monthly', stale_days: 180, defaults: 2 });            // 옮긴 뒤 사용자가 다시 고른 값
  assert.deepEqual([kept.cycle, kept.stale_days], ['monthly', 180]);
  assert.deepEqual([L.restoreOps({ cycle: 'monthly', stale_days: 365 }).cycle, L.restoreOps({ cycle: 'monthly', stale_days: 365 }).stale_days], ['monthly', 365]);
  assert.equal(L.restoreOps(L.restoreOps({ cycle: 'monthly', stale_days: 180 })).cycle, 'weekly'); // 다시 읽어도 그대로
});
test('Mecalac: 모든 장비군으로 구분(2026-09-29 오후 답변) — 굴착기·휠로더 Scope 모두 선택 가능', () => {
  for (const [eq, ton] of [['Excavator', 'MED'], ['Wheel Loader', 'SML']])
    assert.deepEqual(L.validateScope({ equipment_type: eq, tonnage_class: ton, brands: ['Mecalac'], purposes: ['Exterior'] }), []);
  assert.equal(L.brandAvailability(db.models, 'Wheel Loader', 'SML')['Mecalac'], 0);          // 목록에 있고 건수만 0
});

console.log('Benchmarking Report');
const dbr = { ...db, compare: ['M0001', 'M0003'], feedback: L.addFeedback(fb.list, { target: 'sw', type: '예외 사례 등록', rating: 2, author: '디자이너A', comment: '<script>alert(1)</script> 확인' }, T1).list,
  insightNote: { text: '요약 1줄\n요약 2줄', origin: '디자이너 작성', saved_at: '2026-09-29 09:00' } };
const rep = L.buildReport(dbr, { now: NOW });
test('buildReport: Scope 6건 기준, 비교표·피드백·운영 포함', () => {
  assert.equal(rep.filterLabel, 'Scope EXC-MED-006-XT');
  assert.equal(rep.title, 'Medium Excavator Design Benchmark');
  assert.deepEqual([rep.overview.models, rep.overview.brands, rep.overview.scored], [6, 6, 6]);
  assert.deepEqual(rep.compare.models, ['CAT 예시-EX210', 'Volvo CE 예시-EX230']);
  assert.ok(rep.compare.rows.every(r => r.block !== 'Source / Provenance'));
  assert.equal(rep.feedback.items.length, 3);
  assert.equal(rep.ops.state, 'due');
  assert.equal(L.buildReport(dbr, { now: NOW, useScope: false }).overview.models, 15);
});
test('reportSheets: 시트 9개, 디자인평가 6행(+척도·기준 버전)·평가표(기준 × 브랜드, 자료 5절 모양)', () => {
  const sh = L.reportSheets(rep);
  assert.deepEqual(sh.map(x => x.name), ['요약', '디자인평가', '브랜드요약', '평가표', '강약점', '태그트렌드', '선택비교', '전문가피드백', '운영']);
  assert.equal(sh[1].aoa.length, 10);
  assert.deepEqual(sh[1].aoa[0].slice(2, 4), ['C1 Exterior Proportion & Stance (15%)', 'C2 Exterior Form & Surface Quality (15%)']);
  const t = sh[3].aoa;
  assert.deepEqual(t[0].slice(0, 3), ['평가 기준', '가중치(%)', 'CAT']);
  assert.deepEqual(t[1].slice(0, 2), ['C1 Exterior Proportion & Stance', 15]);
  assert.equal(t[9][0], '가중 점수');
  assert.equal(t[9][t[0].indexOf('Volvo CE')], '4.3');
  assert.equal(sh[2].aoa.length, 7);
  assert.equal(sh[7].aoa[3][4], '<script>alert(1)</script> 확인'); // 엑셀은 원문 그대로
  assert.ok(!L.reportSheets(L.buildReport({ ...dbr, compare: [] }, { now: NOW })).some(x => x.name === '선택비교'));
});
test('디자인 평가(모델별 점수): 브랜드 순서, 가중 점수, 예시 Sany 는 AI 점수만(검증 전)', () => {
  const ev = rep.insight.evaluations;
  assert.equal(ev.length, 6);
  assert.equal(ev[0].short, 'CAT');
  const volvo = ev.find(e => e.short === 'Volvo CE');
  assert.deepEqual([volvo.avg, volvo.rated, volvo.complete, volvo.coverage], [4.3, 8, true, 100]);
  const sany = L.modelEvaluations(db.models.filter(m => m.model_name === '예시-EX215S'))[0];
  assert.deepEqual([sany.aiOnly, sany.avg], [8, 3.15]);                 // (60+45+30+45+30+45+30+30)/100
});
test('reportHtml: 항목 10개(2번 디자인 평가 + 3~6번 평가 기반 Insight), 글자는 이스케이프', () => {
  const html = L.reportHtml(rep);
  assert.equal(L.REPORT_SECTIONS.length, 10);
  assert.equal(L.REPORT_SECTIONS[1].id, 'evaluation');
  assert.ok(L.REPORT_SECTIONS.slice(2, 6).every(x => x.name.includes('Insight')));
  assert.equal((html.match(/data-section="/g) || []).length, L.REPORT_SECTIONS.length);
  assert.ok(html.indexOf('data-section="evaluation"') < html.indexOf('data-section="brands"'));
  assert.ok(html.includes('예시-EX230'));
  assert.ok(html.includes('C4 실내 구성 15%') && html.includes('1 개선 필요 · 2 기본 수준'));
  assert.ok(html.startsWith('<!doctype html>'));
  assert.ok(!html.includes('<script>alert(1)'));
  assert.ok(html.includes('&lt;script&gt;alert(1)'));
  assert.ok(html.includes('예시 데이터 — 모델명'));
  assert.ok(html.includes('요약 1줄\n요약 2줄'));
});

console.log('보고서 목적별 비중 프로필 · Radar Chart (2026-09-30)');
test('기본 프로필 6개 — 모두 합 100, 「종합」은 평가 기준 자료 권장 비중 그대로', () => {
  assert.equal(L.WEIGHT_PRESETS.length, 6);
  L.WEIGHT_PRESETS.forEach(p => assert.ok(L.validateWeights(p.weights).ok, p.id));
  assert.deepEqual(L.WEIGHT_PRESETS[0].weights, L.weightMap(null));
  const wg = L.defaultWeighting();
  assert.equal(L.weightLabel(wg), '종합 벤치마킹 v1');
});
test('validateWeights: 합 100·0~100 정수만', () => {
  const base = L.weightMap(null);
  assert.equal(L.validateWeights({ ...base, identity: 11 }).errors[0], '비중 합계가 101% 입니다. 100% 가 되게 맞춰 주세요.');
  assert.equal(L.validateWeights({ ...base, identity: -1, hmi: 21 }).ok, false);
  assert.equal(L.validateWeights({ ...base, identity: 10.5, hmi: 9.5 }).ok, false);
  assert.equal(L.validateWeights({ ...base, identity: 0, hmi: 20 }).ok, true);   // 0 은 「이 목적에선 안 봄」
  assert.equal(L.validateWeights(L.cleanWeights({ ...base, hmi: '' })).ok, false);
});
test('가중 점수는 프로필 비중으로 — 예시-EX215S: 종합 3.15 → Cabin·HMI 3.05 (손 계산)', () => {
  const m = db.models.filter(x => x.model_name === '예시-EX215S');
  const cabin = L.WEIGHT_PRESETS.find(p => p.id === 'cabin').weights;
  assert.equal(L.modelEvaluations(m)[0].avg, 3.15);
  assert.equal(L.modelEvaluations(m, cabin)[0].avg, 3.05);                     // (20+15+15+60+45+60+60+30)/100
  // 비중 0 인 기준은 점수가 있어도 계산에서 빠진다
  const only = { proportion: 100, form: 0, ext_cmf: 0, int_arch: 0, int_cmf: 0, ergonomics: 0, hmi: 0, identity: 0 };
  assert.equal(L.modelEvaluations(m, only)[0].avg, 4);
});
test('saveWeightVersion: 덮어쓰지 않고 v2 로 쌓임 · 같은 값·합 틀림 거절 · 원본 불변', () => {
  const wg = L.defaultWeighting();
  const w2 = { ...L.currentWeights({ ...wg, active: 'cabin' }), ergonomics: 25, int_cmf: 10 };
  const r = L.saveWeightVersion(wg, 'cabin', w2, { author: '디자이너A', memo: 'C6 상향', now: NOW });
  assert.ok(r.ok);
  const cab = L.weightProfile(r.weighting, 'cabin');
  assert.deepEqual(cab.versions.map(v => v.v), [1, 2]);
  assert.equal(cab.versions[0].weights.ergonomics, 20);                          // v1 은 그대로 남음
  assert.equal(L.weightProfile(wg, 'cabin').versions.length, 1);                // 원본 불변
  assert.equal(L.saveWeightVersion(r.weighting, 'cabin', w2).ok, false);        // v2 와 같음
  assert.equal(L.saveWeightVersion(wg, 'cabin', { ...w2, hmi: 30 }).ok, false); // 합 110
  const act = { ...r.weighting, active: 'cabin' };
  assert.equal(L.weightLabel(act), 'Cabin·HMI 보고 v2');
  assert.equal(L.currentWeights(act).ergonomics, 25);
});
test('addWeightProfile · restoreWeighting: 사용자 프로필 u1, 잘못된 버전·없는 active 는 버림', () => {
  const r = L.addWeightProfile(L.defaultWeighting(), '임원 보고', L.WEIGHT_PRESETS[5].weights, { now: NOW });
  assert.ok(r.ok); assert.equal(r.profile.id, 'u1');
  assert.equal(L.addWeightProfile(r.weighting, '임원 보고', L.WEIGHT_PRESETS[5].weights).ok, false);
  const back = L.restoreWeighting(JSON.parse(JSON.stringify({ ...r.weighting, active: 'u1' })));
  assert.equal(back.active, 'u1'); assert.equal(back.profiles.length, 7);
  const broken = L.restoreWeighting({ active: 'nope', profiles: [{ id: 'cmf', versions: [{ v: 1, weights: { proportion: 50 } }] }] });
  assert.equal(broken.active, 'full');
  assert.equal(L.weightProfile(broken, 'cmf').versions[0].weights.ext_cmf, 25); // 망가진 버전 대신 기본값
  assert.equal(L.restoreDb({ models: [] }).weighting.active, 'full');           // 예전 저장본도 열림
});
test('팀 기준 비중 없음(2026-09-30 오후 답변) — 예시 프로필이 기본값으로 표기', () => {
  assert.ok(L.TEAM_WEIGHTS_NOTE.includes('따로 정한 목적별 비중은 없습니다'));
  assert.equal(L.WEIGHT_PRESETS.filter(p => p.source.includes('예시 값(기본값)')).length, 5);
  assert.equal(L.defaultWeighting().adjusted, null);
});
test('normalizeWeights: 아무 숫자나 → 정수 · 합 100 (최대 나머지 방식)', () => {
  const w = L.normalizeWeights({ proportion: 1, form: 1, ext_cmf: 1, int_arch: 1, int_cmf: 1, ergonomics: 1, hmi: 1, identity: 1 });
  assert.deepEqual(Object.values(w), [13, 13, 13, 13, 12, 12, 12, 12]);
  const x = L.normalizeWeights({ proportion: 3, form: 3, ext_cmf: 2, int_arch: 3, int_cmf: 2, ergonomics: 3, hmi: 2, identity: 2 });  // 합 20 → ×5
  assert.deepEqual(x, L.WEIGHT_PRESETS[0].weights);
  assert.equal(L.normalizeWeights({ proportion: 0 }), null);                    // 모두 0 은 못 맞춤
  assert.equal(L.normalizeWeights({ proportion: -5, form: 'abc', hmi: 7 }).hmi, 100);  // 음수·글자는 0
});
test('adjustWeight: 하나를 바꾸면 나머지가 지금 비율대로 맞춰져 합 100', () => {
  const full = L.WEIGHT_PRESETS[0].weights;
  const a = L.adjustWeight(full, 'identity', 30);                            // 나머지 90 → 70 으로 비례
  assert.equal(a.identity, 30);
  assert.equal(Object.values(a).reduce((x, y) => x + y, 0), 100);
  assert.ok(Object.values(a).every(v => Number.isInteger(v) && v >= 0));
  assert.ok(a.proportion > a.ext_cmf);                                        // 15:10 비율 유지(반올림 안)
  assert.deepEqual(L.adjustWeight(full, 'identity', 10), full);               // 그대로면 그대로
  const all = L.adjustWeight(full, 'hmi', 100);
  assert.equal(all.hmi, 100); assert.equal(all.form, 0);
  const back = L.adjustWeight(all, 'hmi', 44);                                // 나머지가 모두 0 이면 똑같이 나눔
  assert.equal(Object.values(back).reduce((x, y) => x + y, 0), 100);
  assert.equal(back.proportion, 8); assert.equal(back.identity, 8);
  assert.equal(L.adjustWeight(full, 'form', 250).form, 100);                  // 범위 밖은 0~100 으로
  assert.equal(L.adjustWeight(full, 'form', 'x').form, 15);                   // 숫자 아님 → 그대로
  assert.deepEqual(L.adjustWeight(full, 'nope', 50), full);                   // 없는 기준
});
test('setAdjusted · selectProfile: 조정값이 가중 점수·라벨에 쓰이고, 목적을 고르면 비워짐', () => {
  const wg0 = L.defaultWeighting();
  const w = L.adjustWeight(L.currentWeights(wg0), 'ergonomics', 40);
  const r = L.setAdjusted(wg0, w);
  assert.ok(r.ok);
  assert.equal(wg0.adjusted, null);                                           // 원본 불변
  assert.equal(L.currentWeights(r.weighting).ergonomics, 40);
  assert.equal(L.weightLabel(r.weighting), '종합 벤치마킹 v1 기준 조정(저장 전)');
  assert.equal(L.setAdjusted(wg0, L.WEIGHT_PRESETS[0].weights).weighting.adjusted, null);  // 원래 값과 같으면 조정 없음
  assert.equal(L.setAdjusted(wg0, { ...w, hmi: 90 }).ok, false);               // 합 틀림 거절
  const sel = L.selectProfile(r.weighting, 'cabin');
  assert.equal(sel.adjusted, null); assert.equal(sel.active, 'cabin');
  assert.equal(L.weightLabel(sel), 'Cabin·HMI 보고 v1');
  // 저장본 복원 — 조정값은 살고, 바탕 프로필이 다르면 버림
  const back = L.restoreWeighting(JSON.parse(JSON.stringify(r.weighting)));
  assert.equal(L.currentWeights(back).ergonomics, 40);
  assert.equal(L.restoreWeighting({ ...JSON.parse(JSON.stringify(r.weighting)), active: 'cmf' }).adjusted, null);
  // 리포트가 조정값으로 계산하고 인쇄함
  const rep = L.buildReport({ ...dbr, weighting: r.weighting }, { now: NOW });
  assert.equal(rep.weighting.adjusted, true);
  assert.equal(rep.weighting.weights.ergonomics, 40);
  const html = L.reportHtml(rep);
  assert.ok(html.includes('종합 벤치마킹 v1 기준 조정(저장 전)'));
  assert.ok(html.includes('C6 인간공학 40%'));
  assert.ok(html.includes('사용자가 이 리포트를 위해 조정한 비중'));
});
test('saveMyWeights: 이름 붙인 내 프로필 v1 → 같은 이름이면 v2, 기본 이름·빈 이름 거절', () => {
  const adj = L.setAdjusted(L.defaultWeighting(), L.adjustWeight(L.WEIGHT_PRESETS[0].weights, 'identity', 30)).weighting;
  const r1 = L.saveMyWeights(adj, '임원 보고용', { author: '디자이너A', now: NOW });
  assert.ok(r1.ok); assert.equal(r1.created, true); assert.equal(r1.profile.id, 'u1');
  assert.equal(r1.weighting.active, 'u1'); assert.equal(r1.weighting.adjusted, null);
  assert.equal(L.weightLabel(r1.weighting), '임원 보고용 v1');
  assert.equal(L.currentWeights(r1.weighting).identity, 30);
  assert.ok(r1.version.memo.includes('종합 벤치마킹 v1'));
  const adj2 = L.setAdjusted(r1.weighting, L.adjustWeight(L.currentWeights(r1.weighting), 'hmi', 20)).weighting;
  const r2 = L.saveMyWeights(adj2, '임원 보고용', { now: NOW });
  assert.ok(r2.ok); assert.equal(r2.created, false); assert.equal(r2.version.v, 2);
  assert.equal(L.weightProfile(r2.weighting, 'u1').versions.length, 2);
  assert.equal(L.saveMyWeights(r2.weighting, '임원 보고용').ok, false);           // v2 와 같은 값
  assert.equal(L.saveMyWeights(adj, '종합 벤치마킹').ok, false);                   // 기본 프로필 이름
  assert.equal(L.saveMyWeights(adj, '  ').ok, false);
});
test('suggestProfile: Scope 목적 하나면 그 프로필, 섞이면 종합', () => {
  assert.equal(L.suggestProfile(['Cabin']), 'cabin');
  assert.equal(L.suggestProfile(['Serviceability', 'Safety']), 'usability');
  assert.equal(L.suggestProfile(['Exterior', 'CMF']), 'full');
  assert.equal(L.suggestProfile([]), '');
});
test('buildReport: 비중 프로필·버전이 리포트·xlsx 에 적히고 Radar(SVG)가 들어감', () => {
  const wg = L.saveWeightVersion(L.defaultWeighting(), 'cabin', { ...L.WEIGHT_PRESETS[2].weights, ergonomics: 25, int_cmf: 10 }, { memo: 'C6 상향', now: NOW }).weighting;
  const r2 = L.buildReport({ ...dbr, weighting: { ...wg, active: 'cabin' } }, { now: NOW });
  assert.equal(r2.weighting.label, 'Cabin·HMI 보고 v2');
  const html = L.reportHtml(r2);
  assert.ok(html.includes('비중 프로필 <b>Cabin·HMI 보고 v2</b>'));
  assert.ok(html.includes('C6 인간공학 25%'));
  assert.ok(html.includes('<svg') && html.includes('Radar Chart'));
  assert.ok(!/<script|https?:\/\/(?!www\.w3\.org)/.test(html.slice(html.indexOf('<svg'), html.indexOf('</svg>'))));  // 외부 자원 없음
  const sheet = L.reportSheets(r2).find(s => s.name === '요약').aoa;
  assert.ok(sheet.some(row => row[0] === '비중 프로필' && row[1].startsWith('Cabin·HMI 보고 v2')));
  assert.ok(r2.insight.summary.some((r, i) => r.overall !== rep.insight.summary[i].overall)); // 비중이 바뀌면 가중 점수도 바뀜
});
test('radarSvg: 기준 8개 축·계열마다 점, 빈 점수는 점 없이 범례에 「미평가」, 이름은 이스케이프', () => {
  const svg = L.radarSvg({ series: [
    { name: 'A<b>', values: [5, 4, 3, 2, 1, 2, 3, 4] },
    { name: 'B', values: [3, null, 3, 3, null, 3, 3, 3] },
    { name: '평균', values: [3, 3, 3, 3, 3, 3, 3, 3], dashed: true }] });
  assert.equal((svg.match(/<line /g) || []).length, 8);
  assert.equal((svg.match(/<circle /g) || []).length, 8 + 6);                   // 점선 평균은 점 없음
  assert.ok(svg.includes('(미평가 C2·C5)'));
  assert.ok(svg.includes('A&lt;b&gt;') && !svg.includes('A<b>'));
  assert.ok(svg.includes('stroke-dasharray'));
  // 5점 = 바깥 고리, 첫 축은 12시 방향(위)
  const first = svg.match(/<circle cx="([\d.]+)" cy="([\d.]+)"/);
  assert.deepEqual([Number(first[1]), Number(first[2])], [210, 78]);             // size 420, R = 210-78 = 132 → y = 210-132
});

console.log('\n' + passed + '개 통과' + (process.exitCode ? ' · 실패 있음' : ''));

// 과제 B(업무보고 Agent) 테스트도 함께 돌린다 — 따로: node test/report-logic.test.mjs
await import('./report-logic.test.mjs');
// 과제 A·B 공용 AI 연결 설정(OpenAI 호환 엔드포인트) — 따로: node test/ai-endpoint.test.mjs
await import('./ai-endpoint.test.mjs');
