/* Design Benchmarking Agent — 순수 로직 (화면·저장소와 무관)
   브라우저에서는 window.DBLogic, node 에서는 require('./logic.js') 로 씁니다.
   기준 문서: docs/01_프로젝트_기획서.md (3장 데이터, 5장 기능, 8장 1단계)
   근거 원문: 제출 기획서 Rev 3.0 — 6절 Schema, 12절 Data Completeness, 18절 View Taxonomy, 부록 B·C */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DBLogic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SCHEMA_VERSION = 'v0.2-stage1';  // v0.2: 평가 점수 4축 추가(2026-09-29)

  /* ── 부록 B. 경쟁사 Selection Universe (제출 13개사 + 2026-09-29 수강생 요청 Mecalac = 14개사)
     개수는 어디서도 숫자로 적지 않고 BRANDS.length 로 셉니다. ── */
  var BRANDS = [
    { id: 'cat', name: 'Caterpillar (CAT)', short: 'CAT', hq: '미국', aliases: ['cat', 'caterpillar', 'caterpillar (cat)'] },
    { id: 'komatsu', name: 'Komatsu', short: 'Komatsu', hq: '일본', aliases: ['komatsu', '코마츠'] },
    { id: 'xcmg', name: 'XCMG', short: 'XCMG', hq: '중국', aliases: ['xcmg'] },
    { id: 'deere', name: 'John Deere', short: 'John Deere', hq: '미국', aliases: ['john deere', 'deere', '존디어'] },
    { id: 'liebherr', name: 'Liebherr', short: 'Liebherr', hq: '독일 / 스위스', aliases: ['liebherr', '리브헤르'] },
    { id: 'sany', name: 'Sany', short: 'Sany', hq: '중국', aliases: ['sany', '싼이', '산이'] },
    { id: 'volvo', name: 'Volvo CE', short: 'Volvo CE', hq: '스웨덴', aliases: ['volvo ce', 'volvo', '볼보'] },
    { id: 'hitachi', name: 'Hitachi Construction Machinery', short: 'Hitachi', hq: '일본', aliases: ['hitachi', 'hitachi construction machinery', '히타치'] },
    { id: 'jcb', name: 'JCB', short: 'JCB', hq: '영국', aliases: ['jcb'] },
    { id: 'bobcat', name: 'Bobcat', short: 'Bobcat', hq: '미국 (모기업: 한국 두산밥캣)', aliases: ['bobcat', '밥캣'] },
    { id: 'kubota', name: 'Kubota', short: 'Kubota', hq: '일본', aliases: ['kubota', '구보다'] },
    { id: 'yanmar', name: 'Yanmar', short: 'Yanmar', hq: '일본', aliases: ['yanmar', '얀마'] },
    { id: 'kobelco', name: 'Kobelco', short: 'Kobelco', hq: '일본', aliases: ['kobelco', '코벨코'] },
    { id: 'mecalac', name: 'Mecalac', short: 'Mecalac', hq: '프랑스', aliases: ['mecalac', '메카락', '메칼락'] }
  ];

  /* ── 부록 C. Product / Tonnage Taxonomy ──
     min·max 는 운전중량(톤). 구간은 [min, max) — 문서의 「A톤 ~ B톤 미만」 표기를 따릅니다.
     Wheel Loader 는 「6톤 ~ 12톤」처럼 상한 표기가 모호해 같은 [min, max) 규칙을 적용했습니다(가정). */
  var PRODUCTS = [
    {
      code: 'EXC', name: 'Excavator',
      classes: [
        { code: 'MIC', name: 'Micro Excavator', range: '1톤 미만 (~0.8t)', min: 0, max: 1, note: '008, 010급' },
        { code: 'MNI', name: 'Mini Excavator', range: '1톤 ~ 6톤 미만', min: 1, max: 6, note: '017, 020, 035급' },
        { code: 'MID', name: 'Midi / Compact Excavator', range: '6톤 ~ 10톤 미만', min: 6, max: 10, note: '03(공삼)급' },
        { code: 'MED', name: 'Medium Excavator', range: '10톤 ~ 35톤 미만', min: 10, max: 35, note: '06, 08, 10 등' },
        { code: 'LRG', name: 'Large / Heavy Excavator', range: '35톤 ~ 90톤 미만', min: 35, max: 90, note: '40~50t급 등' },
        { code: 'MNG', name: 'Mining / Ultra-Large Excavator', range: '90톤 이상 (~800t+)', min: 90, max: Infinity, note: '마이닝 굴착기' }
      ]
    },
    {
      code: 'WHL', name: 'Wheel Loader',
      classes: [
        { code: 'CMP', name: 'Compact / Mini Wheel Loader', range: '6톤 미만', min: 0, max: 6, note: '버킷 0.5 ~ 1.2 m³' },
        { code: 'SML', name: 'Small Wheel Loader', range: '6톤 ~ 12톤', min: 6, max: 12, note: '버킷 1.3 ~ 2.2 m³' },
        { code: 'MED', name: 'Medium Wheel Loader', range: '12톤 ~ 25톤', min: 12, max: 25, note: '버킷 2.5 ~ 5.0 m³' },
        { code: 'LRG', name: 'Large Wheel Loader', range: '25톤 ~ 50톤', min: 25, max: 50, note: '버킷 5.0 ~ 9.0 m³' },
        { code: 'MNG', name: 'Mining Wheel Loader', range: '50톤 ~ 200톤 이상', min: 50, max: Infinity, note: '버킷 10.0 m³ 이상' }
      ]
    }
  ];

  /* 제출 기획서 3절 Benchmark Purpose. 코드 글자는 Scope ID 용(가정 — 기획서 10장 6번 확정 전) */
  var PURPOSES = [
    { code: 'X', name: 'Exterior', desc: '외장 조형·비례' },
    { code: 'C', name: 'Cabin', desc: '시야성·조작계·HMI' },
    { code: 'M', name: 'CMF', desc: 'Color / Material / Finish' },
    { code: 'T', name: 'Trend', desc: '연식·브랜드별 변화' },
    { code: 'V', name: 'Serviceability', desc: '정비 접근성' },
    { code: 'S', name: 'Safety', desc: '안전 표시·센서 보호' },
    { code: 'F', name: 'Full Benchmark', desc: '전 항목' }
  ];

  /* 18절 Image View Taxonomy 예시 5종 (+ 기타) */
  var VIEWS = ['Side', 'Front-Quarter', 'Rear', 'Cabin', 'CMF Detail', '기타'];

  var SOURCE_TYPES = ['OEM 공식', '공식 Press/Exhibition', '신뢰 미디어', '카탈로그 PDF', '사내 자료', '기타'];
  /* 12절 Source Reliability 순서 */
  var RELIABILITY = ['1 공식 OEM', '2 공식 Press/Exhibition', '3 신뢰 미디어', '4 기타'];
  var REVIEW_STATUS = ['미검토', '검토중', '확정', '반려'];
  var OBS_ORIGIN = ['디자이너 입력', 'AI 관찰'];

  /* ── 6절 Schema 10개 블록 ──
     kind: fact = 제원(원문 대조 대상), obs = 관찰(디자이너 또는 AI), meta = 식별·출처·근거 */
  var BLOCKS = [
    { id: 'identity', name: 'Identity', kind: 'meta' },
    { id: 'source', name: 'Source / Provenance', kind: 'meta' },
    { id: 'media', name: 'Media', kind: 'meta' },
    { id: 'design', name: 'Design', kind: 'obs' },
    { id: 'cabin', name: 'Cabin / HMI', kind: 'obs' },
    { id: 'cmf', name: 'CMF', kind: 'obs' },
    { id: 'engineering', name: 'Engineering', kind: 'fact' },
    { id: 'service', name: 'Service / Safety', kind: 'obs' },
    { id: 'evidence', name: 'AI / Evidence', kind: 'meta' },
    { id: 'scope', name: 'Benchmark Scope', kind: 'meta' }
  ];

  function F(key, label, block, type, extra) {
    var f = { key: key, label: label, block: block, type: type || 'text' };
    if (extra) Object.keys(extra).forEach(function (k) { f[k] = extra[k]; });
    return f;
  }
  var FIELDS = [
    F('equipment_type', '장비군(category)', 'identity', 'select', { options: ['Excavator', 'Wheel Loader'], syn: ['category', '장비군', '장비', '제품군', 'product type', 'product'] }),
    F('brand', '브랜드', 'identity', 'text', { syn: ['brand', '브랜드', '제조사', 'maker', 'oem', '경쟁사'] }),
    F('model_name', '모델명', 'identity', 'text', { syn: ['model', 'model_name', '모델', '모델명', '기종'] }),
    F('product_class', 'Product Class', 'identity', 'text', { syn: ['product_class', '클래스', 'class'] }),
    F('tonnage_class', 'Tonnage Class', 'identity', 'text', { syn: ['tonnage', 'tonnage_class', '톤급', '톤수', '톤수구분', '중량급'] }),
    F('operating_weight_range', '운전중량 범위(현장 호칭)', 'identity', 'text', { syn: ['operating_weight_range', '중량범위', '현장호칭', '호칭'] }),
    F('generation', 'Generation', 'identity', 'text', { syn: ['generation', '세대', '시리즈'] }),
    F('release_year', '출시 연도', 'identity', 'number', { syn: ['release_year', '출시연도', '연식', '출시년도', 'year', '연도'] }),

    F('source_url', 'Source URL', 'source', 'text', { syn: ['source_url', 'url', '출처', '출처url', '링크', 'source'] }),
    F('source_type', 'Source Type', 'source', 'select', { options: SOURCE_TYPES, syn: ['source_type', '출처유형', '자료유형'] }),
    F('publisher', 'Publisher', 'source', 'text', { syn: ['publisher', '발행처', '매체'] }),
    F('collected_at', '수집일', 'source', 'date', { syn: ['collected_at', '수집일', '수집일자', '조사일', 'date'] }),
    F('original_file', '원본 파일', 'source', 'text', { syn: ['original_file', '원본파일', '파일명', '문서'] }),
    F('source_reliability', 'Source Reliability', 'source', 'select', { options: RELIABILITY, syn: ['source_reliability', '신뢰도', '출처신뢰도'] }),

    F('form_language', 'Form Language', 'design', 'text', { syn: ['form_language', '조형언어', '디자인언어'] }),
    F('character_line', 'Character Line', 'design', 'text', { syn: ['character_line', '캐릭터라인'] }),
    F('volume_balance', 'Volume Balance', 'design', 'text', { syn: ['volume_balance', '볼륨', '볼륨밸런스'] }),
    F('surface_edge', 'Surface / Edge', 'design', 'text', { syn: ['surface_edge', '면처리', '엣지'] }),
    F('proportion', 'Proportion', 'design', 'text', { syn: ['proportion', '비례'] }),
    F('design_tags', 'Design Tags', 'design', 'tags', { syn: ['design_tags', 'tags', '태그', '디자인태그'] }),
    F('score_exterior', 'Exterior 평가(1~5)', 'design', 'score', { syn: ['score_exterior', 'exterior평가', '외관평가', '외관점수'] }),

    F('glass_area', 'Glass Area', 'cabin', 'text', { syn: ['glass_area', '유리면적', '글라스'] }),
    F('pillar_design', 'Pillar Design', 'cabin', 'text', { syn: ['pillar_design', '필러'] }),
    F('visibility', 'Visibility', 'cabin', 'text', { syn: ['visibility', '시야', '시야성'] }),
    F('console_layout', 'Console Layout', 'cabin', 'text', { syn: ['console_layout', '콘솔'] }),
    F('joystick', 'Joystick', 'cabin', 'text', { syn: ['joystick', '조이스틱'] }),
    F('seat', 'Seat', 'cabin', 'text', { syn: ['seat', '시트'] }),
    F('display', 'Display', 'cabin', 'text', { syn: ['display', '디스플레이', '모니터'] }),
    F('hvac', 'HVAC', 'cabin', 'text', { syn: ['hvac', '공조'] }),
    F('score_cabin', 'Cabin/HMI 평가(1~5)', 'cabin', 'score', { syn: ['score_cabin', 'cabin평가', '캐빈평가', '캐빈점수'] }),

    F('main_color', 'Main Color', 'cmf', 'text', { syn: ['main_color', '메인컬러', '주색상', '주조색'] }),
    F('accent_color', 'Accent Color', 'cmf', 'text', { syn: ['accent_color', '포인트컬러', '보조색', '강조색'] }),
    F('underbody_color', 'Underbody Color', 'cmf', 'text', { syn: ['underbody_color', '하부색', '하부컬러'] }),
    F('material', 'Material', 'cmf', 'text', { syn: ['material', '소재', '재질'] }),
    F('finish', 'Finish', 'cmf', 'text', { syn: ['finish', '마감'] }),
    F('gloss', 'Gloss', 'cmf', 'text', { syn: ['gloss', '광택'] }),
    F('texture', 'Texture', 'cmf', 'text', { syn: ['texture', '질감', '텍스처'] }),
    F('score_cmf', 'CMF 평가(1~5)', 'cmf', 'score', { syn: ['score_cmf', 'cmf평가', 'cmf점수'] }),

    F('operating_weight', '운전중량', 'engineering', 'number', { unit: 'kg', qty: 'weight', syn: ['operating_weight', '운전중량', '중량', '장비중량', 'weight'] }),
    F('engine_power', '엔진 출력', 'engineering', 'number', { unit: 'kW', qty: 'power', syn: ['engine_power', '엔진출력', '출력', '정격출력', 'power'] }),
    F('dimensions', '치수(L×W×H)', 'engineering', 'text', { syn: ['dimensions', '치수', '제원치수', '크기'] }),
    F('bucket_capacity', '버킷 용량', 'engineering', 'number', { unit: 'm³', qty: 'volume', syn: ['bucket_capacity', '버킷용량', '버킷', 'bucket'] }),
    F('powertrain', 'Powertrain', 'engineering', 'text', { syn: ['powertrain', '파워트레인', '동력계', '구동방식'] }),

    F('maintenance_access', 'Maintenance Access', 'service', 'text', { syn: ['maintenance_access', '정비접근성', '점검구'] }),
    F('door_parting', 'Door Parting', 'service', 'text', { syn: ['door_parting', '도어파팅'] }),
    F('hinge', 'Hinge', 'service', 'text', { syn: ['hinge', '힌지'] }),
    F('sensor_camera', 'Sensor / Camera', 'service', 'text', { syn: ['sensor_camera', '센서', '카메라'] }),
    F('safety_label', 'Safety Label', 'service', 'text', { syn: ['safety_label', '안전라벨', '안전표시'] }),
    F('access', 'Access (Step·Handrail)', 'service', 'text', { syn: ['access', '승하차', '스텝'] }),
    F('score_service', 'Service/Safety 평가(1~5)', 'service', 'score', { syn: ['score_service', 'service평가', '정비평가', '정비점수'] }),

    F('obs_origin', '관찰 입력 출처', 'evidence', 'select', { options: OBS_ORIGIN, syn: ['obs_origin', '관찰출처'] }),
    F('confidence', 'Confidence (0~1)', 'evidence', 'number', { syn: ['confidence', '신뢰점수'] }),
    F('extracted_text', 'Extracted Text', 'evidence', 'text', { syn: ['extracted_text', '추출텍스트', '원문발췌'] }),
    F('evidence_image', 'Evidence Image', 'evidence', 'text', { syn: ['evidence_image', '근거이미지'] }),
    F('human_review_status', '검증 상태', 'evidence', 'select', { options: REVIEW_STATUS, syn: ['human_review_status', '검증상태', '검토상태'] }),
    F('reviewer_note', '검토 메모', 'evidence', 'text', { syn: ['reviewer_note', '검토메모', '비고', 'note'] }),
    F('entered_by', '입력자', 'evidence', 'text', { syn: ['entered_by', '입력자', '작성자'] }),
    F('prompt_version', 'Prompt Version', 'evidence', 'text', { syn: ['prompt_version'] }),
    F('embedding_id', 'Embedding ID (2단계)', 'evidence', 'text', { syn: ['embedding_id'] }),

    F('benchmark_scope_id', 'Benchmark Scope ID', 'scope', 'text', { syn: ['benchmark_scope_id', 'scope_id', '스코프'] })
  ];
  /* 엑셀 가져오기 전용 가상 필드 — 이미지 경로와 View 를 열로 받습니다 */
  var IMPORT_EXTRA = [
    { key: '_image_path', label: '이미지 경로(여러 개는 ; 로)', syn: ['image_path', 'image', '이미지', '이미지경로', '사진', '파일경로', 'media'] },
    { key: '_image_view', label: '이미지 View', syn: ['view_type', 'view', '뷰', '촬영각', '각도'] }
  ];

  /* 12절 Data Completeness 필수 필드 (brand/model/category/collected_at/source URL/image path) */
  var REQUIRED = [
    { key: 'brand', label: '브랜드' },
    { key: 'model_name', label: '모델명' },
    { key: 'equipment_type', label: '장비군(category)' },
    { key: 'collected_at', label: '수집일' },
    { key: 'source_url', label: 'Source URL' },
    { key: 'media', label: '이미지(경로 또는 파일)' }
  ];

  /* 평가 점수 4축 — 아래 「2026-09-29 추가」 참고 */
  var SCORE_AXES = [
    { key: 'score_exterior', axis: 'Exterior', name: 'Exterior 조형' },
    { key: 'score_cabin', axis: 'Cabin', name: 'Cabin / HMI' },
    { key: 'score_cmf', axis: 'CMF', name: 'CMF' },
    { key: 'score_service', axis: 'Service', name: 'Service / Safety' }
  ];

  function fieldByKey(k) { return FIELDS.filter(function (f) { return f.key === k; })[0] || null; }
  function fieldsOf(block) { return FIELDS.filter(function (f) { return f.block === block; }); }

  /* ── 기본 도구 ── */
  function str(v) { return v == null ? '' : String(v).trim(); }
  function norm(v) { return str(v).toLowerCase().replace(/[\s_\-()（）.·/]/g, ''); }
  function pad(n, w) { var s = String(n); while (s.length < w) s = '0' + s; return s; }

  function productByName(name) {
    var n = norm(name);
    if (!n) return null;
    return PRODUCTS.filter(function (p) {
      return norm(p.name) === n || norm(p.code) === n ||
        (p.code === 'EXC' && /굴착|excav|굴삭/.test(n)) || (p.code === 'WHL' && /휠로더|wheelloader|로더/.test(n));
    })[0] || null;
  }
  function tonnageClass(productName, code) {
    var p = productByName(productName);
    if (!p) return null;
    return p.classes.filter(function (c) { return c.code === code; })[0] || null;
  }
  /* 운전중량(kg) → 부록 C 분류 코드. 모르면 '' */
  function suggestTonnage(productName, weightKg) {
    var p = productByName(productName);
    var w = Number(weightKg);
    if (!p || !isFinite(w) || w <= 0) return '';
    var t = w / 1000;
    var c = p.classes.filter(function (x) { return t >= x.min && t < x.max; })[0];
    return c ? c.code : '';
  }
  /* 엑셀의 톤급 글자(「Medium」「중형」「MED」「Medium Excavator」)를 코드로 */
  function tonnageFromText(productName, text) {
    var p = productByName(productName);
    var n = norm(text);
    if (!p || !n) return '';
    var hit = p.classes.filter(function (c) { return norm(c.code) === n || norm(c.name) === n; })[0];
    if (hit) return hit.code;
    var words = { MIC: ['micro', '마이크로'], MNI: ['mini', '미니'], MID: ['midi', 'compact', '미디', '컴팩트'], MED: ['medium', '중형'], LRG: ['large', 'heavy', '대형'], MNG: ['mining', 'ultralarge', '마이닝', '초대형'], CMP: ['compact', 'mini', '컴팩트', '미니'], SML: ['small', '소형'] };
    hit = p.classes.filter(function (c) {
      return (words[c.code] || []).some(function (w) { return n.indexOf(w) === 0; });
    })[0];
    return hit ? hit.code : '';
  }

  function normalizeBrand(v) {
    var s = str(v);
    if (!s) return '';
    var n = s.toLowerCase().trim();
    var b = BRANDS.filter(function (x) { return x.aliases.indexOf(n) >= 0 || x.name.toLowerCase() === n; })[0];
    return b ? b.name : s;
  }
  function brandInUniverse(name) { return BRANDS.some(function (b) { return b.name === name; }); }
  function brandShort(name) { var b = BRANDS.filter(function (x) { return x.name === name; })[0]; return b ? b.short : name; }

  /* 수치 + 단위 → 기준 단위(kg / kW / m³). defaultUnit 은 단위가 안 적힌 값에 적용 */
  var UNIT = {
    weight: { base: 'kg', units: { kg: 1, t: 1000, ton: 1000, tons: 1000, '톤': 1000, lb: 0.45359237, lbs: 0.45359237 } },
    power: { base: 'kW', units: { kw: 1, hp: 0.745699872, ps: 0.73549875, '마력': 0.73549875 } },
    volume: { base: 'm³', units: { 'm3': 1, 'm³': 1, 'cum': 1, 'l': 0.001, 'yd3': 0.764554858 } }
  };
  function parseQuantity(v, qty, defaultUnit) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? scale(v, qty, defaultUnit) : null;
    var s = String(v).replace(/,/g, '').trim();
    var m = s.match(/^(-?\d+(?:\.\d+)?)\s*([a-zA-Z³0-9가-힣]*)/);
    if (!m) return null;
    var num = Number(m[1]);
    var u = m[2] ? m[2].toLowerCase() : '';
    if (!qty) return num;
    return scale(num, qty, u || defaultUnit);
  }
  function scale(num, qty, unit) {
    if (!qty) return num;
    var table = UNIT[qty];
    var u = (unit || table.base).toLowerCase();
    if (u === 'kw' && qty !== 'power') u = table.base.toLowerCase();
    var f = table.units[u];
    if (f == null) f = table.units[table.base.toLowerCase()] || 1;
    return Math.round(num * f * 1000) / 1000;
  }

  /* 날짜 → YYYY-MM-DD. 엑셀 일련번호·Date·「2026.9.3」 모두 받음 */
  function toDateStr(v) {
    if (v == null || v === '') return '';
    if (v instanceof Date && !isNaN(v)) return v.getFullYear() + '-' + pad(v.getMonth() + 1, 2) + '-' + pad(v.getDate(), 2);
    if (typeof v === 'number' && v > 20000 && v < 80000) {
      var d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
      return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1, 2) + '-' + pad(d.getUTCDate(), 2);
    }
    var m = String(v).trim().match(/^(\d{4})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})/);
    if (m) return m[1] + '-' + pad(m[2], 2) + '-' + pad(m[3], 2);
    return '';
  }
  function splitTags(v) {
    if (Array.isArray(v)) return v.map(str).filter(Boolean);
    return str(v).split(/[,;、\n#]/).map(str).filter(function (x, i, a) { return x && a.indexOf(x) === i; });
  }

  /* ── Scope ── */
  function purposeCode(purposes) {
    var list = purposes || [];
    if (list.indexOf('Full Benchmark') >= 0) return 'F';
    return PURPOSES.filter(function (p) { return list.indexOf(p.name) >= 0; }).map(function (p) { return p.code; }).join('');
  }
  function validateScope(s) {
    var errs = [];
    var p = productByName(s && s.equipment_type);
    if (!p) errs.push('equipment_type');
    else if (!tonnageClass(p.name, s.tonnage_class)) errs.push('tonnage_class');
    if (!s || !s.brands || !s.brands.length) errs.push('brands');
    if (!s || !s.purposes || !s.purposes.length) errs.push('purposes');
    return errs;
  }
  /* Scope ID 기본형: 프로토타입 EXC-MED-006-TT 형식을 따름(가정)
     = 장비군 코드 - 톤급 코드 - 선택 브랜드 수(3자리) - 목적 코드 */
  function baseScopeId(s) {
    var p = productByName(s.equipment_type);
    return [p.code, s.tonnage_class, pad(s.brands.length, 3), purposeCode(s.purposes)].join('-');
  }
  function sameSet(a, b) {
    if (a.length !== b.length) return false;
    var x = a.slice().sort(), y = b.slice().sort();
    return x.every(function (v, i) { return v === y[i]; });
  }
  /* 같은 선택이면 기존 Scope 재사용, 기본 ID 는 같은데 브랜드·목적 구성이 다르면 -2, -3 … 을 붙임 */
  function assignScope(scopes, draft, now) {
    var errs = validateScope(draft);
    if (errs.length) return { ok: false, errors: errs };
    var base = baseScopeId(draft);
    var same = scopes.filter(function (s) {
      return s.equipment_type === productByName(draft.equipment_type).name && s.tonnage_class === draft.tonnage_class &&
        sameSet(s.brands, draft.brands) && sameSet(s.purposes, draft.purposes);
    })[0];
    if (same) return { ok: true, scope: same, reused: true };
    var id = base, n = 1;
    var taken = scopes.map(function (s) { return s.scope_id; });
    while (taken.indexOf(id) >= 0) { n++; id = base + '-' + n; }
    return {
      ok: true, reused: false,
      scope: {
        scope_id: id,
        equipment_type: productByName(draft.equipment_type).name,
        tonnage_class: draft.tonnage_class,
        brands: draft.brands.slice(),
        purposes: draft.purposes.slice(),
        scope_version: 1,
        schema_version: SCHEMA_VERSION,
        created_at: toDateStr(now || new Date())
      }
    };
  }
  function inScope(model, scope) {
    if (!scope) return true;
    return model.equipment_type === scope.equipment_type && model.tonnage_class === scope.tonnage_class &&
      scope.brands.indexOf(model.brand) >= 0;
  }

  /* ── 모델 레코드 ── */
  function emptyModel() {
    var m = { id: '', media: [] };
    FIELDS.forEach(function (f) { m[f.key] = f.type === 'tags' ? [] : ''; });
    m.human_review_status = '미검토';
    m.obs_origin = '디자이너 입력';
    m.schema_version = SCHEMA_VERSION;
    return m;
  }
  function modelKey(m) { return norm(m.brand) + '|' + norm(m.model_name); }
  function nextId(models) {
    var max = 0;
    models.forEach(function (m) { var n = Number(String(m.id).replace(/^M/, '')); if (n > max) max = n; });
    return 'M' + pad(max + 1, 4);
  }
  function hasImage(m) {
    return (m.media || []).some(function (x) { return str(x.path) || str(x.data); });
  }
  /* 12절 Data Completeness */
  function missingFields(m) {
    return REQUIRED.filter(function (r) {
      if (r.key === 'media') return !hasImage(m);
      return !str(m[r.key]);
    }).map(function (r) { return r.key; });
  }
  /* 톤급과 운전중량이 부록 C 기준으로 어긋나면 운전중량 기준 코드를 돌려줌(없으면 '') */
  function tonnageMismatch(m) {
    if (!m.tonnage_class || m.operating_weight === '' || m.operating_weight == null) return '';
    var s = suggestTonnage(m.equipment_type, m.operating_weight);
    return s && s !== m.tonnage_class ? s : '';
  }
  function completeness(m) {
    var miss = missingFields(m);
    return { missing: miss, total: REQUIRED.length, filled: REQUIRED.length - miss.length, ok: miss.length === 0 };
  }
  /* 저장 전 정리: 브랜드 정규화, 수치 변환, 톤급 추정(비었을 때만) */
  function cleanModel(input) {
    var m = emptyModel();
    Object.keys(input || {}).forEach(function (k) { m[k] = input[k]; });
    m.brand = normalizeBrand(m.brand);
    m.model_name = str(m.model_name);
    var p = productByName(m.equipment_type);
    m.equipment_type = p ? p.name : str(m.equipment_type);
    ['operating_weight', 'engine_power', 'bucket_capacity', 'release_year', 'confidence'].forEach(function (k) {
      var v = m[k];
      if (v === '' || v == null) { m[k] = ''; return; }
      var f = fieldByKey(k);
      var n = parseQuantity(v, f.qty, f.unit);
      m[k] = n == null ? '' : n;
    });
    if (m.confidence !== '' && (m.confidence < 0 || m.confidence > 1)) m.confidence = '';
    SCORE_AXES.forEach(function (a) { m[a.key] = cleanScore(m[a.key]); });
    if (m.tonnage_class && p) m.tonnage_class = tonnageFromText(p.name, m.tonnage_class) || m.tonnage_class;
    if (!m.tonnage_class && p && m.operating_weight !== '') m.tonnage_class = suggestTonnage(p.name, m.operating_weight);
    m.collected_at = toDateStr(m.collected_at) || str(m.collected_at);
    m.design_tags = splitTags(m.design_tags);
    m.media = (m.media || []).filter(function (x) { return str(x.path) || str(x.data); }).map(function (x) {
      return {
        id: x.id || '', view_type: VIEWS.indexOf(x.view_type) >= 0 ? x.view_type : '기타',
        path: str(x.path), data: x.data || '', media_type: str(x.media_type), resolution: str(x.resolution),
        crop_region: str(x.crop_region), caption: str(x.caption)
      };
    });
    m.media.forEach(function (x, i) { if (!x.id) x.id = 'img' + (i + 1); });
    m.schema_version = SCHEMA_VERSION;
    return m;
  }
  function validateModel(m, models) {
    var errs = [];
    if (!str(m.brand)) errs.push({ field: 'brand', code: 'required' });
    if (!str(m.model_name)) errs.push({ field: 'model_name', code: 'required' });
    if (!productByName(m.equipment_type)) errs.push({ field: 'equipment_type', code: 'required' });
    if (m.collected_at && !toDateStr(m.collected_at)) errs.push({ field: 'collected_at', code: 'date' });
    if (m.source_url && !/^(https?:\/\/|file:|\\\\|[a-zA-Z]:\\|\/)/.test(m.source_url)) errs.push({ field: 'source_url', code: 'url' });
    var dup = (models || []).filter(function (x) { return x.id !== m.id && modelKey(x) === modelKey(m); })[0];
    if (dup && str(m.brand) && str(m.model_name)) errs.push({ field: 'model_name', code: 'duplicate', id: dup.id });
    return errs;
  }

  /* ── 필터 (Card Gallery) ── */
  function filterModels(models, f) {
    f = f || {};
    var q = norm(f.q);
    return models.filter(function (m) {
      if (f.scope && !inScope(m, f.scope)) return false;
      if (f.equipment_type && m.equipment_type !== f.equipment_type) return false;
      if (f.tonnage_class && m.tonnage_class !== f.tonnage_class) return false;
      if (f.brand && m.brand !== f.brand) return false;
      if (f.year_from && !(Number(m.release_year) >= Number(f.year_from))) return false;
      if (f.year_to && !(Number(m.release_year) <= Number(f.year_to))) return false;
      if (f.view && !(m.media || []).some(function (x) { return x.view_type === f.view; })) return false;
      if (f.incomplete && completeness(m).ok) return false;
      if (f.review && m.human_review_status !== f.review) return false;
      if (q) {
        var hay = norm([m.brand, m.model_name, m.generation, m.form_language, m.main_color, m.accent_color, (m.design_tags || []).join(' ')].join(' '));
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    }).sort(function (a, b) {
      return a.brand === b.brand ? String(a.model_name).localeCompare(String(b.model_name)) : BRANDS.map(function (x) { return x.name; }).indexOf(a.brand) - BRANDS.map(function (x) { return x.name; }).indexOf(b.brand);
    });
  }

  /* ── Status Dashboard ── */
  function statusMatrix(models, equipmentType, brands) {
    var p = productByName(equipmentType);
    if (!p) return null;
    var list = models.filter(function (m) { return m.equipment_type === p.name; });
    var brandList = brands && brands.length ? brands.slice() : BRANDS.map(function (b) { return b.name; });
    if (brands && brands.length) list = list.filter(function (m) { return brands.indexOf(m.brand) >= 0; });
    list.forEach(function (m) { if (brandList.indexOf(m.brand) < 0 && !(brands && brands.length)) brandList.push(m.brand); });
    var classes = p.classes.map(function (c) { return c.code; }).concat(['']);
    var rows = brandList.map(function (b) {
      var mine = list.filter(function (m) { return m.brand === b; });
      var cells = {};
      classes.forEach(function (c) {
        var ms = mine.filter(function (m) { return (m.tonnage_class || '') === c || (c === '' && classes.indexOf(m.tonnage_class) < 0); });
        cells[c] = { models: ms.length, images: ms.reduce(function (n, m) { return n + (m.media || []).length; }, 0) };
      });
      var views = {};
      VIEWS.forEach(function (v) { views[v] = mine.reduce(function (n, m) { return n + (m.media || []).filter(function (x) { return x.view_type === v; }).length; }, 0); });
      var latest = mine.map(function (m) { return toDateStr(m.collected_at); }).filter(Boolean).sort().pop() || '';
      return {
        brand: b, cells: cells, views: views, latest: latest,
        models: mine.length, images: mine.reduce(function (n, m) { return n + (m.media || []).length; }, 0),
        incomplete: mine.filter(function (m) { return !completeness(m).ok; }).length
      };
    });
    var totals = { models: list.length, images: list.reduce(function (n, m) { return n + (m.media || []).length; }, 0), incomplete: list.filter(function (m) { return !completeness(m).ok; }).length,
      latest: list.map(function (m) { return toDateStr(m.collected_at); }).filter(Boolean).sort().pop() || '' };
    return { product: p, classes: classes, rows: rows, totals: totals };
  }
  /* 필수 메타 누락 요약: 필드별 누락 건수 */
  function missingSummary(models) {
    var out = {};
    REQUIRED.forEach(function (r) { out[r.key] = 0; });
    models.forEach(function (m) { missingFields(m).forEach(function (k) { out[k]++; }); });
    return out;
  }

  /* ── Side-by-Side ── */
  var MAX_COMPARE = 4;
  function toggleCompare(list, id) {
    var i = list.indexOf(id);
    if (i >= 0) return { list: list.filter(function (x) { return x !== id; }), ok: true };
    if (list.length >= MAX_COMPARE) return { list: list.slice(), ok: false, reason: 'max' };
    return { list: list.concat([id]), ok: true };
  }
  function displayValue(m, f) {
    var v = m[f.key];
    if (f.type === 'tags') return (v || []).join(', ');
    if (v === '' || v == null) return '';
    if (f.key === 'tonnage_class') { var c = tonnageClass(m.equipment_type, v); return c ? c.name : String(v); }
    if (f.unit) return formatNum(v) + ' ' + f.unit;
    if (f.type === 'score') return v + ' / 5';
    return String(v);
  }
  function formatNum(n) {
    var x = Number(n);
    if (!isFinite(x)) return String(n);
    var parts = String(Math.round(x * 1000) / 1000).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  }
  /* 비교표 행: [구분, 항목, 값1..값n, 차이 여부] — 화면과 엑셀이 같은 행을 씁니다 */
  var COMPARE_BLOCKS = ['identity', 'engineering', 'design', 'cabin', 'cmf', 'service', 'source', 'evidence'];
  function compareRows(models, opts) {
    opts = opts || {};
    var rows = [];
    COMPARE_BLOCKS.forEach(function (bid) {
      var block = BLOCKS.filter(function (b) { return b.id === bid; })[0];
      var kindLabel = block.kind === 'fact' ? '제원(FACT)' : block.kind === 'obs' ? '관찰(OBSERVATION)' : '메타';
      fieldsOf(bid).forEach(function (f) {
        if (f.key === 'embedding_id' || f.key === 'prompt_version') return;
        var vals = models.map(function (m) { return displayValue(m, f); });
        if (opts.hideEmpty && vals.every(function (v) { return !v; })) return;
        var filled = vals.filter(Boolean);
        rows.push({
          block: block.name, kind: kindLabel, key: f.key, label: f.label, values: vals,
          differs: filled.length > 1 && filled.some(function (v) { return v !== filled[0]; })
        });
      });
    });
    rows.push({ block: 'Media', kind: '메타', key: '_views', label: '보유 View', values: models.map(function (m) {
      return VIEWS.filter(function (v) { return (m.media || []).some(function (x) { return x.view_type === v; }); }).join(', ');
    }), differs: false });
    rows.push({ block: 'QA', kind: '메타', key: '_missing', label: '필수 메타 누락', values: models.map(function (m) {
      var miss = missingFields(m);
      return miss.length ? miss.map(function (k) { return REQUIRED.filter(function (r) { return r.key === k; })[0].label; }).join(', ') : '없음';
    }), differs: false });
    return rows;
  }
  function compareSheet(models, scope, opts) {
    var rows = compareRows(models, opts);
    var aoa = [];
    aoa.push(['Benchmark 비교표']);
    aoa.push(['Scope ID', scope ? scope.scope_id : '(Scope 미지정)', 'schema_version', SCHEMA_VERSION]);
    aoa.push([]);
    aoa.push(['블록', '구분', '항목'].concat(models.map(function (m) { return brandShort(m.brand) + ' ' + m.model_name; })).concat(['차이']));
    rows.forEach(function (r) { aoa.push([r.block, r.kind, r.label].concat(r.values).concat([r.differs ? '차이 있음' : ''])); });
    return aoa;
  }

  /* ── 엑셀·CSV 가져오기 ── */
  function importTargets() {
    return FIELDS.filter(function (f) { return f.key !== 'embedding_id'; }).map(function (f) {
      return { key: f.key, label: f.label + (f.unit ? ' (' + f.unit + ')' : ''), syn: f.syn || [] };
    }).concat(IMPORT_EXTRA);
  }
  function guessMapping(headers) {
    var targets = importTargets();
    var used = {};
    var mapping = {};
    headers.forEach(function (h, i) {
      var n = norm(h).replace(/(kg|kw|m3|m³|톤|t)$/i, '');
      var nFull = norm(h);
      var t = targets.filter(function (x) { return !used[x.key] && (norm(x.key) === nFull || norm(x.label) === nFull); })[0] ||
        targets.filter(function (x) { return !used[x.key] && x.syn.some(function (s) { return norm(s) === n || norm(s) === nFull; }); })[0] ||
        targets.filter(function (x) { return !used[x.key] && x.syn.some(function (s) { return norm(s).length >= 2 && n.indexOf(norm(s)) === 0; }); })[0];
      if (t) { mapping[i] = t.key; used[t.key] = true; }
      else mapping[i] = '';
    });
    return mapping;
  }
  /* 머리글에 적힌 단위를 읽어 둡니다 (예: 「운전중량(t)」) */
  function headerUnit(h) {
    var m = String(h || '').match(/[(\[]\s*([a-zA-Z³0-9가-힣]+)\s*[)\]]\s*$/);
    return m ? m[1].toLowerCase() : '';
  }
  /* rows: 첫 행 머리글인 2차원 배열. mapping: {열번호: 필드키}. units: {weight,power,volume} 기본 단위 */
  function rowsToModels(rows, mapping, units) {
    units = units || {};
    var headers = rows[0] || [];
    var out = [], skipped = [];
    rows.slice(1).forEach(function (r, ri) {
      if (!r || r.every(function (c) { return c === '' || c == null; })) return;
      var m = {};
      var paths = [], view = '';
      Object.keys(mapping).forEach(function (col) {
        var key = mapping[col];
        if (!key) return;
        var v = r[col];
        if (key === '_image_path') { paths = paths.concat(str(v).split(/[;\n]/).map(str).filter(Boolean)); return; }
        if (key === '_image_view') { view = str(v); return; }
        var f = fieldByKey(key);
        if (f && f.qty) {
          var hu = headerUnit(headers[col]);
          var n = parseQuantity(v, f.qty, hu || units[f.qty] || f.unit);
          m[key] = n == null ? '' : n;
        } else if (key === 'collected_at') m[key] = toDateStr(v) || str(v);
        else m[key] = v == null ? '' : v;
      });
      /* 브라우저 보관 이미지 표시 「(…)」는 경로가 아니므로 버림. View 가 ; 로 여럿이면 순서대로 짝지음 */
      var views = view.split(';').map(str);
      m.media = paths.map(function (p, i) { return { path: p, view_type: matchView(views[i] || views[0]) }; })
        .filter(function (x) { return x.path.charAt(0) !== '('; });
      var clean = cleanModel(m);
      if (!clean.brand || !clean.model_name) { skipped.push({ row: ri + 2, reason: '브랜드·모델명 없음' }); return; }
      out.push(clean);
    });
    return { models: out, skipped: skipped };
  }
  function matchView(v) {
    var n = norm(v);
    if (!n) return '기타';
    var hit = VIEWS.filter(function (x) { return norm(x) === n; })[0];
    if (hit) return hit;
    if (/front|전면|3\/4|quarter|사선/.test(String(v).toLowerCase())) return 'Front-Quarter';
    if (/side|측면/.test(String(v).toLowerCase())) return 'Side';
    if (/rear|후면|back/.test(String(v).toLowerCase())) return 'Rear';
    if (/cab|실내|운전석|interior/.test(String(v).toLowerCase())) return 'Cabin';
    if (/cmf|color|컬러|색|소재|detail/.test(String(v).toLowerCase())) return 'CMF Detail';
    return '기타';
  }
  /* 가져온 모델을 합침: 같은 브랜드+모델명이면 빈 칸만 채우지 않고 가져온 값(비어 있지 않은 것)으로 갱신,
     이미지는 경로가 겹치지 않는 것만 추가 */
  function mergeModels(existing, incoming) {
    var list = existing.map(function (m) { return JSON.parse(JSON.stringify(m)); });
    var added = 0, updated = 0;
    incoming.forEach(function (inc) {
      var hit = list.filter(function (m) { return modelKey(m) === modelKey(inc); })[0];
      if (!hit) {
        var n = JSON.parse(JSON.stringify(inc));
        n.id = nextId(list);
        list.push(n); added++; return;
      }
      FIELDS.forEach(function (f) {
        var v = inc[f.key];
        var empty = v === '' || v == null || (Array.isArray(v) && !v.length);
        if (!empty && f.key !== 'human_review_status' && f.key !== 'obs_origin') hit[f.key] = v;
      });
      (inc.media || []).forEach(function (x) {
        var dup = hit.media.some(function (y) { return (x.path && y.path === x.path) || (x.data && y.data === x.data); });
        if (!dup) { x.id = 'img' + (hit.media.length + 1); hit.media.push(x); }
      });
      updated++;
    });
    return { models: list, added: added, updated: updated };
  }

  /* ── 내보내기 ── */
  function exportHeaders() {
    return FIELDS.map(function (f) { return f.key; }).concat(['image_path', 'image_view', 'schema_version', 'id']);
  }
  /* 모델 1건 = 행 1개. 이미지가 여럿이면 경로를 ; 로 잇고 View 는 첫 이미지 기준(행 단위 한계 — 전체 보존은 JSON 백업) */
  function modelsToSheet(models) {
    var head = exportHeaders();
    var rows = [head];
    models.forEach(function (m) {
      rows.push(head.map(function (k) {
        if (k === 'image_path') return (m.media || []).map(function (x) { return x.path || (x.data ? '(브라우저 보관 이미지)' : ''); }).join('; ');
        if (k === 'image_view') return (m.media || []).map(function (x) { return x.view_type; }).join('; ');
        var v = m[k];
        if (Array.isArray(v)) return v.join(', ');
        return v == null ? '' : v;
      }));
    });
    return rows;
  }
  function toCsv(aoa) {
    return '﻿' + aoa.map(function (r) {
      return r.map(function (c) {
        var s = c == null ? '' : String(c);
        return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',');
    }).join('\r\n');
  }
  function parseCsv(text) {
    var s = String(text).replace(/^﻿/, '');
    var rows = [], row = [], cell = '', q = false;
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (q) {
        if (ch === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && s[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  /* ── DB (브라우저 저장소 한 덩어리) ── */
  function emptyDb() {
    return { models: [], scopes: [], activeScope: '', compare: [], settings: { imageMaxPx: 800, imageQuality: 0.8 },
      feedback: [], ops: defaultOps(), insightNote: { text: '', origin: '', saved_at: '' }, lastAuthor: '' };
  }
  function restoreDb(p) {
    var db = emptyDb();
    if (!p || typeof p !== 'object') return db;
    if (Array.isArray(p.models)) db.models = p.models.map(function (m) { var c = cleanModel(m); c.id = m.id || ''; return c; });
    db.models.forEach(function (m) { if (!m.id) m.id = nextId(db.models); });
    if (Array.isArray(p.scopes)) db.scopes = p.scopes.filter(function (s) { return s && s.scope_id; });
    if (typeof p.activeScope === 'string') db.activeScope = p.activeScope;
    if (Array.isArray(p.compare)) db.compare = p.compare.filter(function (id) { return db.models.some(function (m) { return m.id === id; }); }).slice(0, MAX_COMPARE);
    if (p.settings) {
      var px = Number(p.settings.imageMaxPx), qu = Number(p.settings.imageQuality);
      if (px >= 200 && px <= 4000) db.settings.imageMaxPx = px;
      if (qu > 0.1 && qu <= 1) db.settings.imageQuality = qu;
    }
    db.feedback = restoreFeedback(p.feedback);
    db.ops = restoreOps(p.ops);
    if (p.insightNote && typeof p.insightNote === 'object') db.insightNote = { text: str(p.insightNote.text), origin: str(p.insightNote.origin), saved_at: str(p.insightNote.saved_at) };
    if (typeof p.lastAuthor === 'string') db.lastAuthor = p.lastAuthor;
    if (p._sample) db._sample = true;
    return db;
  }
  function activeScope(db) { return db.scopes.filter(function (s) { return s.scope_id === db.activeScope; })[0] || null; }
  /* 선택 Scope 에서 브랜드별 데이터 가용성(3절: 비교 어려운 브랜드도 선택은 허용하되 상태 표시) */
  function brandAvailability(models, equipmentType, tonnage) {
    var p = productByName(equipmentType);
    var out = {};
    BRANDS.forEach(function (b) {
      out[b.name] = models.filter(function (m) { return m.brand === b.name && (!p || m.equipment_type === p.name) && (!tonnage || m.tonnage_class === tonnage); }).length;
    });
    return out;
  }

  /* ══════════════════════════════════════════════════════════════════
     2026-09-29 추가 — 수강생 Proto Web 의 End-to-End 흐름 중
     08 Insight · 10 Report & Decision · 11 Designer Validation · 13 Scheduled Update 를
     이 도구의 메뉴(07 Insight · 08 Report · 09 전문가 피드백 · 10 운영 루프)로 옮겼습니다.
     여기 있는 함수는 화면과 무관한 계산만 합니다. 기준: 기획서 v0.2 「2026-09-29 수강생 추가 요청」 절
     ══════════════════════════════════════════════════════════════════ */

  /* ── 평가 점수 4축 (디자이너 평가 1~5, OBSERVATION) ──
     제출 기획서 5절 4대 분석축(Exterior·Cabin·CMF·Engineering) 중 Engineering 은 제원(FACT)으로 비교하므로
     점수 축에서 빼고, 보조축 Serviceability/Safety 를 넣었습니다(가정 — 기획서 11장 「정한 것과 남은 확인 사항」 1번). */
  function cleanScore(v) {
    if (v === '' || v == null) return '';
    var n = Number(String(v).replace(/[^\d.\-]/g, ''));
    if (!isFinite(n) || n < 1 || n > 5) return '';
    return Math.round(n);
  }
  function scoreOf(m, key) {
    var v = m[key];
    return typeof v === 'number' && v >= 1 && v <= 5 ? v : null;
  }
  function round1(n) { return n == null ? null : Math.round(n * 10) / 10; }
  function round2(n) { return n == null ? null : Math.round(n * 100) / 100; }
  function mean(list) {
    var xs = list.filter(function (x) { return typeof x === 'number' && isFinite(x); });
    return xs.length ? xs.reduce(function (a, b) { return a + b; }, 0) / xs.length : null;
  }
  function brandOrder(names) {
    var order = BRANDS.map(function (b) { return b.name; });
    return names.slice().sort(function (a, b) {
      var ia = order.indexOf(a), ib = order.indexOf(b);
      if (ia < 0) ia = 999; if (ib < 0) ib = 999;
      return ia === ib ? String(a).localeCompare(String(b)) : ia - ib;
    });
  }
  /* 출력 대비 중량 kW/t — 둘 다 있을 때만 */
  function powerPerTon(m) {
    var w = Number(m.operating_weight), p = Number(m.engine_power);
    if (m.operating_weight === '' || m.engine_power === '' || !(w > 0) || !(p > 0)) return null;
    return p / (w / 1000);
  }
  function tagCounts(models) {
    var map = {};
    models.forEach(function (m) {
      (m.design_tags || []).forEach(function (t) { var k = str(t); if (k) map[k] = (map[k] || 0) + 1; });
    });
    return Object.keys(map).map(function (k) { return { tag: k, count: map[k] }; })
      .sort(function (a, b) { return b.count - a.count || a.tag.localeCompare(b.tag); });
  }

  /* 브랜드별 요약 — 모델 수·평가 평균·제원 범위·자주 쓰인 태그·최근 수집일 */
  function brandSummary(models) {
    var names = models.map(function (m) { return m.brand; }).filter(function (b, i, a) { return b && a.indexOf(b) === i; });
    return brandOrder(names).map(function (b) {
      var mine = models.filter(function (m) { return m.brand === b; });
      var scores = {};
      SCORE_AXES.forEach(function (a) { scores[a.key] = round2(mean(mine.map(function (m) { return scoreOf(m, a.key); }))); });
      var axisVals = SCORE_AXES.map(function (a) { return scores[a.key]; }).filter(function (x) { return x != null; });
      var weights = mine.map(function (m) { return m.operating_weight === '' ? null : Number(m.operating_weight) / 1000; }).filter(function (x) { return x != null && isFinite(x); });
      var years = mine.map(function (m) { return Number(m.release_year); }).filter(function (x) { return x > 1900; });
      return {
        brand: b, short: brandShort(b), models: mine.length,
        scored: mine.filter(function (m) { return SCORE_AXES.some(function (a) { return scoreOf(m, a.key) != null; }); }).length,
        scores: scores, overall: round2(mean(axisVals)),
        weight: weights.length ? { min: round1(Math.min.apply(null, weights)), max: round1(Math.max.apply(null, weights)) } : null,
        power: round1(mean(mine.map(function (m) { return m.engine_power === '' ? null : Number(m.engine_power); }))),
        pwr: round2(mean(mine.map(powerPerTon))),
        years: years.length ? { min: Math.min.apply(null, years), max: Math.max.apply(null, years) } : null,
        tags: tagCounts(mine).slice(0, 3),
        latest: mine.map(function (m) { return toDateStr(m.collected_at); }).filter(Boolean).sort().pop() || '',
        incomplete: mine.filter(function (m) { return !completeness(m).ok; }).length,
        confirmed: mine.filter(function (m) { return m.human_review_status === '확정'; }).length
      };
    });
  }

  /* 점수 비교 — 축별 전체 평균(모델 단위)과 브랜드 평균의 차이 */
  function scoreComparison(models, summary) {
    var rows = summary || brandSummary(models);
    var axes = SCORE_AXES.map(function (a) {
      var vals = models.map(function (m) { return scoreOf(m, a.key); }).filter(function (x) { return x != null; });
      var avg = round2(mean(vals));
      var best = null;
      rows.forEach(function (r) { var v = r.scores[a.key]; if (v != null && (!best || v > best.value)) best = { brand: r.brand, value: v }; });
      return { key: a.key, axis: a.axis, name: a.name, avg: avg, n: vals.length, best: best };
    });
    var table = rows.map(function (r) {
      var diff = {};
      axes.forEach(function (a) { diff[a.key] = r.scores[a.key] == null || a.avg == null ? null : round2(r.scores[a.key] - a.avg); });
      return { brand: r.brand, short: r.short, scores: r.scores, diff: diff, overall: r.overall };
    });
    return { axes: axes, rows: table };
  }

  /* 강·약점 추출 — 축 평균보다 threshold(기본 0.5점) 이상 높으면 강점, 낮으면 약점.
     제원은 출력 대비 중량(kW/t)이 전체 평균보다 10% 이상 높거나 낮을 때 적습니다. */
  function strengthsWeaknesses(models, opts) {
    opts = opts || {};
    var th = opts.threshold == null ? 0.5 : opts.threshold;
    var summary = opts.summary || brandSummary(models);
    var cmp = scoreComparison(models, summary);
    var pwrAll = mean(models.map(powerPerTon));
    return summary.map(function (r) {
      var s = [], w = [], notes = [];
      cmp.axes.forEach(function (a) {
        var v = r.scores[a.key];
        if (v == null || a.avg == null) return;
        var d = round2(v - a.avg);
        var item = { type: 'score', key: a.key, name: a.name, value: v, diff: d, text: a.name + ' ' + v + '점 (평균 ' + a.avg + ', ' + (d > 0 ? '+' : '') + d + ')' };
        if (d >= th) s.push(item); else if (d <= -th) w.push(item);
      });
      if (r.pwr != null && pwrAll) {
        var rel = (r.pwr - pwrAll) / pwrAll;
        var pct = Math.round(rel * 100);
        var it = { type: 'spec', key: 'pwr', name: '출력 대비 중량', value: r.pwr, diff: pct,
          text: '출력 대비 중량 ' + r.pwr + ' kW/t (평균 ' + round2(pwrAll) + ', ' + (pct > 0 ? '+' : '') + pct + '%)' };
        if (rel >= 0.1) s.push(it); else if (rel <= -0.1) w.push(it);
      }
      s.sort(function (a, b) { return b.diff - a.diff; });
      w.sort(function (a, b) { return a.diff - b.diff; });
      if (!r.scored) notes.push('평가 점수가 없어 점수 비교에서 빠졌습니다.');
      if (r.incomplete) notes.push('필수 메타 누락 ' + r.incomplete + '건 — 근거 확인이 필요합니다.');
      return { brand: r.brand, short: r.short, strengths: s, weaknesses: w, notes: notes };
    });
  }

  /* Design Tag 트렌드 — 태그별 건수·비율·쓰는 브랜드, 최근 2개 연식(최신 연도와 그 전 해) 건수 */
  function tagTrends(models) {
    var years = models.map(function (m) { return Number(m.release_year); }).filter(function (x) { return x > 1900; });
    var latest = years.length ? Math.max.apply(null, years) : null;
    return tagCounts(models).map(function (t) {
      var withTag = models.filter(function (m) { return (m.design_tags || []).indexOf(t.tag) >= 0; });
      return {
        tag: t.tag, count: t.count, share: models.length ? Math.round(t.count / models.length * 100) : 0,
        brands: brandOrder(withTag.map(function (m) { return m.brand; }).filter(function (b, i, a) { return a.indexOf(b) === i; })).map(brandShort),
        recent: latest == null ? 0 : withTag.filter(function (m) { return Number(m.release_year) >= latest - 1; }).length
      };
    });
  }

  /* White Space — 전체 평균이 낮은 축부터. 최고 브랜드도 4점 미만이면 「비어 있는 자리」로 표시 */
  function whiteSpace(cmp) {
    return cmp.axes.filter(function (a) { return a.avg != null; }).slice().sort(function (a, b) { return a.avg - b.avg; })
      .map(function (a) { return { key: a.key, name: a.name, avg: a.avg, best: a.best, open: !a.best || a.best.value < 4 }; });
  }

  function buildInsight(models) {
    var summary = brandSummary(models);
    var cmp = scoreComparison(models, summary);
    var sw = strengthsWeaknesses(models, { summary: summary });
    var tags = tagTrends(models);
    var ws = whiteSpace(cmp);
    var head = [];
    var ranked = summary.filter(function (r) { return r.overall != null; }).sort(function (a, b) { return b.overall - a.overall; });
    if (ranked.length) head.push('평가 평균이 가장 높은 브랜드는 ' + ranked[0].short + '(' + ranked[0].overall + '점)' +
      (ranked.length > 1 ? ', 가장 낮은 브랜드는 ' + ranked[ranked.length - 1].short + '(' + ranked[ranked.length - 1].overall + '점)' : '') + '입니다.');
    else if (models.length) head.push('평가 점수가 아직 없습니다. 아래 「평가 점수 빠른 입력」에서 1~5점을 넣어 주세요.');
    if (tags.length) head.push('가장 많이 관찰된 Design Tag 는 「' + tags[0].tag + '」(' + tags[0].count + '건, ' + tags[0].share + '%)입니다.');
    if (ws.length) head.push('전체 평균이 가장 낮은 축은 ' + ws[0].name + '(' + ws[0].avg + '점)입니다' + (ws[0].open ? ' — 최고 브랜드도 4점 미만이라 차별화 여지를 검토해 주세요.' : '.'));
    return {
      count: models.length, brandCount: summary.length,
      scoredCount: models.filter(function (m) { return SCORE_AXES.some(function (a) { return scoreOf(m, a.key) != null; }); }).length,
      summary: summary, scores: cmp, sw: sw, tags: tags, whitespace: ws, headline: head
    };
  }

  /* AI 요약 반자동 — 수치 요약을 프롬프트로 만들어 ChatGPT 등에 붙여 넣고, 답을 다시 붙여 넣습니다.
     모델명·점수만 들어가고 이미지·출처 URL 은 넣지 않습니다(사내 보안정책 검토 전). */
  function insightPrompt(ins, scope) {
    var L = [];
    L.push('당신은 건설장비(굴착기·휠로더) 외장·실내 디자인 벤치마킹 전문가입니다.');
    L.push('아래는 경쟁사 모델을 디자이너가 1~5점으로 평가하고 Design Tag 를 붙인 요약입니다.');
    L.push('이 숫자와 태그만 근거로, 한국어로 다음 네 가지를 정리해 줘. 숫자에 없는 내용은 추측하지 말고 「자료 부족」이라고 적어 줘.');
    L.push('1) 주요 디자인 트렌드 3가지  2) 브랜드별 포지셔닝 한 줄씩  3) White Space(차별화 기회)  4) 다음 조사에서 보완할 자료');
    L.push('');
    L.push('[범위] ' + (scope ? scope.scope_id + ' · ' + scope.equipment_type + ' · ' + scope.tonnage_class : '전체 자료') + ' · 모델 ' + ins.count + '건 · 브랜드 ' + ins.brandCount + '개');
    L.push('[축별 평균] ' + ins.scores.axes.map(function (a) { return a.name + ' ' + (a.avg == null ? '-' : a.avg); }).join(' / '));
    L.push('[브랜드별 평균 점수 · 출력대비중량(kW/t) · 주요 태그]');
    ins.summary.forEach(function (r) {
      L.push('- ' + r.short + ' (' + r.models + '건): ' + SCORE_AXES.map(function (a) { return a.axis + ' ' + (r.scores[a.key] == null ? '-' : r.scores[a.key]); }).join(', ') +
        ' · ' + (r.pwr == null ? '-' : r.pwr) + ' kW/t · ' + (r.tags.map(function (t) { return t.tag; }).join(', ') || '태그 없음'));
    });
    L.push('[Design Tag 빈도] ' + ins.tags.slice(0, 10).map(function (t) { return t.tag + ' ' + t.count; }).join(', '));
    return L.join('\n');
  }

  /* ── 전문가(디자이너) 피드백 — 리포트 항목별 평가·코멘트 기록 ── */
  var REPORT_SECTIONS = [
    { id: 'overview', name: '1. Overview · 범위' },
    { id: 'brands', name: '2. 브랜드별 요약' },
    { id: 'scores', name: '3. 점수 비교' },
    { id: 'sw', name: '4. 강·약점' },
    { id: 'trend', name: '5. Design Trend · White Space' },
    { id: 'note', name: '6. 요약 코멘트' },
    { id: 'compare', name: '7. 선택 모델 비교' },
    { id: 'feedback', name: '8. 전문가 피드백' },
    { id: 'ops', name: '9. 자료 신선도 · 운영' }
  ];
  /* 프로토타입 11 Designer Validation 의 분류 4종 + 동의·추가 분석 요청 */
  var FEEDBACK_TYPES = ['동의(수정 없음)', '분석 결과 수정 필요', '디자인 Tag 보정', 'Taxonomy·기준 조정', '예외 사례 등록', '추가 분석 요청'];
  var FEEDBACK_STATUS = ['열림', '반영됨'];
  function sectionName(id) { var s = REPORT_SECTIONS.filter(function (x) { return x.id === id; })[0]; return s ? s.name : id; }
  function feedbackTargetLabel(target, models) {
    if (String(target).indexOf('model:') === 0) {
      var id = target.slice(6);
      var m = (models || []).filter(function (x) { return x.id === id; })[0];
      return '모델 · ' + (m ? brandShort(m.brand) + ' ' + m.model_name : id + '(삭제됨)');
    }
    return '리포트 · ' + sectionName(target);
  }
  function stampTime(d) {
    d = d || new Date();
    return toDateStr(d) + ' ' + pad(d.getHours(), 2) + ':' + pad(d.getMinutes(), 2);
  }
  function validateFeedback(fb) {
    var errs = [];
    var t = str(fb && fb.target);
    if (!t || (t.indexOf('model:') !== 0 && !REPORT_SECTIONS.some(function (s) { return s.id === t; }))) errs.push('target');
    if (FEEDBACK_TYPES.indexOf(fb && fb.type) < 0) errs.push('type');
    var r = Number(fb && fb.rating);
    if (!(r >= 1 && r <= 5 && Math.round(r) === r)) errs.push('rating');
    if (!str(fb && fb.author)) errs.push('author');
    if (fb && fb.type !== FEEDBACK_TYPES[0] && !str(fb.comment)) errs.push('comment');
    return errs;
  }
  /* 기록은 쌓기만 합니다. 내용은 고치지 않고 상태(열림 → 반영됨)만 바꿉니다 */
  function addFeedback(list, input, now, scopeId) {
    var errs = validateFeedback(input);
    if (errs.length) return { ok: false, errors: errs, list: list };
    var max = 0;
    list.forEach(function (x) { var n = Number(String(x.id).replace(/^FB/, '')); if (n > max) max = n; });
    var item = {
      id: 'FB' + pad(max + 1, 4), target: str(input.target), type: input.type, rating: Number(input.rating),
      comment: str(input.comment), author: str(input.author), created_at: stampTime(now), scope_id: scopeId || '',
      status: '열림', resolved_at: ''
    };
    return { ok: true, item: item, list: list.concat([item]) };
  }
  function setFeedbackStatus(list, id, status, now) {
    if (FEEDBACK_STATUS.indexOf(status) < 0) return list;
    return list.map(function (x) {
      if (x.id !== id) return x;
      var c = JSON.parse(JSON.stringify(x));
      c.status = status; c.resolved_at = status === '반영됨' ? stampTime(now) : '';
      return c;
    });
  }
  /* 항목별 요약 — 건수·평균 평가·열린 건·최근 작성 */
  function feedbackSummary(list) {
    var targets = REPORT_SECTIONS.map(function (s) { return s.id; });
    list.forEach(function (x) { if (targets.indexOf(x.target) < 0) targets.push(x.target); });
    return targets.map(function (t) {
      var mine = list.filter(function (x) { return x.target === t; });
      return {
        target: t, count: mine.length, avg: round1(mean(mine.map(function (x) { return x.rating; }))),
        open: mine.filter(function (x) { return x.status !== '반영됨'; }).length,
        latest: mine.map(function (x) { return x.created_at; }).sort().pop() || '',
        types: FEEDBACK_TYPES.map(function (ty) { return { type: ty, count: mine.filter(function (x) { return x.type === ty; }).length }; }).filter(function (x) { return x.count; })
      };
    }).filter(function (r) { return r.count || REPORT_SECTIONS.some(function (s) { return s.id === r.target; }); });
  }
  function restoreFeedback(p) {
    if (!Array.isArray(p)) return [];
    return p.filter(function (x) { return x && x.id && validateFeedback(x).length === 0; }).map(function (x) {
      return { id: String(x.id), target: str(x.target), type: x.type, rating: Number(x.rating), comment: str(x.comment), author: str(x.author),
        created_at: str(x.created_at), scope_id: str(x.scope_id), status: FEEDBACK_STATUS.indexOf(x.status) >= 0 ? x.status : '열림', resolved_at: str(x.resolved_at) };
    });
  }

  /* ── 정기 업데이트 · 운영 루프 ── */
  var UPDATE_CYCLES = [
    { id: 'weekly', name: '주간', days: 7 },
    { id: 'biweekly', name: '격주', days: 14 },
    { id: 'monthly', name: '월간', months: 1 },
    { id: 'quarterly', name: '분기', months: 3 }
  ];
  /* 프로토타입 13 의 운영 루프(Scheduled Update → Collection → Normalize/QA → Analysis → Knowledge → Dashboard)에
     10 Report · 11 Validation · 12 Tuning 을 이어 한 바퀴로 만들었습니다. href 는 이 도구의 메뉴입니다 */
  var OPS_STEPS = [
    { id: 'collect', name: '신규·변경 자료 수집·등록', href: '#/edit', menu: '05 자료 등록 · 06 가져오기' },
    { id: 'qa', name: '필수 메타 누락·톤급 점검', href: '#/dashboard', menu: '02 Status Dashboard' },
    { id: 'analyze', name: '관찰 입력·평가 점수 갱신', href: '#/insight', menu: '05 자료 등록 · 07 Insight(빠른 입력)' },
    { id: 'insight', name: '인사이트 확인·요약 코멘트', href: '#/insight', menu: '07 Insight' },
    { id: 'report', name: 'Benchmarking Report 발행', href: '#/report', menu: '08 Report' },
    { id: 'feedback', name: '전문가 피드백 검토·반영', href: '#/feedback', menu: '09 전문가 피드백' },
    { id: 'tune', name: 'Tag·Taxonomy·Schema 보정 기록', href: '#/ops', menu: '10 운영 루프(완료 메모)' }
  ];
  var DAY = 86400000;
  function parseDay(s) {
    var m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
  }
  function fmtDay(t) { var d = new Date(t); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1, 2) + '-' + pad(d.getUTCDate(), 2); }
  function daysBetween(a, b) { var x = parseDay(a), y = parseDay(b); return x == null || y == null ? null : Math.round((y - x) / DAY); }
  function addDays(s, n) { var t = parseDay(s); return t == null ? '' : fmtDay(t + n * DAY); }
  /* 달 더하기 — 1/31 + 1달 = 2/28(윤년 29) 처럼 그 달 마지막 날로 맞춥니다 */
  function addMonths(s, n) {
    var t = parseDay(s);
    if (t == null) return '';
    var d = new Date(t), y = d.getUTCFullYear(), mo = d.getUTCMonth() + n, day = d.getUTCDate();
    var last = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
    return fmtDay(Date.UTC(y, mo, Math.min(day, last)));
  }
  function cycleById(id) { return UPDATE_CYCLES.filter(function (c) { return c.id === id; })[0] || UPDATE_CYCLES[2]; }
  function nextDue(last, cycleId) {
    if (parseDay(last) == null) return '';
    var c = cycleById(cycleId);
    return c.days ? addDays(last, c.days) : addMonths(last, c.months);
  }
  function defaultOps() { return { cycle: 'monthly', stale_days: 180, last_update: '', steps: {}, history: [] }; }
  function restoreOps(p) {
    var o = defaultOps();
    if (!p || typeof p !== 'object') return o;
    if (UPDATE_CYCLES.some(function (c) { return c.id === p.cycle; })) o.cycle = p.cycle;
    var sd = Number(p.stale_days);
    if (sd >= 7 && sd <= 3650) o.stale_days = Math.round(sd);
    if (parseDay(p.last_update) != null) o.last_update = toDateStr(p.last_update);
    if (p.steps && typeof p.steps === 'object') OPS_STEPS.forEach(function (s) { if (p.steps[s.id]) o.steps[s.id] = str(p.steps[s.id]) || true; });
    if (Array.isArray(p.history)) o.history = p.history.filter(function (h) { return h && parseDay(h.date) != null; }).map(function (h) {
      return { date: toDateStr(h.date), cycle: str(h.cycle), steps_done: Array.isArray(h.steps_done) ? h.steps_done.map(str) : [], note: str(h.note), models: Number(h.models) || 0 };
    });
    return o;
  }
  /* 오래된 자료 — 수집일이 stale_days 보다 오래된 모델. 수집일이 없으면 따로 셉니다 */
  function staleModels(models, now, staleDays) {
    var today = toDateStr(now || new Date());
    var stale = [], undated = [];
    models.forEach(function (m) {
      var c = toDateStr(m.collected_at);
      if (!c) { undated.push(m); return; }
      var age = daysBetween(c, today);
      if (age > staleDays) stale.push({ id: m.id, brand: m.brand, model_name: m.model_name, collected_at: c, age: age });
    });
    stale.sort(function (a, b) { return b.age - a.age; });
    return { stale: stale, undated: undated.map(function (m) { return { id: m.id, brand: m.brand, model_name: m.model_name }; }) };
  }
  /* state: none(갱신 기록 없음) · ok · soon(3일 이내) · due(오늘) · overdue(지남) */
  function opsStatus(ops, models, now, extra) {
    ops = ops || defaultOps(); extra = extra || {};
    var today = toDateStr(now || new Date());
    var next = ops.last_update ? nextDue(ops.last_update, ops.cycle) : '';
    var left = next ? daysBetween(today, next) : null;
    var state = !next ? 'none' : left < 0 ? 'overdue' : left === 0 ? 'due' : left <= 3 ? 'soon' : 'ok';
    var st = staleModels(models || [], now, ops.stale_days);
    var done = OPS_STEPS.filter(function (s) { return ops.steps && ops.steps[s.id]; }).length;
    return {
      cycle: cycleById(ops.cycle), last: ops.last_update, next: next, daysLeft: left, state: state,
      stale: st.stale, undated: st.undated, staleDays: ops.stale_days,
      stepsDone: done, stepsTotal: OPS_STEPS.length,
      hints: {
        qa: (models || []).filter(function (m) { return !completeness(m).ok; }).length,
        analyze: (models || []).filter(function (m) { return !SCORE_AXES.some(function (a) { return scoreOf(m, a.key) != null; }); }).length,
        feedback: extra.openFeedback || 0
      }
    };
  }
  function toggleStep(ops, stepId, on, now) {
    var o = restoreOps(ops);
    if (!OPS_STEPS.some(function (s) { return s.id === stepId; })) return o;
    if (on) o.steps[stepId] = toDateStr(now || new Date()); else delete o.steps[stepId];
    return o;
  }
  /* 사이클 완료 — 마지막 갱신일을 오늘로, 이력에 남기고 단계 체크를 비웁니다 */
  function completeCycle(ops, now, note, modelCount) {
    var o = restoreOps(ops);
    var today = toDateStr(now || new Date());
    o.history.unshift({ date: today, cycle: o.cycle, steps_done: OPS_STEPS.filter(function (s) { return o.steps[s.id]; }).map(function (s) { return s.id; }), note: str(note), models: modelCount || 0 });
    o.last_update = today;
    o.steps = {};
    return o;
  }

  /* ── Benchmarking Report — 화면·인쇄·xlsx·HTML 이 모두 이 한 덩어리를 씁니다 ── */
  function reportModels(db, opts) {
    opts = opts || {};
    var sc = activeScope(db);
    if (sc && opts.useScope !== false) return db.models.filter(function (m) { return inScope(m, sc); });
    if (opts.equipment_type) return db.models.filter(function (m) { return m.equipment_type === opts.equipment_type; });
    return db.models.slice();
  }
  function buildReport(db, opts) {
    opts = opts || {};
    var now = opts.now || new Date();
    var sc = opts.useScope === false ? null : activeScope(db);
    var models = reportModels(db, opts);
    var ins = buildInsight(models);
    var ids = models.map(function (m) { return m.id; });
    var cmpModels = (db.compare || []).map(function (id) { return db.models.filter(function (m) { return m.id === id; })[0]; }).filter(Boolean);
    var fb = (db.feedback || []).filter(function (x) { return x.target.indexOf('model:') !== 0 || ids.indexOf(x.target.slice(6)) >= 0; });
    var tc = sc ? tonnageClass(sc.equipment_type, sc.tonnage_class) : null;
    return {
      title: (tc ? tc.name : opts.equipment_type ? opts.equipment_type : '전체 장비') + ' Design Benchmark',
      generated_at: stampTime(now), schema_version: SCHEMA_VERSION, sample: !!db._sample,
      scope: sc ? { scope_id: sc.scope_id, equipment_type: sc.equipment_type, tonnage: tc ? tc.name + ' (' + tc.range + ')' : sc.tonnage_class,
        brands: sc.brands.map(brandShort), purposes: sc.purposes.slice() } : null,
      filterLabel: sc ? 'Scope ' + sc.scope_id : opts.equipment_type ? opts.equipment_type + ' 전체' : '전체 자료',
      overview: {
        models: models.length, brands: ins.brandCount,
        images: models.reduce(function (n, m) { return n + (m.media || []).length; }, 0),
        incomplete: models.filter(function (m) { return !completeness(m).ok; }).length,
        confirmed: models.filter(function (m) { return m.human_review_status === '확정'; }).length,
        scored: ins.scoredCount
      },
      insight: ins,
      note: db.insightNote && str(db.insightNote.text) ? { text: str(db.insightNote.text), origin: str(db.insightNote.origin), saved_at: str(db.insightNote.saved_at) } : null,
      compare: cmpModels.length >= 2 ? {
        models: cmpModels.map(function (m) { return brandShort(m.brand) + ' ' + m.model_name; }),
        rows: compareRows(cmpModels, { hideEmpty: true }).filter(function (r) { return ['identity', 'engineering', 'design', 'cabin', 'cmf', 'service'].some(function (b) { return BLOCKS.filter(function (x) { return x.id === b && x.name === r.block; }).length; }); })
      } : null,
      feedback: { items: fb.map(function (x) { var c = JSON.parse(JSON.stringify(x)); c.target_label = feedbackTargetLabel(x.target, db.models); return c; }), summary: feedbackSummary(fb) },
      ops: opsStatus(db.ops, models, now, { openFeedback: fb.filter(function (x) { return x.status !== '반영됨'; }).length })
    };
  }
  function fmtScore(v) { return v == null ? '-' : String(v); }
  function fmtDiff(v) { return v == null ? '-' : (v > 0 ? '+' : '') + v; }
  /* xlsx 시트들 — [{ name, aoa }] */
  function reportSheets(rep) {
    var out = [];
    var o = rep.overview;
    out.push({ name: '요약', aoa: [
      ['Benchmarking Report', rep.title], ['작성 시각', rep.generated_at], ['범위', rep.filterLabel],
      ['장비군 · 톤급', rep.scope ? rep.scope.equipment_type + ' · ' + rep.scope.tonnage : '-'],
      ['Scope 경쟁사', rep.scope ? rep.scope.brands.join(', ') : '-'], ['목적', rep.scope ? rep.scope.purposes.join(', ') : '-'],
      ['모델', o.models], ['브랜드', o.brands], ['이미지', o.images], ['필수 메타 누락', o.incomplete], ['검증 확정', o.confirmed], ['평가 점수 입력', o.scored],
      ['schema_version', rep.schema_version], ['예시 데이터', rep.sample ? '예 — 모두 가상 값' : '아니오'], [],
      ['주요 인사이트']
    ].concat(rep.insight.headline.map(function (x) { return ['', x]; }))
      .concat(rep.note ? [[], ['요약 코멘트 (' + (rep.note.origin || '작성') + ', ' + rep.note.saved_at + ')', rep.note.text]] : []) });
    out.push({ name: '브랜드요약', aoa: [['브랜드', '모델 수', '평가 입력', '평가 평균'].concat(SCORE_AXES.map(function (a) { return a.name; }))
      .concat(['운전중량 범위(t)', '평균 출력(kW)', '출력대비중량(kW/t)', '출시 연도', '주요 태그', '최근 수집일', '필수 메타 누락', '검증 확정'])]
      .concat(rep.insight.summary.map(function (r) {
        return [r.short, r.models, r.scored, fmtScore(r.overall)].concat(SCORE_AXES.map(function (a) { return fmtScore(r.scores[a.key]); }))
          .concat([r.weight ? r.weight.min + ' ~ ' + r.weight.max : '-', fmtScore(r.power), fmtScore(r.pwr), r.years ? r.years.min + ' ~ ' + r.years.max : '-',
            r.tags.map(function (t) { return t.tag + '(' + t.count + ')'; }).join(', '), r.latest || '-', r.incomplete, r.confirmed]);
      })) });
    var cmp = rep.insight.scores;
    out.push({ name: '점수비교', aoa: [['브랜드'].concat(cmp.axes.map(function (a) { return a.name; })).concat(cmp.axes.map(function (a) { return a.name + ' 평균 대비'; }))]
      .concat(cmp.rows.map(function (r) { return [r.short].concat(cmp.axes.map(function (a) { return fmtScore(r.scores[a.key]); })).concat(cmp.axes.map(function (a) { return fmtDiff(r.diff[a.key]); })); }))
      .concat([['축 평균(모델 단위)'].concat(cmp.axes.map(function (a) { return fmtScore(a.avg); }))]) });
    out.push({ name: '강약점', aoa: [['브랜드', '구분', '내용']].concat([].concat.apply([], rep.insight.sw.map(function (r) {
      var rows = r.strengths.map(function (x) { return [r.short, '강점', x.text]; }).concat(r.weaknesses.map(function (x) { return [r.short, '약점', x.text]; }))
        .concat(r.notes.map(function (x) { return [r.short, '참고', x]; }));
      return rows.length ? rows : [[r.short, '-', '평균과 큰 차이 없음']];
    }))) });
    out.push({ name: '태그트렌드', aoa: [['Design Tag', '건수', '비율(%)', '최근 2개 연식 건수', '브랜드']].concat(rep.insight.tags.map(function (t) { return [t.tag, t.count, t.share, t.recent, t.brands.join(', ')]; }))
      .concat([[], ['White Space (평균 낮은 축부터)', '축 평균', '최고 브랜드', '최고 점수', '비어 있는 자리']])
      .concat(rep.insight.whitespace.map(function (w) { return [w.name, w.avg, w.best ? brandShort(w.best.brand) : '-', w.best ? w.best.value : '-', w.open ? '예' : '']; })) });
    if (rep.compare) out.push({ name: '선택비교', aoa: [['블록', '구분', '항목'].concat(rep.compare.models).concat(['차이'])]
      .concat(rep.compare.rows.map(function (r) { return [r.block, r.kind, r.label].concat(r.values).concat([r.differs ? '차이 있음' : '']); })) });
    out.push({ name: '전문가피드백', aoa: [['ID', '대상', '분류', '평가(1~5)', '코멘트', '작성자', '작성 시각', '상태', '반영 시각']]
      .concat(rep.feedback.items.map(function (x) { return [x.id, x.target_label, x.type, x.rating, x.comment, x.author, x.created_at, x.status, x.resolved_at]; })) });
    var ops = rep.ops;
    out.push({ name: '운영', aoa: [['업데이트 주기', ops.cycle.name], ['마지막 갱신일', ops.last || '-'], ['다음 예정일', ops.next || '-'],
      ['오래된 자료 기준(일)', ops.staleDays], ['오래된 자료', ops.stale.length], ['수집일 없음', ops.undated.length], [],
      ['모델', '수집일', '경과(일)']].concat(ops.stale.map(function (s) { return [brandShort(s.brand) + ' ' + s.model_name, s.collected_at, s.age]; })) });
    return out;
  }

  function esc(v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  /* 리포트 본문 스타일 — 화면(.rp 안)과 내려받는 HTML 이 같은 규칙을 씁니다 */
  var REPORT_CSS = [
    '.rp{color:#16202c;font-size:14px;line-height:1.6;word-break:keep-all;overflow-wrap:break-word}',
    '.rp h1{font-size:1.5rem;margin:0 0 4px}.rp h2{font-size:1.1rem;margin:0 0 10px;padding-bottom:6px;border-bottom:2px solid #0f2544}',
    '.rp .rp-cover{border-left:6px solid #2f73d9;padding:6px 0 6px 14px;margin-bottom:18px}.rp .rp-meta{color:#56616f;font-size:.9rem}',
    '.rp section{margin:0 0 22px;break-inside:avoid-page}.rp .rp-sample{background:#fff4d6;border:1px solid #e8cf85;padding:6px 10px;border-radius:8px;font-size:.9rem}',
    '.rp .rp-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin:8px 0}',
    '.rp .rp-tile{border:1px solid #d6dde6;border-radius:8px;padding:8px 10px}.rp .rp-tile b{display:block;font-size:1.2rem}.rp .rp-tile span{color:#56616f;font-size:.85rem}',
    '.rp .rp-wrap{overflow-x:auto}.rp table{border-collapse:collapse;width:100%;font-size:.88rem}',
    '.rp th,.rp td{border:1px solid #d6dde6;padding:5px 7px;text-align:left;vertical-align:top}.rp th{background:#eef2f7}',
    '.rp td.n{text-align:right;white-space:nowrap}.rp td.up{background:#e3f4e8}.rp td.down{background:#fde8e6}.rp tr.diff td{background:#fff9e0}',
    '.rp ul{margin:4px 0 0;padding-left:20px}.rp .rp-sw{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px}',
    '.rp .rp-card{border:1px solid #d6dde6;border-radius:8px;padding:8px 12px}.rp .rp-card h3{font-size:1rem;margin:0 0 4px}',
    '.rp .ok{color:#1b6e3a}.rp .bad{color:#b3261e}.rp .muted{color:#56616f}.rp .rp-note{white-space:pre-line;border:1px solid #d6dde6;border-radius:8px;padding:10px 12px;background:#f7f9fc}'
  ].join('\n');
  function tbl(head, rows, numCols) {
    numCols = numCols || [];
    return '<div class="rp-wrap"><table><thead><tr>' + head.map(function (x) { return '<th scope="col">' + esc(x) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) {
        var cls = r._cls ? ' class="' + r._cls + '"' : '';
        return '<tr' + cls + '>' + r.map(function (c, i) {
          var cc = c && typeof c === 'object' ? c : { v: c };
          var k = [numCols.indexOf(i) >= 0 ? 'n' : '', cc.cls || ''].join(' ').trim();
          return '<td' + (k ? ' class="' + k + '"' : '') + '>' + esc(cc.v == null || cc.v === '' ? '-' : cc.v) + '</td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>';
  }
  /* 리포트 본문 HTML (data-section 으로 항목을 표시 — 화면에서 항목별 피드백 버튼을 붙입니다) */
  function reportBodyHtml(rep) {
    var o = rep.overview, ins = rep.insight, H = [];
    function sec(id, inner) { H.push('<section data-section="' + id + '"><h2>' + esc(sectionName(id)) + '</h2>' + inner + '</section>'); }
    H.push('<div class="rp-cover"><div class="rp-meta">DESIGN BENCHMARKING AGENT · Benchmarking Report</div><h1>' + esc(rep.title) + '</h1>' +
      '<div class="rp-meta">' + esc(rep.filterLabel) + ' · 작성 ' + esc(rep.generated_at) + ' · schema ' + esc(rep.schema_version) + '</div></div>');
    if (rep.sample) H.push('<p class="rp-sample">예시 데이터 — 모델명(「예시-」)·제원·점수·출처는 모두 시연용 가상 값입니다. 브랜드 이름만 경쟁사 목록을 빌렸습니다.</p>');
    sec('overview', (rep.scope ? '<p>' + esc(rep.scope.equipment_type + ' · ' + rep.scope.tonnage) + '<br>경쟁사 ' + rep.scope.brands.length + '개: ' + esc(rep.scope.brands.join(', ')) + '<br>목적: ' + esc(rep.scope.purposes.join(', ')) + '</p>' : '<p class="muted">Scope 를 지정하지 않아 ' + esc(rep.filterLabel) + '를 대상으로 했습니다.</p>') +
      '<div class="rp-tiles">' + [['모델', o.models + '건'], ['브랜드', o.brands + '개'], ['이미지', o.images + '장'], ['평가 입력', o.scored + '건'], ['검증 확정', o.confirmed + '건'], ['필수 메타 누락', o.incomplete + '건']]
        .map(function (t) { return '<div class="rp-tile"><span>' + esc(t[0]) + '</span><b>' + esc(t[1]) + '</b></div>'; }).join('') + '</div>' +
      (ins.headline.length ? '<ul>' + ins.headline.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : ''));
    sec('brands', ins.summary.length ? tbl(['브랜드', '모델', '평가 평균', '운전중량(t)', '출력대비중량(kW/t)', '출시 연도', '주요 태그', '최근 수집일'],
      ins.summary.map(function (r) { return [r.short, r.models, fmtScore(r.overall), r.weight ? r.weight.min + ' ~ ' + r.weight.max : '', fmtScore(r.pwr), r.years ? r.years.min + ' ~ ' + r.years.max : '', r.tags.map(function (t) { return t.tag; }).join(', '), r.latest]; }), [1, 2, 4]) : '<p class="muted">대상 모델이 없습니다.</p>');
    var cmp = ins.scores;
    sec('scores', cmp.rows.length ? tbl(['브랜드'].concat(cmp.axes.map(function (a) { return a.name; })).concat(['평균']),
      cmp.rows.map(function (r) {
        return [r.short].concat(cmp.axes.map(function (a) {
          var d = r.diff[a.key];
          return { v: r.scores[a.key] == null ? '' : r.scores[a.key] + ' (' + fmtDiff(d) + ')', cls: d == null ? '' : d >= 0.5 ? 'up' : d <= -0.5 ? 'down' : '' };
        })).concat([fmtScore(r.overall)]);
      }).concat([['축 평균'].concat(cmp.axes.map(function (a) { return fmtScore(a.avg); })).concat([''])]), [1, 2, 3, 4, 5]) +
      '<p class="muted">괄호는 축 평균(모델 단위) 대비 차이입니다. 0.5점 이상 높으면 초록, 낮으면 빨강입니다.</p>' : '<p class="muted">대상 모델이 없습니다.</p>');
    sec('sw', '<div class="rp-sw">' + ins.sw.map(function (r) {
      return '<div class="rp-card"><h3>' + esc(r.short) + '</h3>' +
        (r.strengths.length ? '<div class="ok">강점</div><ul>' + r.strengths.map(function (x) { return '<li>' + esc(x.text) + '</li>'; }).join('') + '</ul>' : '') +
        (r.weaknesses.length ? '<div class="bad">약점</div><ul>' + r.weaknesses.map(function (x) { return '<li>' + esc(x.text) + '</li>'; }).join('') + '</ul>' : '') +
        (!r.strengths.length && !r.weaknesses.length ? '<div class="muted">평균과 큰 차이가 없습니다.</div>' : '') +
        (r.notes.length ? '<ul class="muted">' + r.notes.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') + '</div>';
    }).join('') + '</div>');
    sec('trend', (ins.tags.length ? tbl(['Design Tag', '건수', '비율', '최근 2개 연식', '브랜드'], ins.tags.slice(0, 12).map(function (t) { return [t.tag, t.count, t.share + '%', t.recent, t.brands.join(', ')]; }), [1, 2, 3]) : '<p class="muted">Design Tag 가 없습니다.</p>') +
      (ins.whitespace.length ? '<p><b>White Space</b> — 전체 평균이 낮은 축부터</p><ul>' + ins.whitespace.map(function (w) {
        return '<li>' + esc(w.name + ' 평균 ' + w.avg + '점 · 최고 ' + (w.best ? brandShort(w.best.brand) + ' ' + w.best.value + '점' : '-') + (w.open ? ' — 최고 브랜드도 4점 미만(비어 있는 자리)' : '')) + '</li>';
      }).join('') + '</ul>' : ''));
    sec('note', rep.note ? '<div class="rp-note">' + esc(rep.note.text) + '</div><p class="muted">' + esc((rep.note.origin || '작성') + ' · ' + rep.note.saved_at) + '</p>' : '<p class="muted">요약 코멘트가 없습니다. 07 Insight 에서 작성하거나 AI 요약을 붙여 넣어 주세요.</p>');
    sec('compare', rep.compare ? tbl(['블록', '항목'].concat(rep.compare.models), rep.compare.rows.map(function (r) { var row = [r.block, r.label].concat(r.values); if (r.differs) row._cls = 'diff'; return row; })) +
      '<p class="muted">값이 서로 다른 행은 노란색입니다.</p>' : '<p class="muted">비교함에 2개 이상 담으면 이 자리에 비교표가 들어갑니다(03 Card Gallery).</p>');
    var fbs = rep.feedback;
    sec('feedback', fbs.items.length ? tbl(['대상', '분류', '평가', '코멘트', '작성자 · 시각', '상태'], fbs.items.map(function (x) { return [x.target_label, x.type, x.rating + ' / 5', x.comment, x.author + ' · ' + x.created_at, x.status]; }), [2]) : '<p class="muted">아직 피드백이 없습니다.</p>');
    var op = rep.ops;
    sec('ops', '<p>업데이트 주기 ' + esc(op.cycle.name) + ' · 마지막 갱신 ' + esc(op.last || '기록 없음') + ' · 다음 예정 ' + esc(op.next || '-') +
      (op.state === 'overdue' ? ' <b class="bad">(예정일 ' + (-op.daysLeft) + '일 지남)</b>' : '') + '</p>' +
      '<p>수집일이 ' + op.staleDays + '일 넘은 자료 ' + op.stale.length + '건 · 수집일 없음 ' + op.undated.length + '건</p>' +
      (op.stale.length ? tbl(['모델', '수집일', '경과(일)'], op.stale.slice(0, 20).map(function (s) { return [brandShort(s.brand) + ' ' + s.model_name, s.collected_at, s.age]; }), [2]) : ''));
    return H.join('\n');
  }
  function reportHtml(rep) {
    return '<!doctype html>\n<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>' + esc(rep.title + ' — Benchmarking Report') + '</title><style>body{margin:0;background:#fff;font-family:"Noto Sans KR","Malgun Gothic","Apple SD Gothic Neo",sans-serif}' +
      '.rp{max-width:1000px;margin:0 auto;padding:24px 16px 48px}@media print{.rp{padding:0}}\n' + REPORT_CSS + '</style></head><body><article class="rp">' +
      reportBodyHtml(rep) + '</article></body></html>';
  }

  return {
    SCHEMA_VERSION: SCHEMA_VERSION, BRANDS: BRANDS, PRODUCTS: PRODUCTS, PURPOSES: PURPOSES, VIEWS: VIEWS,
    SOURCE_TYPES: SOURCE_TYPES, RELIABILITY: RELIABILITY, REVIEW_STATUS: REVIEW_STATUS, OBS_ORIGIN: OBS_ORIGIN,
    BLOCKS: BLOCKS, FIELDS: FIELDS, REQUIRED: REQUIRED, MAX_COMPARE: MAX_COMPARE,
    fieldByKey: fieldByKey, fieldsOf: fieldsOf, norm: norm,
    productByName: productByName, tonnageClass: tonnageClass, suggestTonnage: suggestTonnage, tonnageFromText: tonnageFromText,
    normalizeBrand: normalizeBrand, brandInUniverse: brandInUniverse, brandShort: brandShort,
    parseQuantity: parseQuantity, toDateStr: toDateStr, splitTags: splitTags, formatNum: formatNum,
    purposeCode: purposeCode, validateScope: validateScope, baseScopeId: baseScopeId, assignScope: assignScope, inScope: inScope,
    emptyModel: emptyModel, cleanModel: cleanModel, validateModel: validateModel, nextId: nextId, modelKey: modelKey,
    missingFields: missingFields, tonnageMismatch: tonnageMismatch, completeness: completeness, hasImage: hasImage,
    filterModels: filterModels, statusMatrix: statusMatrix, missingSummary: missingSummary, brandAvailability: brandAvailability,
    toggleCompare: toggleCompare, displayValue: displayValue, compareRows: compareRows, compareSheet: compareSheet,
    importTargets: importTargets, guessMapping: guessMapping, headerUnit: headerUnit, rowsToModels: rowsToModels, matchView: matchView, mergeModels: mergeModels,
    exportHeaders: exportHeaders, modelsToSheet: modelsToSheet, toCsv: toCsv, parseCsv: parseCsv,
    emptyDb: emptyDb, restoreDb: restoreDb, activeScope: activeScope,
    /* 2026-09-29 추가 */
    SCORE_AXES: SCORE_AXES, REPORT_SECTIONS: REPORT_SECTIONS, FEEDBACK_TYPES: FEEDBACK_TYPES, FEEDBACK_STATUS: FEEDBACK_STATUS,
    UPDATE_CYCLES: UPDATE_CYCLES, OPS_STEPS: OPS_STEPS, REPORT_CSS: REPORT_CSS,
    cleanScore: cleanScore, scoreOf: scoreOf, powerPerTon: powerPerTon,
    brandSummary: brandSummary, scoreComparison: scoreComparison, strengthsWeaknesses: strengthsWeaknesses, tagTrends: tagTrends,
    whiteSpace: whiteSpace, buildInsight: buildInsight, insightPrompt: insightPrompt,
    sectionName: sectionName, feedbackTargetLabel: feedbackTargetLabel, validateFeedback: validateFeedback, addFeedback: addFeedback,
    setFeedbackStatus: setFeedbackStatus, feedbackSummary: feedbackSummary, stampTime: stampTime,
    daysBetween: daysBetween, addDays: addDays, addMonths: addMonths, nextDue: nextDue, defaultOps: defaultOps, restoreOps: restoreOps,
    staleModels: staleModels, opsStatus: opsStatus, toggleStep: toggleStep, completeCycle: completeCycle,
    reportModels: reportModels, buildReport: buildReport, reportSheets: reportSheets, reportBodyHtml: reportBodyHtml, reportHtml: reportHtml, esc: esc
  };
});
