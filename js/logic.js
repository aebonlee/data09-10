/* Design Benchmarking Agent — 순수 로직 (화면·저장소와 무관)
   브라우저에서는 window.DBLogic, node 에서는 require('./logic.js') 로 씁니다.
   기준 문서: docs/01_프로젝트_기획서.md (3장 데이터, 5장 기능, 8장 1단계)
   근거 원문: 제출 기획서 Rev 3.0 — 6절 Schema, 12절 Data Completeness, 18절 View Taxonomy, 부록 B·C */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DBLogic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SCHEMA_VERSION = 'v0.1-stage1';

  /* ── 부록 B. 경쟁사 Selection Universe (13개사, 제출 순서 그대로) ── */
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
    { id: 'kobelco', name: 'Kobelco', short: 'Kobelco', hq: '일본', aliases: ['kobelco', '코벨코'] }
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

    F('glass_area', 'Glass Area', 'cabin', 'text', { syn: ['glass_area', '유리면적', '글라스'] }),
    F('pillar_design', 'Pillar Design', 'cabin', 'text', { syn: ['pillar_design', '필러'] }),
    F('visibility', 'Visibility', 'cabin', 'text', { syn: ['visibility', '시야', '시야성'] }),
    F('console_layout', 'Console Layout', 'cabin', 'text', { syn: ['console_layout', '콘솔'] }),
    F('joystick', 'Joystick', 'cabin', 'text', { syn: ['joystick', '조이스틱'] }),
    F('seat', 'Seat', 'cabin', 'text', { syn: ['seat', '시트'] }),
    F('display', 'Display', 'cabin', 'text', { syn: ['display', '디스플레이', '모니터'] }),
    F('hvac', 'HVAC', 'cabin', 'text', { syn: ['hvac', '공조'] }),

    F('main_color', 'Main Color', 'cmf', 'text', { syn: ['main_color', '메인컬러', '주색상', '주조색'] }),
    F('accent_color', 'Accent Color', 'cmf', 'text', { syn: ['accent_color', '포인트컬러', '보조색', '강조색'] }),
    F('underbody_color', 'Underbody Color', 'cmf', 'text', { syn: ['underbody_color', '하부색', '하부컬러'] }),
    F('material', 'Material', 'cmf', 'text', { syn: ['material', '소재', '재질'] }),
    F('finish', 'Finish', 'cmf', 'text', { syn: ['finish', '마감'] }),
    F('gloss', 'Gloss', 'cmf', 'text', { syn: ['gloss', '광택'] }),
    F('texture', 'Texture', 'cmf', 'text', { syn: ['texture', '질감', '텍스처'] }),

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
    return { models: [], scopes: [], activeScope: '', compare: [], settings: { imageMaxPx: 800, imageQuality: 0.8 } };
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
    emptyDb: emptyDb, restoreDb: restoreDb, activeScope: activeScope
  };
});
