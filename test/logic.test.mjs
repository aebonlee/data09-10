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
test('경쟁사 13개사, 제출 순서 그대로', () => {
  assert.equal(L.BRANDS.length, 13);
  assert.equal(L.BRANDS[0].name, 'Caterpillar (CAT)');
  assert.equal(L.BRANDS[12].name, 'Kobelco');
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
test('예시 데이터: 모델 14건, 모두 「예시-」 모델명, 출처는 example.com 또는 빈 칸', () => {
  assert.equal(db.models.length, 14);
  assert.ok(db.models.every(m => m.model_name.startsWith('예시-')));
  assert.ok(db.models.every(m => !m.source_url || m.source_url.startsWith('https://example.com/')));
  assert.equal(db._sample, true);
  assert.equal(db.activeScope, 'EXC-MED-006-XT');
});
test('statusMatrix: Excavator 10건, CAT Medium 1건 이미지 5장', () => {
  const mx = L.statusMatrix(db.models, 'Excavator');
  assert.equal(mx.totals.models, 10);
  const cat = mx.rows.find(r => r.brand === 'Caterpillar (CAT)');
  assert.deepEqual(cat.cells.MED, { models: 1, images: 5 });
  assert.equal(cat.views.Rear, 1);
  // 이미지 수: 예시 목록 view 개수 + Side 1장씩 = 5+4+4+3+2+4+2+1+3+2 = 30
  assert.equal(mx.totals.images, 30);
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
  assert.equal(L.filterModels(db.models, { year_from: 2025 }).length, 3); // Volvo EX230·Bobcat EX145·Volvo WL150
  assert.equal(L.filterModels(db.models, { q: '넓은 글라스' }).length, 4);
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
  assert.equal(back.models.length, 14);
  const a = db.models[0], b = back.models[0];
  ['brand', 'model_name', 'equipment_type', 'tonnage_class', 'operating_weight', 'engine_power', 'collected_at', 'human_review_status', 'main_color'].forEach(k => assert.equal(b[k], a[k], k));
  assert.deepEqual(b.design_tags, a.design_tags);
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

console.log('\n' + passed + '개 통과' + (process.exitCode ? ' · 실패 있음' : ''));
