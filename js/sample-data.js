/* 예시 데이터 — 전부 가상입니다.
   모델명은 「예시-」로 시작하는 가상의 이름이고, 제원·태그·색·수집일도 시연용으로 만든 값입니다.
   이미지는 실제 사진이 아니라 도형으로 그린 SVG 입니다(기획서 8장 1단계 6번: 가상의 모델명·도형 이미지).
   브랜드 칸은 Scope·현황표 동작을 보이려고 부록 B 경쟁사 이름을 쓰지만, 그 브랜드의 실제 제품·제원이 아닙니다. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./logic.js'));
  else root.DBSample = factory(root.DBLogic);
})(typeof self !== 'undefined' ? self : this, function (L) {
  'use strict';

  /* 도형 색 팔레트(가상) */
  var PAL = [
    { main: '#d4a62a', accent: '#2b3440', under: '#2b3440', mainName: '예시 옐로', accentName: '다크 그레이' },
    { main: '#4d86b3', accent: '#1f2a36', under: '#39424d', mainName: '예시 블루', accentName: '차콜' },
    { main: '#c96a36', accent: '#2a2f36', under: '#2a2f36', mainName: '예시 오렌지', accentName: '블랙' },
    { main: '#a9b2bd', accent: '#1d4f7a', under: '#33393f', mainName: '예시 실버', accentName: '네이비' },
    { main: '#5c8f4a', accent: '#23282d', under: '#23282d', mainName: '예시 그린', accentName: '블랙' },
    { main: '#b8433b', accent: '#e8e8e8', under: '#2f2f2f', mainName: '예시 레드', accentName: '화이트' }
  ];

  function svg(w, h, body, label) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '">' +
      '<rect width="100%" height="100%" fill="#eef2f6"/>' + body +
      '<text x="12" y="' + (h - 12) + '" font-family="sans-serif" font-size="14" fill="#56616f">' + label + ' · 예시 도형</text></svg>';
  }
  function uri(s) { return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s); }

  function excSide(c, cab) {
    return '<rect x="70" y="170" width="190" height="34" rx="17" fill="#2b3440"/>' +
      '<rect x="95" y="120" width="160" height="52" rx="10" fill="' + c.main + '"/>' +
      '<rect x="210" y="104" width="52" height="34" rx="6" fill="' + c.accent + '"/>' +
      '<rect x="' + (cab ? 110 : 112) + '" y="' + (cab ? 64 : 72) + '" width="' + (cab ? 64 : 58) + '" height="' + (cab ? 58 : 50) + '" rx="6" fill="' + c.main + '"/>' +
      '<rect x="118" y="' + (cab ? 72 : 79) + '" width="' + (cab ? 48 : 42) + '" height="34" rx="3" fill="#1b2430" opacity=".85"/>' +
      '<polygon points="100,130 40,70 52,60 112,118" fill="' + c.main + '"/>' +
      '<polygon points="40,70 20,150 34,152 54,74" fill="' + c.main + '"/>' +
      '<polygon points="12,150 46,150 40,176 18,172" fill="' + c.accent + '"/>';
  }
  function excFront(c) {
    return '<polygon points="60,178 250,190 250,210 60,200" fill="#2b3440"/>' +
      '<polygon points="80,120 240,132 240,184 80,172" fill="' + c.main + '"/>' +
      '<polygon points="92,64 160,68 160,124 92,120" fill="' + c.main + '"/>' +
      '<polygon points="100,72 152,75 152,108 100,105" fill="#1b2430" opacity=".85"/>' +
      '<polygon points="160,70 196,60 206,150 176,150" fill="' + c.main + '"/>' +
      '<polygon points="196,150 230,150 226,176 190,172" fill="' + c.accent + '"/>';
  }
  function excRear(c) {
    return '<rect x="70" y="176" width="180" height="30" rx="12" fill="#2b3440"/>' +
      '<rect x="80" y="104" width="160" height="74" rx="14" fill="' + c.main + '"/>' +
      '<rect x="80" y="150" width="160" height="28" rx="6" fill="' + c.accent + '"/>' +
      '<rect x="96" y="112" width="24" height="10" rx="3" fill="#f5d76e"/><rect x="200" y="112" width="24" height="10" rx="3" fill="#f5d76e"/>' +
      '<rect x="120" y="64" width="64" height="44" rx="6" fill="' + c.main + '"/><rect x="128" y="72" width="48" height="26" rx="3" fill="#1b2430" opacity=".85"/>';
  }
  function cabin(c, wide) {
    var g = wide ? 150 : 120;
    return '<rect x="60" y="30" width="200" height="170" rx="16" fill="' + c.main + '"/>' +
      '<rect x="' + (160 - g / 2) + '" y="44" width="' + g + '" height="96" rx="8" fill="#9fc2dc"/>' +
      '<rect x="' + (160 - g / 2) + '" y="44" width="10" height="96" fill="' + c.accent + '"/>' +
      '<rect x="' + (150 + g / 2) + '" y="44" width="10" height="96" fill="' + c.accent + '"/>' +
      '<rect x="120" y="150" width="80" height="36" rx="8" fill="' + c.accent + '"/>' +
      '<circle cx="104" cy="164" r="10" fill="#2b3440"/><circle cx="216" cy="164" r="10" fill="#2b3440"/>' +
      '<rect x="178" y="112" width="44" height="26" rx="3" fill="#1b2430"/>';
  }
  function cmf(c) {
    return '<rect x="30" y="40" width="80" height="120" rx="6" fill="' + c.main + '"/>' +
      '<rect x="120" y="40" width="80" height="120" rx="6" fill="' + c.accent + '"/>' +
      '<rect x="210" y="40" width="80" height="120" rx="6" fill="' + c.under + '"/>' +
      '<text x="36" y="180" font-family="sans-serif" font-size="12" fill="#56616f">Main</text>' +
      '<text x="126" y="180" font-family="sans-serif" font-size="12" fill="#56616f">Accent</text>' +
      '<text x="216" y="180" font-family="sans-serif" font-size="12" fill="#56616f">Underbody</text>';
  }
  function whlSide(c) {
    return '<circle cx="90" cy="176" r="30" fill="#2b3440"/><circle cx="230" cy="176" r="30" fill="#2b3440"/>' +
      '<circle cx="90" cy="176" r="12" fill="' + c.accent + '"/><circle cx="230" cy="176" r="12" fill="' + c.accent + '"/>' +
      '<rect x="70" y="118" width="190" height="44" rx="10" fill="' + c.main + '"/>' +
      '<rect x="190" y="92" width="80" height="34" rx="8" fill="' + c.main + '"/>' +
      '<rect x="120" y="54" width="62" height="66" rx="6" fill="' + c.main + '"/><rect x="128" y="62" width="46" height="38" rx="3" fill="#1b2430" opacity=".85"/>' +
      '<polygon points="80,132 30,112 34,100 86,120" fill="' + c.accent + '"/>' +
      '<polygon points="8,96 44,96 44,150 14,146" fill="' + c.main + '"/>';
  }
  function whlFront(c) {
    return '<rect x="60" y="160" width="36" height="46" rx="8" fill="#2b3440"/><rect x="224" y="160" width="36" height="46" rx="8" fill="#2b3440"/>' +
      '<rect x="90" y="110" width="140" height="64" rx="10" fill="' + c.main + '"/>' +
      '<rect x="124" y="54" width="72" height="60" rx="6" fill="' + c.main + '"/><rect x="132" y="62" width="56" height="36" rx="3" fill="#1b2430" opacity=".85"/>' +
      '<rect x="40" y="170" width="240" height="30" rx="4" fill="' + c.accent + '"/>';
  }

  function images(type, c, spec) {
    var list = [];
    if (type === 'Excavator') {
      list.push({ view_type: 'Side', svg: svg(320, 230, excSide(c, spec.wideCab), 'Side') });
      if (spec.views.indexOf('fq') >= 0) list.push({ view_type: 'Front-Quarter', svg: svg(320, 230, excFront(c), 'Front-Quarter') });
      if (spec.views.indexOf('rear') >= 0) list.push({ view_type: 'Rear', svg: svg(320, 230, excRear(c), 'Rear') });
    } else {
      list.push({ view_type: 'Side', svg: svg(320, 230, whlSide(c), 'Side') });
      if (spec.views.indexOf('fq') >= 0) list.push({ view_type: 'Front-Quarter', svg: svg(320, 230, whlFront(c), 'Front-Quarter') });
    }
    if (spec.views.indexOf('cab') >= 0) list.push({ view_type: 'Cabin', svg: svg(320, 230, cabin(c, spec.wideCab), 'Cabin') });
    if (spec.views.indexOf('cmf') >= 0) list.push({ view_type: 'CMF Detail', svg: svg(320, 230, cmf(c), 'CMF Detail') });
    return list.map(function (x, i) {
      return { id: 'img' + (i + 1), view_type: x.view_type, path: '', data: uri(x.svg), media_type: 'image/svg+xml', resolution: '320x230', caption: '예시 도형 이미지' };
    });
  }

  /* 가상 모델 목록. w=운전중량(kg) p=출력(kW) b=버킷(m³) — 모두 시연용 가상 값 */
  var LIST = [
    ['Excavator', 'cat', '예시-EX210', 2024, 21800, 118, 1.0, 0, ['fq', 'rear', 'cab', 'cmf'], true, ['저중심 카운터웨이트', '수평 캐릭터라인', '넓은 글라스'], 20],
    ['Excavator', 'komatsu', '예시-EX215', 2023, 22400, 123, 1.1, 1, ['fq', 'cab', 'cmf'], false, ['라운드 후드', '분할형 사이드커버'], 18],
    ['Excavator', 'volvo', '예시-EX230', 2025, 23500, 129, 1.2, 3, ['fq', 'rear', 'cab'], true, ['슬림 필러', '넓은 글라스', '수평 캐릭터라인'], 12],
    ['Excavator', 'hitachi', '예시-EX220', 2022, 22000, 122, 1.0, 2, ['cab', 'cmf'], false, ['각진 볼륨', '분할형 사이드커버'], 25],
    ['Excavator', 'jcb', '예시-EX220X', 2024, 21900, 129, 1.1, 0, ['fq'], false, ['각진 볼륨', '저중심 카운터웨이트'], 9],
    ['Excavator', 'bobcat', '예시-EX145', 2025, 14800, 86, 0.6, 4, ['fq', 'cab', 'cmf'], true, ['라운드 후드', '넓은 글라스'], 6],
    ['Excavator', 'xcmg', '예시-EX215C', 2023, 21600, 124, 1.0, 5, ['cmf'], false, ['수평 캐릭터라인'], 30],
    ['Excavator', 'sany', '예시-EX215S', 2024, 22100, 118, 1.1, 2, [], false, ['각진 볼륨'], 15],
    ['Excavator', 'kubota', '예시-MX035', 2024, 3600, 18, 0.1, 5, ['fq', 'cab'], false, ['후방 소선회', '라운드 후드'], 10],
    ['Excavator', 'yanmar', '예시-MX030', 2023, 3100, 16, 0.09, 1, ['cmf'], false, ['후방 소선회'], 22],
    ['Wheel Loader', 'cat', '예시-WL950', 2024, 19200, 168, 3.5, 0, ['fq', 'cab', 'cmf'], true, ['후방 경사 후드', '넓은 글라스'], 16],
    ['Wheel Loader', 'volvo', '예시-WL150', 2025, 16800, 150, 3.2, 3, ['fq', 'cab'], true, ['후방 경사 후드', '슬림 필러'], 8],
    ['Wheel Loader', 'komatsu', '예시-WL380', 2023, 18900, 164, 3.4, 1, ['cmf'], false, ['각진 볼륨'], 27],
    ['Wheel Loader', 'liebherr', '예시-WL526', 2024, 15500, 140, 2.9, 4, ['fq'], false, ['라운드 후드'], 14],
    /* 2026-09-29 수강생 요청으로 경쟁사에 Mecalac 추가 — 휠형 굴착기 예시(가상) */
    ['Excavator', 'mecalac', '예시-MW12', 2025, 11900, 85, 0.4, 5, ['fq', 'cab'], true, ['슬림 필러', '넓은 글라스'], 5600]  // 수집 15년 넘음 — 오래된 자료 경고 시연(가상)
  ];

  /* 디자이너 평가 점수(1~5) 예시 — [Exterior, Cabin/HMI, CMF, Service/Safety], 모두 가상 값. null = 미평가 */
  var SCORES = {
    '예시-EX210': [4, 4, 3, 4], '예시-EX215': [3, 3, 3, 4], '예시-EX230': [4, 5, 4, 3], '예시-EX220': [3, 3, 3, 3],
    '예시-EX220X': [5, 3, 3, 3], '예시-EX145': [3, 4, 3, 2], '예시-EX215C': [3, 2, 2, 3], '예시-EX215S': [4, 2, 3, 3],
    '예시-MX035': [3, 3, 3, 4], '예시-MX030': null, '예시-WL950': [4, 4, 3, 4], '예시-WL150': [4, 5, 3, 3],
    '예시-WL380': [3, 3, 3, 3], '예시-WL526': [3, 3, 2, 3], '예시-MW12': [4, 4, 3, 3]
  };

  var FORM = { '저중심 카운터웨이트': 'Low & wide', '라운드 후드': 'Soft round', '각진 볼륨': 'Faceted', '슬림 필러': 'Light & open', '후방 경사 후드': 'Sloped rear', '후방 소선회': 'Compact tail' };

  function build(now) {
    var base = now || new Date();
    var models = LIST.map(function (r, i) {
      var type = r[0], b = L.BRANDS.filter(function (x) { return x.id === r[1]; })[0], c = PAL[r[7]];
      var d = new Date(base.getFullYear(), base.getMonth(), base.getDate() - r[11]);
      var m = {
        id: 'M' + String(i + 1).padStart(4, '0'),
        equipment_type: type, brand: b.name, model_name: r[2], release_year: r[3],
        operating_weight: r[4], engine_power: r[5], bucket_capacity: r[6],
        generation: '예시 세대', product_class: type === 'Excavator' ? 'Crawler' : 'Wheeled',
        powertrain: type === 'Excavator' ? '디젤 (예시)' : '디젤 · 토크컨버터 (예시)',
        dimensions: '', form_language: FORM[r[10][0]] || 'Balanced',
        design_tags: r[10], main_color: c.mainName, accent_color: c.accentName, underbody_color: c.accentName,
        glass_area: r[9] ? '넓음(전면 일체형)' : '보통', pillar_design: r[9] ? '슬림 A필러' : '일반 A필러',
        visibility: r[9] ? '전방·측방 양호' : '측방 보통',
        material: '도장 강판 · 플라스틱 커버(예시)', finish: '솔리드 도장(예시)', gloss: i % 2 ? '반광' : '유광',
        maintenance_access: i % 3 ? '측면 지상 점검' : '측면 + 상부 점검',
        source_type: i % 4 === 3 ? '공식 Press/Exhibition' : 'OEM 공식',
        source_reliability: i % 4 === 3 ? '2 공식 Press/Exhibition' : '1 공식 OEM',
        publisher: '예시 출처',
        source_url: 'https://example.com/sample/' + r[2].toLowerCase(),
        collected_at: L.toDateStr(d),
        obs_origin: '디자이너 입력', human_review_status: i % 3 === 0 ? '확정' : '미검토',
        entered_by: '예시 입력자', reviewer_note: '예시 데이터 — 실제 제품이 아닙니다',
        media: images(type, c, { views: r[8], wideCab: r[9] })
      };
      var sc = SCORES[r[2]];
      if (sc) L.SCORE_AXES.forEach(function (a, k) { m[a.key] = sc[k]; });
      if (r[1] === 'mecalac') m.product_class = 'Wheeled';
      return m;
    });
    /* 필수 메타 점검 시연: 일부 칸을 비워 둡니다 */
    models[7].source_url = '';                 // Sany 예시 — Source URL 없음
    models[6].collected_at = '';               // XCMG 예시 — 수집일 없음
    models[13].media = [];                     // Liebherr 예시 — 이미지 없음
    var db = L.emptyDb();
    db.models = models.map(function (m) { var c = L.cleanModel(m); c.id = m.id; return c; });
    var sc = L.assignScope([], {
      equipment_type: 'Excavator', tonnage_class: 'MED',
      brands: ['Caterpillar (CAT)', 'Komatsu', 'Volvo CE', 'Hitachi Construction Machinery', 'JCB', 'Bobcat'],
      purposes: ['Exterior', 'Trend']
    }, base);
    db.scopes = [sc.scope];
    db.activeScope = sc.scope.scope_id;
    db._sample = true;
    /* 운영 루프 시연: 주간 주기(2026-09-29 오후 수강생 답변), 한 주 전 갱신 기록 1건 */
    var weekAgo = L.toDateStr(new Date(base.getFullYear(), base.getMonth(), base.getDate() - 7));
    db.ops = L.restoreOps({ cycle: 'weekly', stale_days: L.STALE_DAYS_DEFAULT, defaults: 2, last_update: weekAgo,
      history: [{ date: weekAgo, cycle: 'weekly', steps_done: ['collect', 'qa'], note: '예시 — 1차 수집', models: 14 }] });
    return db;
  }

  /* 엑셀 가져오기 시연용: 열 이름이 스키마와 다른 「사내 정리표」 모양(가상) */
  function importSheet() {
    return [
      ['브랜드', '모델명', '장비군', '톤급', '운전중량(t)', '엔진출력(hp)', '버킷용량(m3)', '출시연도', '출처URL', '수집일', '이미지경로', '뷰', '비고'],
      ['CAT', '예시-EX330', '굴착기', 'Medium', 30.5, 204, 1.6, 2025, 'https://example.com/sample/ex330', '2026.09.10', 'images/예시-EX330_side.jpg', '측면', '예시 데이터'],
      ['Komatsu', '예시-EX360', 'Excavator', 'Large', 36.2, 271, 1.9, 2024, 'https://example.com/sample/ex360', '2026-09-12', 'images/예시-EX360_side.jpg; images/예시-EX360_side2.jpg', 'Side', '예시 데이터'],
      ['Volvo', '예시-WL120', '휠로더', '', 12.8, '', 2.3, 2023, '', '2026-09-15', '', '', '예시 데이터 — 출처·이미지 없음'],
      ['Kobelco', '예시-EX170', 'Excavator', '', 17.1, 100, 0.7, 2025, 'https://example.com/sample/ex170', '2026-09-18', 'images/예시-EX170_fq.jpg', '사선 전면', '예시 데이터'],
      ['', '예시-이름만', 'Excavator', '', '', '', '', '', '', '', '', '', '브랜드 없음 — 건너뜀']
    ];
  }

  return { build: build, importSheet: importSheet };
});
