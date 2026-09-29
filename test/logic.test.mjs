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
test('statusMatrix: Excavator 11건, CAT Medium 1건 이미지 5장', () => {
  const mx = L.statusMatrix(db.models, 'Excavator');
  assert.equal(mx.totals.models, 11);
  const cat = mx.rows.find(r => r.brand === 'Caterpillar (CAT)');
  assert.deepEqual(cat.cells.MED, { models: 1, images: 5 });
  assert.equal(cat.views.Rear, 1);
  // 이미지 수: 예시 목록 view 개수 + Side 1장씩 = 5+4+4+3+2+4+2+1+3+2 + Mecalac 3 = 33
  assert.equal(mx.totals.images, 33);
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
  assert.equal(L.filterModels(db.models, { year_from: 2025 }).length, 4); // Volvo EX230·Bobcat EX145·Volvo WL150·Mecalac MW12
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
test('cleanScore: 1~5 정수만, 나머지는 빈 값', () => {
  assert.equal(L.cleanScore('4'), 4);
  assert.equal(L.cleanScore('4점'), 4);
  assert.equal(L.cleanScore(3.6), 4);
  assert.equal(L.cleanScore(0), '');
  assert.equal(L.cleanScore(6), '');
  assert.equal(L.cleanScore(''), '');
  assert.equal(L.cleanModel({ brand: 'x', model_name: 'y', score_cmf: '7' }).score_cmf, '');
  assert.equal(L.displayValue({ score_cabin: 5 }, L.fieldByKey('score_cabin')), '5 / 5');
});
// 예시 Scope(EXC-MED-006-XT) 6개사 점수 — [Ext, Cabin, CMF, Service]
// CAT 4434 · Komatsu 3334 · Volvo 4543 · Hitachi 3333 · JCB 5333 · Bobcat 3432
const scoped = L.filterModels(db.models, { scope: db.scopes[0] });
const ins = L.buildInsight(scoped);
test('brandSummary: 브랜드 6개, 평균·출력대비중량', () => {
  assert.equal(ins.summary.length, 6);
  const volvo = ins.summary.find(r => r.brand === 'Volvo CE');
  assert.equal(volvo.overall, 4);           // (4+5+4+3)/4
  assert.equal(volvo.scores.score_cabin, 5);
  const jcb = ins.summary.find(r => r.brand === 'JCB');
  assert.equal(jcb.pwr, 5.89);              // 129 kW / 21.9 t
  assert.deepEqual(jcb.weight, { min: 21.9, max: 21.9 });
  assert.equal(ins.summary[0].brand, 'Caterpillar (CAT)'); // 부록 B 순서
});
test('scoreComparison: 축 평균은 모델 단위 평균', () => {
  const ax = Object.fromEntries(ins.scores.axes.map(a => [a.key, a.avg]));
  assert.deepEqual(ax, { score_exterior: 3.67, score_cabin: 3.67, score_cmf: 3.17, score_service: 3.17 }); // 22/6, 22/6, 19/6, 19/6
  const jcb = ins.scores.rows.find(r => r.brand === 'JCB');
  assert.equal(jcb.diff.score_exterior, 1.33);
  assert.equal(ins.scores.axes[0].best.brand, 'JCB');
});
test('strengthsWeaknesses: ±0.5점 기준', () => {
  const by = Object.fromEntries(ins.sw.map(r => [r.short, r]));
  assert.deepEqual(by['JCB'].strengths.map(x => x.key), ['score_exterior']);
  assert.deepEqual(by['Volvo CE'].strengths.map(x => x.key), ['score_cabin', 'score_cmf']); // +1.33, +0.83 (차이 큰 순)
  assert.deepEqual(by['Bobcat'].weaknesses.map(x => x.key), ['score_service', 'score_exterior']); // 2 − 3.17, 3 − 3.67
  assert.deepEqual(by['Hitachi'].weaknesses.map(x => x.key).sort(), ['score_cabin', 'score_exterior']);
  assert.equal(by['CAT'].weaknesses.length, 0);
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
  assert.equal(ins.whitespace[0].name, 'CMF');       // 3.17 동점이면 축 순서
  assert.equal(ins.whitespace[0].open, false);       // Volvo 4점
  assert.ok(ins.headline[0].includes('Volvo CE(4점)'));
  assert.ok(ins.headline[0].includes('Bobcat(3점)'));
  const ws = L.whiteSpace(L.scoreComparison([L.cleanModel({ brand: 'JCB', model_name: 'a', score_cmf: 3 })]));
  assert.equal(ws[0].open, true);                    // 최고도 4점 미만
});
test('점수 없는 자료면 안내 문장, 빈 목록도 오류 없음', () => {
  const x = L.buildInsight([L.cleanModel({ brand: 'JCB', model_name: 'a' })]);
  assert.ok(x.headline[0].includes('평가 점수가 아직 없습니다'));
  assert.equal(L.buildInsight([]).summary.length, 0);
});
test('insightPrompt: 수치·태그만, 출처 URL 은 넣지 않음', () => {
  const p = L.insightPrompt(ins, db.scopes[0]);
  assert.ok(p.includes('EXC-MED-006-XT'));
  assert.ok(p.includes('- Volvo CE (1건): Exterior 4, Cabin 5, CMF 4, Service 3'));
  assert.ok(!p.includes('example.com'));
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
test('opsStatus: 예시는 한 달 전 갱신 → 오늘 예정, 이틀 뒤면 지남', () => {
  const a = L.opsStatus(db.ops, db.models, NOW);
  assert.deepEqual([a.last, a.next, a.daysLeft, a.state], ['2026-08-28', '2026-09-28', 0, 'due']);
  const b = L.opsStatus(db.ops, db.models, new Date(2026, 8, 30));
  assert.deepEqual([b.daysLeft, b.state], [-2, 'overdue']);
  assert.equal(L.opsStatus(L.defaultOps(), [], NOW).state, 'none');
});
test('오래된 자료: 180일 넘은 Mecalac 예시 1건, 수집일 없는 XCMG 1건', () => {
  const a = L.opsStatus(db.ops, db.models, NOW);
  assert.deepEqual(a.stale.map(x => x.model_name + ':' + x.age), ['예시-MW12:240']);
  assert.deepEqual(a.undated.map(x => x.model_name), ['예시-EX215C']);
  assert.deepEqual(L.staleModels(db.models, NOW, 26).stale.map(x => x.age), [240, 27]); // 기준을 줄이면 WL380(27일)도, 오래된 순
});
test('단계 체크 → 사이클 완료: 이력 추가, 마지막 갱신일 오늘, 체크 비움', () => {
  let o = L.toggleStep(db.ops, 'collect', true, NOW);
  o = L.toggleStep(o, 'report', true, NOW);
  o = L.toggleStep(o, 'nope', true, NOW);
  assert.equal(L.opsStatus(o, [], NOW).stepsDone, 2);
  const c = L.completeCycle(o, new Date(2026, 8, 29), '신규 2건 반영', 15);
  assert.equal(c.last_update, '2026-09-29');
  assert.deepEqual(c.history[0], { date: '2026-09-29', cycle: 'monthly', steps_done: ['collect', 'report'], note: '신규 2건 반영', models: 15 });
  assert.equal(c.history.length, 2);
  assert.deepEqual(c.steps, {});
  assert.equal(L.nextDue(c.last_update, c.cycle), '2026-10-29');
});
test('restoreOps: 잘못된 값은 기본값', () => {
  const o = L.restoreOps({ cycle: 'daily', stale_days: 1, last_update: '언젠가', steps: { qa: '2026-09-01', x: 1 } });
  assert.deepEqual([o.cycle, o.stale_days, o.last_update, Object.keys(o.steps)], ['monthly', 180, '', ['qa']]);
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
test('reportSheets: 시트 8개, 브랜드요약 6행', () => {
  const sh = L.reportSheets(rep);
  assert.deepEqual(sh.map(x => x.name), ['요약', '브랜드요약', '점수비교', '강약점', '태그트렌드', '선택비교', '전문가피드백', '운영']);
  assert.equal(sh[1].aoa.length, 7);
  assert.equal(sh[6].aoa[3][4], '<script>alert(1)</script> 확인'); // 엑셀은 원문 그대로
  assert.ok(!L.reportSheets(L.buildReport({ ...dbr, compare: [] }, { now: NOW })).some(x => x.name === '선택비교'));
});
test('reportHtml: 항목 9개(data-section), 글자는 이스케이프', () => {
  const html = L.reportHtml(rep);
  assert.equal((html.match(/data-section="/g) || []).length, L.REPORT_SECTIONS.length);
  assert.ok(html.startsWith('<!doctype html>'));
  assert.ok(!html.includes('<script>alert(1)'));
  assert.ok(html.includes('&lt;script&gt;alert(1)'));
  assert.ok(html.includes('예시 데이터 — 모델명'));
  assert.ok(html.includes('요약 1줄\n요약 2줄'));
});

console.log('\n' + passed + '개 통과' + (process.exitCode ? ' · 실패 있음' : ''));

// 과제 B(업무보고 Agent) 테스트도 함께 돌린다 — 따로: node test/report-logic.test.mjs
await import('./report-logic.test.mjs');
