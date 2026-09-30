/* Design Benchmarking Agent — 화면
   화면 목록(기획서 5장 MVP): Scope Setup · Status Dashboard · Card Gallery · Side-by-Side · 자료 등록 · Detail · 가져오기/내보내기
   2026-09-29 추가: 07 Insight · 08 Benchmarking Report · 09 전문가 피드백 · 10 운영 루프 */
(function () {
  'use strict';
  var L = window.DBLogic, S = window.DBStore, Sample = window.DBSample;
  var db = S.loadDb();
  var main = document.getElementById('main');

  /* ── 작은 도구 ───────────────────────── */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    });
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { append(el, x); }); return; }
    el.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
  }
  function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
  function save() {
    var ok = S.saveDb(db);
    if (!ok) toast(S.lastError() === 'quota'
      ? '브라우저 저장 공간이 가득 찼습니다. 이번 창에는 남아 있지만 새로고침하면 사라질 수 있으니 「가져오기·내보내기」에서 JSON 백업을 받아 두세요.'
      : '이 브라우저는 저장소를 막고 있어 이번 창에만 보관됩니다. JSON 백업을 받아 두세요.', true);
    renderChrome();
    return ok;
  }
  var toastTimer;
  function toast(msg, isError) {
    var el = document.getElementById('toast');
    el.textContent = msg; el.className = 'toast' + (isError ? ' error' : ''); el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, isError ? 6000 : 3000);
  }
  function dialog(title, content, buttons) {
    var dlg = document.getElementById('dialog');
    document.getElementById('dialogTitle').textContent = title;
    var c = document.getElementById('dialogContent'); c.innerHTML = ''; append(c, content);
    var a = document.getElementById('dialogActions'); a.innerHTML = '';
    (buttons || [{ label: '닫기' }]).forEach(function (b) {
      a.appendChild(h('button', {
        class: 'btn' + (b.primary ? ' btn-primary' : '') + (b.danger ? ' btn-danger' : ''), value: 'close',
        onclick: b.onClick ? function (e) { e.preventDefault(); dlg.close(); b.onClick(); } : null
      }, b.label));
    });
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  }
  function confirmBox(title, msg, okLabel, onOk, danger) {
    dialog(title, h('p', null, msg), [{ label: '취소' }, { label: okLabel, primary: !danger, danger: danger, onClick: onOk }]);
  }
  function download(name, blob) {
    var a = h('a', { href: URL.createObjectURL(blob), download: name });
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function stamp() { var d = new Date(); return L.toDateStr(d).replace(/-/g, ''); }
  function fileTag() { return db._sample ? '_예시데이터' : ''; }
  function modelById(id) { return db.models.filter(function (m) { return m.id === id; })[0] || null; }
  function scopeNow() { return L.activeScope(db); }
  function tonName(m) { var c = L.tonnageClass(m.equipment_type, m.tonnage_class); return c ? c.name : (m.tonnage_class || '톤급 미지정'); }
  function firstImage(m, prefer) {
    var list = m.media || [];
    return (prefer && list.filter(function (x) { return x.view_type === prefer; })[0]) ||
      list.filter(function (x) { return x.view_type === 'Side'; })[0] || list[0] || null;
  }
  function imgEl(x, alt) {
    if (!x) return '이미지 없음';
    if (x.data) return h('img', { src: x.data, alt: alt || '', loading: 'lazy' });
    /* 2026-09-30 — 공개 웹의 이미지 주소(http/https)를 경로로 적으면 그 주소에서 바로 보여 줍니다(인터넷 연결 필요). 막히면 주소만 표시 */
    if (/^https?:\/\//i.test(x.path || '')) {
      var im = h('img', { src: x.path, alt: alt || '', loading: 'lazy', referrerpolicy: 'no-referrer' });
      im.addEventListener('error', function () { im.replaceWith(h('span', null, '이미지 주소(열리지 않음): ' + x.path)); });
      return im;
    }
    return h('span', null, '경로 등록: ' + x.path);
  }
  function specLine(m) {
    var out = [];
    if (m.operating_weight !== '') out.push(L.formatNum(Math.round(m.operating_weight / 100) / 10) + ' t');
    if (m.engine_power !== '') out.push(L.formatNum(m.engine_power) + ' kW');
    if (m.bucket_capacity !== '') out.push(L.formatNum(m.bucket_capacity) + ' m³');
    if (m.release_year !== '') out.push(m.release_year + '년');
    return out.join(' · ') || '제원 미입력';
  }
  function pageHead(stage, title, lead, tools) {
    return h('div', { class: 'page-head' },
      h('div', { class: 'titles' }, h('div', { class: 'stage' }, stage), h('h1', null, title), lead ? h('p', { class: 'lead' }, lead) : null),
      tools || null);
  }
  function selectEl(name, options, value, emptyLabel) {
    var s = h('select', { name: name });
    if (emptyLabel != null) s.appendChild(h('option', { value: '' }, emptyLabel));
    options.forEach(function (o) {
      var v = typeof o === 'object' ? o.value : o, t = typeof o === 'object' ? o.label : o;
      var opt = h('option', { value: v }, t);
      if (String(v) === String(value == null ? '' : value)) opt.selected = true;
      s.appendChild(opt);
    });
    return s;
  }
  function field(label, control, opts) {
    opts = opts || {};
    return h('label', { class: 'field' + (opts.span ? ' span-all' : ''), 'data-field': opts.key || null },
      h('span', null, label, opts.req ? h('span', { class: 'req', 'aria-hidden': 'true' }, '*') : null), control,
      opts.hint ? h('small', { class: 'hint' }, opts.hint) : null);
  }

  /* ── 머리·메뉴 ───────────────────────── */
  var NAV = [
    ['#/scope', '01', 'Scope Setup', 'Benchmark 범위 설정'],
    ['#/dashboard', '02', 'Status Dashboard', '보유 자료 현황'],
    ['#/gallery', '03', 'Card Gallery', '이미지·스펙 탐색'],
    ['#/compare', '04', 'Side-by-Side', '모델 비교·비교표'],
    ['#/edit', '05', '자료 등록', '표준 Schema 입력'],
    ['#/data', '06', '가져오기·내보내기', '엑셀·CSV·백업'],
    ['#/insight', '07', 'Insight', '요약·점수·강약점'],
    ['#/report', '08', 'Benchmarking Report', '인쇄·PDF·xlsx·HTML'],
    ['#/feedback', '09', '전문가 피드백', '항목별 평가·코멘트'],
    ['#/ops', '10', '운영 루프', '정기 업데이트·신선도']
  ];
  function renderChrome(route) {
    route = route || location.hash || '#/scope';
    var nav = document.getElementById('nav'); nav.innerHTML = '';
    var openFb = (db.feedback || []).filter(function (x) { return x.status !== '반영됨'; }).length;
    var ost = db.models.length ? opsNow() : null;
    var opsBadge = !ost ? '' : ost.state === 'overdue' ? '예정일 ' + (-ost.daysLeft) + '일 지남' : ost.state === 'due' ? '오늘 업데이트 예정' : ost.stale.length ? '오래된 자료 ' + ost.stale.length + '건' : '';
    NAV.forEach(function (n) {
      var cur = route === n[0] || route.indexOf(n[0] + '/') === 0 || (n[0] === '#/gallery' && route.indexOf('#/model/') === 0);
      nav.appendChild(h('a', { href: n[0], 'aria-current': cur ? 'page' : null },
        h('span', { class: 'no' }, n[1]), h('span', { class: 't' }, n[2]), h('span', { class: 's' }, n[3]),
        n[0] === '#/compare' && db.compare.length ? h('span', { class: 's' }, '비교함 ' + db.compare.length + '/' + L.MAX_COMPARE) : null,
        n[0] === '#/feedback' && openFb ? h('span', { class: 's' }, '열림 ' + openFb + '건') : null,
        n[0] === '#/ops' && opsBadge ? h('span', { class: 's badge-warn' }, opsBadge) : null));
    });
    var chip = document.getElementById('scopeChip'); chip.innerHTML = '';
    var sc = scopeNow();
    if (sc) {
      var tc = L.tonnageClass(sc.equipment_type, sc.tonnage_class);
      append(chip, [h('span', null, 'Scope · ' + sc.scope_id), h('span', { class: 'dim' }, sc.equipment_type + ' · ' + (tc ? tc.name.replace(/ (Excavator|Wheel Loader)$/, '') + ' ' + tc.range : sc.tonnage_class) + ' · ' + sc.brands.length + ' Brands')]);
    } else append(chip, [h('span', null, 'Scope 미지정'), h('span', { class: 'dim' }, '전체 자료 보기')]);
    document.getElementById('storeNote').textContent = '모델 ' + db.models.length + '건 · 저장 ' + S.sizeKb() + 'KB' + (S.available() ? '' : ' · 메모리에만 보관 중');
    document.getElementById('schemaVer').textContent = L.SCHEMA_VERSION;
    var ban = document.getElementById('sampleBanner');
    ban.hidden = !db._sample; ban.innerHTML = '';
    if (db._sample) append(ban, [h('strong', null, '예시 데이터'), ' — 모델명(「예시-」)·제원·색·출처·이미지는 모두 시연용 가상 값입니다. 브랜드 이름만 부록 B 목록을 빌렸고, 그 회사의 실제 제품 정보가 아닙니다. ',
      h('a', { href: '#/data' }, '예시 데이터 지우기')]);
  }

  /* ── 01 Scope Setup ─────────────────── */
  var scopeDraft = null;
  function defaultDraft() {
    var sc = scopeNow();
    if (sc) return { equipment_type: sc.equipment_type, tonnage_class: sc.tonnage_class, brands: sc.brands.slice(), purposes: sc.purposes.slice() };
    return { equipment_type: 'Excavator', tonnage_class: '', brands: [], purposes: [] };
  }
  function viewScope() {
    if (!scopeDraft) scopeDraft = defaultDraft();
    var d = scopeDraft;
    var product = L.productByName(d.equipment_type);
    var avail = L.brandAvailability(db.models, d.equipment_type, d.tonnage_class);

    var seg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Product Type' }, L.PRODUCTS.map(function (p) {
      return h('label', { class: 'opt' }, h('input', {
        type: 'radio', name: 'equipment_type', value: p.name, checked: p.name === d.equipment_type,
        onchange: function () { d.equipment_type = p.name; d.tonnage_class = ''; render(); }
      }), h('span', null, h('span', { class: 't' }, p.name), h('span', { class: 's' }, p.classes.length + '단계 Tonnage')));
    }));
    var ton = h('div', { class: 'opt-grid', role: 'radiogroup', 'aria-label': 'Tonnage' }, product.classes.map(function (c) {
      return h('label', { class: 'opt' }, h('input', {
        type: 'radio', name: 'tonnage_class', value: c.code, checked: c.code === d.tonnage_class,
        onchange: function () { d.tonnage_class = c.code; render(); }
      }), h('span', null, h('span', { class: 't' }, c.name.replace(/ (Excavator|Wheel Loader)$/, '')), h('span', { class: 's' }, c.range + ' · ' + c.note)));
    }));
    var brands = h('div', { class: 'opt-grid' }, L.BRANDS.map(function (b) {
      var n = avail[b.name];
      return h('label', { class: 'opt' }, h('input', {
        type: 'checkbox', name: 'brand', value: b.name, checked: d.brands.indexOf(b.name) >= 0,
        onchange: function (e) {
          if (e.target.checked) { if (d.brands.indexOf(b.name) < 0) d.brands.push(b.name); }
          else d.brands = d.brands.filter(function (x) { return x !== b.name; });
          updateSummary();
        }
      }), h('span', null, h('span', { class: 't' }, b.short), h('span', { class: 's' }, b.hq),
        h('span', { class: 'avail' + (n ? '' : ' zero') }, d.tonnage_class ? '이 범위 보유 ' + n + '건' : '톤급 선택 전')));
    }));
    var purposes = h('div', { class: 'opt-grid' }, L.PURPOSES.map(function (p) {
      return h('label', { class: 'opt' }, h('input', {
        type: 'checkbox', name: 'purpose', value: p.name, checked: d.purposes.indexOf(p.name) >= 0,
        onchange: function (e) {
          if (e.target.checked) { if (d.purposes.indexOf(p.name) < 0) d.purposes.push(p.name); }
          else d.purposes = d.purposes.filter(function (x) { return x !== p.name; });
          updateSummary();
        }
      }), h('span', null, h('span', { class: 't' }, p.name), h('span', { class: 's' }, p.desc)));
    }));
    function setAll(on) {
      d.brands = on ? L.BRANDS.map(function (b) { return b.name; }) : [];
      brands.querySelectorAll('input').forEach(function (i) { i.checked = on; });
      updateSummary();
    }

    var summary = h('dl', { class: 'summary' });
    var idBox = h('div', { class: 'scope-id', 'aria-live': 'polite' });
    var errBox = h('div');
    function updateSummary() {
      summary.innerHTML = '';
      var tc = L.tonnageClass(d.equipment_type, d.tonnage_class);
      [['Product', d.equipment_type], ['Tonnage', tc ? tc.name + ' (' + tc.range + ')' : '선택 전'],
        ['Brands', d.brands.length ? d.brands.length + '개 — ' + d.brands.map(L.brandShort).join(', ') : '선택 전'],
        ['Purpose', d.purposes.length ? d.purposes.join(' + ') : '선택 전']].forEach(function (r) {
        summary.appendChild(h('dt', null, r[0])); summary.appendChild(h('dd', null, r[1]));
      });
      var errs = L.validateScope(d);
      idBox.textContent = errs.length ? 'Scope ID — 4개 항목을 모두 고르면 만들어집니다' : L.baseScopeId(d);
      var zero = d.tonnage_class ? d.brands.filter(function (b) { return !avail[b]; }) : [];
      errBox.innerHTML = '';
      if (zero.length) errBox.appendChild(h('p', { class: 'alert info' }, '이 범위에 아직 자료가 없는 브랜드: ' + zero.map(L.brandShort).join(', ') + '. 선택은 그대로 유지하며, 현황표에 0건으로 표시됩니다.'));
    }
    updateSummary();

    function confirmScope() {
      var res = L.assignScope(db.scopes, d, new Date());
      if (!res.ok) {
        var names = { equipment_type: 'Product Type', tonnage_class: 'Tonnage', brands: '경쟁사(1개 이상)', purposes: 'Benchmark Purpose' };
        toast('먼저 고르세요: ' + res.errors.map(function (e) { return names[e]; }).join(', '), true);
        return;
      }
      if (!res.reused) db.scopes.push(res.scope);
      db.activeScope = res.scope.scope_id;
      save();
      toast((res.reused ? '저장된 Scope 를 다시 적용했습니다: ' : 'Scope 를 만들었습니다: ') + res.scope.scope_id);
      go('#/dashboard');
    }

    var saved = db.scopes.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'list' },
      h('thead', null, h('tr', null, ['Scope ID', 'Product', 'Tonnage', 'Brands', 'Purpose', '만든 날', ''].map(function (t) { return h('th', { scope: 'col' }, t); }))),
      h('tbody', null, db.scopes.map(function (s) {
        var tc = L.tonnageClass(s.equipment_type, s.tonnage_class);
        var active = s.scope_id === db.activeScope;
        return h('tr', null,
          h('td', null, h('strong', null, s.scope_id), active ? h('span', { class: 'tag ok', style: 'margin-left:6px' }, '적용 중') : null),
          h('td', null, s.equipment_type), h('td', null, tc ? tc.name : s.tonnage_class),
          h('td', null, s.brands.map(L.brandShort).join(', ')), h('td', null, s.purposes.join(' + ')), h('td', null, s.created_at),
          h('td', null, h('div', { class: 'btn-row' },
            h('button', { type: 'button', class: 'btn btn-sm', disabled: active, onclick: function () { db.activeScope = s.scope_id; scopeDraft = null; save(); render(); } }, '적용'),
            h('button', { type: 'button', class: 'btn btn-sm btn-danger', onclick: function () {
              confirmBox('Scope 삭제', s.scope_id + ' 를 목록에서 지웁니다. 등록한 모델 자료는 지워지지 않습니다.', '삭제', function () {
                db.scopes = db.scopes.filter(function (x) { return x !== s; });
                if (active) db.activeScope = '';
                scopeDraft = null; save(); render();
              }, true);
            } }, '삭제'))));
      })))) : h('p', { class: 'note' }, '아직 저장한 Scope 가 없습니다.');

    return [
      pageHead('STAGE 01', 'Scope Setup', 'Benchmark 범위를 정합니다. Product Type → Tonnage → 경쟁사 → 목적을 고르면 Scope ID 가 만들어지고, 현황·갤러리·비교가 이 범위로 좁혀집니다.'),
      h('div', { class: 'grid-2' },
        h('section', { class: 'card' },
          h('h2', null, '① Product / Tonnage / Competitor'),
          h('h3', null, 'Product Type'), seg,
          h('h3', { style: 'margin-top:16px' }, 'Tonnage ', h('small', { class: 'note' }, '— 부록 C, 운전중량 기준')), ton,
          h('div', { class: 'page-head', style: 'margin:16px 0 8px' },
            h('h3', { class: 'titles', style: 'margin:0' }, 'Competitor brands ', h('small', { class: 'note' }, '— 부록 B ' + (L.BRANDS.length - 1) + '개사 + Mecalac, 총 ' + L.BRANDS.length + '개사 중 1개 이상')),
            h('div', { class: 'btn-row' },
              h('button', { type: 'button', class: 'btn btn-sm', onclick: function () { setAll(true); } }, '전체 선택'),
              h('button', { type: 'button', class: 'btn btn-sm', onclick: function () { setAll(false); } }, '전체 해제'))),
          brands),
        h('div', null,
          h('section', { class: 'card' }, h('h2', null, '② Benchmark Purpose'), purposes),
          h('section', { class: 'card' },
            h('h2', null, 'Generated Scope'), summary,
            h('p', { style: 'margin:12px 0 0' }, idBox),
            h('p', { class: 'note' }, 'ID 형식(가정): 장비군-톤급-브랜드 수-목적 코드. 목적 코드 X Exterior · C Cabin · M CMF · T Trend · V Serviceability · S Safety · F Full. 같은 형식인데 브랜드 구성이 다르면 끝에 -2, -3 을 붙입니다.'),
            errBox,
            h('div', { class: 'btn-row' },
              h('button', { type: 'button', class: 'btn btn-primary btn-big', onclick: confirmScope }, '범위 확정 → Benchmark 시작'),
              db.activeScope ? h('button', { type: 'button', class: 'btn', onclick: function () { db.activeScope = ''; scopeDraft = null; save(); toast('Scope 를 해제했습니다. 전체 자료를 봅니다.'); render(); } }, 'Scope 해제(전체 보기)') : null)))),
      h('section', { class: 'card' }, h('h2', null, '저장한 Scope'), saved),
      localUseCard()
    ];
  }

  /* ── 02 Status Dashboard ─────────────── */
  var dashState = { equipment_type: '', scopeBrands: true };
  function viewDashboard() {
    var sc = scopeNow();
    var et = dashState.equipment_type || (sc ? sc.equipment_type : 'Excavator');
    var useScopeBrands = sc && dashState.scopeBrands && sc.equipment_type === et;
    var mx = L.statusMatrix(db.models, et, useScopeBrands ? sc.brands : null);
    var list = db.models.filter(function (m) { return m.equipment_type === et && (!useScopeBrands || sc.brands.indexOf(m.brand) >= 0); });
    var latest = mx.totals.latest || '-';

    var tools = h('div', { class: 'btn-row' },
      h('label', { class: 'field' }, h('span', { class: 'sr' }, '장비군'), selectEl('et', L.PRODUCTS.map(function (p) { return p.name; }), et)),
      sc && sc.equipment_type === et ? h('label', { class: 'opt', style: 'min-height:44px;align-items:center' }, h('input', {
        type: 'checkbox', checked: dashState.scopeBrands, onchange: function (e) { dashState.scopeBrands = e.target.checked; render(); }
      }), h('span', { class: 't' }, 'Scope 브랜드만')) : null);
    tools.querySelector('select').addEventListener('change', function (e) { dashState.equipment_type = e.target.value; render(); });

    var tiles = h('div', { class: 'tiles' },
      [['모델', mx.totals.models + '건'], ['이미지', mx.totals.images + '장'], ['필수 메타 누락', mx.totals.incomplete + '건'], ['최근 수집일', latest]].map(function (t) {
        return h('div', { class: 'tile' }, h('div', { class: 'k' }, t[0]), h('div', { class: 'v' }, t[1]));
      }));

    var hasUnknown = mx.rows.some(function (r) { return r.cells[''].models; });
    var classes = mx.product.classes.filter(function () { return true; });
    function heat(n) { return n >= 3 ? 'heat-3' : n === 2 ? 'heat-2' : n === 1 ? 'heat-1' : 'zero'; }
    var matrix = h('div', { class: 'table-wrap' }, h('table', { class: 'list' },
      h('thead', null, h('tr', null, h('th', { scope: 'col' }, '브랜드'),
        classes.map(function (c) {
          var on = sc && sc.equipment_type === et && sc.tonnage_class === c.code;
          return h('th', { scope: 'col', class: 'num', style: on ? 'background:#d9e7fb' : null }, c.name.replace(/ (Excavator|Wheel Loader)$/, ''), h('br'), h('small', { class: 'note' }, c.range));
        }),
        hasUnknown ? h('th', { scope: 'col', class: 'num' }, '톤급 미지정') : null,
        h('th', { scope: 'col', class: 'num' }, '합계'), h('th', { scope: 'col' }, '최근 수집일'))),
      h('tbody', null, mx.rows.map(function (r) {
        return h('tr', null, h('th', { scope: 'row' }, L.brandShort(r.brand), L.brandInUniverse(r.brand) ? null : h('span', { class: 'tag muted', style: 'margin-left:6px' }, '목록 외')),
          classes.map(function (c) { var x = r.cells[c.code]; return h('td', { class: 'num ' + heat(x.models) }, x.models ? x.models + ' / ' + x.images + '장' : '0'); }),
          hasUnknown ? h('td', { class: 'num ' + heat(r.cells[''].models) }, r.cells[''].models ? r.cells[''].models + ' / ' + r.cells[''].images + '장' : '0') : null,
          h('td', { class: 'num' }, r.models + ' / ' + r.images + '장'), h('td', { class: 'num' }, r.latest || '-'));
      }))));

    var views = L.VIEWS;
    var viewTable = h('div', { class: 'table-wrap' }, h('table', { class: 'list' },
      h('thead', null, h('tr', null, h('th', { scope: 'col' }, '브랜드'), views.map(function (v) { return h('th', { scope: 'col', class: 'num' }, v); }), h('th', { scope: 'col', class: 'num' }, '누락 모델'))),
      h('tbody', null, mx.rows.map(function (r) {
        return h('tr', null, h('th', { scope: 'row' }, L.brandShort(r.brand)),
          views.map(function (v) { return h('td', { class: 'num ' + (r.views[v] ? '' : 'zero') }, r.views[v] ? String(r.views[v]) : '-'); }),
          h('td', { class: 'num' + (r.incomplete ? '' : ' zero') }, String(r.incomplete)));
      }))));

    var targets = list;
    var bad = targets.filter(function (m) { return !L.completeness(m).ok || L.tonnageMismatch(m); });
    var sum = L.missingSummary(targets);
    var qa = h('div', null,
      h('p', { class: 'note' }, '필수 필드(제출 기획서 12절 Data Completeness): ' + L.REQUIRED.map(function (r) { return r.label + ' ' + sum[r.key] + '건 누락'; }).join(' · ')),
      bad.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'list' },
        h('thead', null, h('tr', null, ['모델', '브랜드', '누락 필드', '확인할 점', ''].map(function (t) { return h('th', { scope: 'col' }, t); }))),
        h('tbody', null, bad.map(function (m) {
          var mm = L.tonnageMismatch(m), c = mm ? L.tonnageClass(m.equipment_type, mm) : null;
          return h('tr', null, h('td', null, h('a', { href: '#/model/' + m.id }, m.model_name)), h('td', null, L.brandShort(m.brand)),
            h('td', null, L.missingFields(m).map(function (k) { return L.REQUIRED.filter(function (r) { return r.key === k; })[0].label; }).join(', ') || '-'),
            h('td', null, c ? '운전중량 기준으로는 ' + c.name + ' — 톤급 확인' : '-'),
            h('td', null, h('a', { class: 'btn btn-sm', href: '#/edit/' + m.id }, '보완')));
        })))) : h('p', { class: 'alert info' }, '이 장비군의 모든 모델이 필수 메타를 갖췄습니다.'));

    return [
      pageHead('STAGE 02', 'Status Dashboard', '브랜드 × Tonnage 별 보유 모델·이미지 수, View 보유 현황, 필수 메타 누락을 봅니다. 칸 값은 「모델 수 / 이미지 수」입니다.', tools),
      db.models.length ? null : h('p', { class: 'alert info' }, '아직 등록한 자료가 없습니다. 「자료 등록」이나 「가져오기·내보내기」에서 자료를 넣거나, 예시 데이터를 불러와 보세요.'),
      tiles,
      h('section', { class: 'card' }, h('h2', null, '브랜드 × Tonnage 보유 현황 (' + et + ')'), matrix),
      h('section', { class: 'card' }, h('h2', null, 'View 보유 현황 (이미지 장수)'), viewTable),
      h('section', { class: 'card' }, h('h2', null, '필수 메타 점검'), qa)
    ];
  }

  /* ── 03 Card Gallery ─────────────────── */
  var galState = { useScope: true, equipment_type: '', tonnage_class: '', brand: '', year_from: '', year_to: '', view: '', q: '', incomplete: false, review: '' };
  function toggleCompareId(id) {
    var r = L.toggleCompare(db.compare, id);
    if (!r.ok) { toast('비교는 최대 ' + L.MAX_COMPARE + '개까지입니다. 먼저 하나를 빼 주세요.', true); return false; }
    db.compare = r.list; save(); return true;
  }
  function viewGallery() {
    var sc = scopeNow();
    var f = galState;
    var filter = {
      scope: sc && f.useScope ? sc : null, equipment_type: f.equipment_type, tonnage_class: f.tonnage_class, brand: f.brand,
      year_from: f.year_from, year_to: f.year_to, view: f.view, q: f.q, incomplete: f.incomplete, review: f.review
    };
    var list = L.filterModels(db.models, filter);
    var brandsInDb = db.models.map(function (m) { return m.brand; }).filter(function (b, i, a) { return b && a.indexOf(b) === i; });
    var brandOpts = L.BRANDS.map(function (b) { return b.name; }).filter(function (b) { return brandsInDb.indexOf(b) >= 0; })
      .concat(brandsInDb.filter(function (b) { return !L.brandInUniverse(b); }));
    var etForTon = f.equipment_type || (sc && f.useScope ? sc.equipment_type : '');
    var tonOpts = etForTon ? L.productByName(etForTon).classes.map(function (c) { return { value: c.code, label: c.name }; }) : [];

    var form = h('form', { class: 'filters', onsubmit: function (e) { e.preventDefault(); } },
      sc ? h('label', { class: 'opt', style: 'align-self:end' }, h('input', { type: 'checkbox', name: 'useScope', checked: f.useScope }), h('span', { class: 't' }, 'Scope 적용 (' + sc.scope_id + ')')) : null,
      field('장비군', selectEl('equipment_type', L.PRODUCTS.map(function (p) { return p.name; }), f.equipment_type, '전체')),
      field('톤급', selectEl('tonnage_class', tonOpts, f.tonnage_class, etForTon ? '전체' : '장비군 선택 후')),
      field('브랜드', selectEl('brand', brandOpts.map(function (b) { return { value: b, label: L.brandShort(b) }; }), f.brand, '전체')),
      field('연식 부터', h('input', { name: 'year_from', type: 'number', inputmode: 'numeric', value: f.year_from, placeholder: '예: 2022' })),
      field('연식 까지', h('input', { name: 'year_to', type: 'number', inputmode: 'numeric', value: f.year_to })),
      field('보유 View', selectEl('view', L.VIEWS, f.view, '전체')),
      field('검증 상태', selectEl('review', L.REVIEW_STATUS, f.review, '전체')),
      field('검색어', h('input', { name: 'q', type: 'search', value: f.q, placeholder: '모델명·태그·색' })),
      h('label', { class: 'opt', style: 'align-self:end' }, h('input', { type: 'checkbox', name: 'incomplete', checked: f.incomplete }), h('span', { class: 't' }, '누락 있는 것만')));
    form.addEventListener('change', function (e) {
      var el = e.target;
      galState[el.name] = el.type === 'checkbox' ? el.checked : el.value;
      if (el.name === 'equipment_type') galState.tonnage_class = '';
      render();
    });
    form.addEventListener('input', function (e) {
      if (e.target.name !== 'q') return;
      galState.q = e.target.value;
      clearTimeout(viewGallery.t);
      viewGallery.t = setTimeout(function () { render(); var q = main.querySelector('input[name=q]'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }, 300);
    });

    var cards = list.length ? h('div', { class: 'gallery' }, list.map(function (m) {
      var picked = db.compare.indexOf(m.id) >= 0;
      var comp = L.completeness(m);
      var img = firstImage(m, f.view);
      return h('article', { class: 'mcard' + (picked ? ' picked' : '') },
        h('a', { class: 'img', href: '#/model/' + m.id, 'aria-label': m.model_name + ' 상세' }, imgEl(img, m.model_name + ' ' + (img ? img.view_type : ''))),
        h('div', { class: 'bd' },
          h('div', { class: 'nm' }, h('a', { href: '#/model/' + m.id }, L.brandShort(m.brand) + ' ' + m.model_name)),
          h('div', { class: 'spec' }, specLine(m)),
          h('div', { class: 'tags' },
            h('span', { class: 'tag' }, m.equipment_type || '장비군 미지정'), h('span', { class: 'tag muted' }, tonName(m)),
            (m.design_tags || []).slice(0, 3).map(function (t) { return h('span', { class: 'tag muted' }, t); }),
            comp.ok ? null : h('span', { class: 'tag warn' }, '누락 ' + comp.missing.length))),
        h('div', { class: 'ft' },
          h('button', { type: 'button', class: 'btn btn-sm' + (picked ? ' btn-primary' : ''), 'aria-pressed': picked ? 'true' : 'false',
            onclick: function () { if (toggleCompareId(m.id)) render(); } }, picked ? '비교에서 빼기' : '비교에 담기'),
          h('a', { class: 'btn btn-sm', href: '#/edit/' + m.id }, '수정')));
    })) : h('p', { class: 'empty' }, db.models.length ? '조건에 맞는 모델이 없습니다. 필터를 풀거나 Scope 적용을 꺼 보세요.' : '등록한 자료가 없습니다.');

    return [
      pageHead('STAGE 03', 'Card Gallery', '이미지 Grid 와 핵심 스펙·태그를 보고, 비교할 모델을 2~4개 담습니다.',
        h('div', { class: 'btn-row' },
          h('a', { class: 'btn btn-primary', href: '#/compare' }, 'Side-by-Side (' + db.compare.length + '/' + L.MAX_COMPARE + ')'),
          h('a', { class: 'btn', href: '#/edit' }, '자료 등록'))),
      h('section', { class: 'card' }, form, h('p', { class: 'note', style: 'margin:10px 0 0' }, list.length + '건 표시 / 전체 ' + db.models.length + '건')),
      cards
    ];
  }

  /* ── 04 Side-by-Side + 비교표 내보내기 ── */
  var cmpState = { hideEmpty: true, diffOnly: false };
  function viewCompare() {
    var models = db.compare.map(modelById).filter(Boolean);
    var sc = scopeNow();
    if (models.length < 2) {
      return [
        pageHead('STAGE 04', 'Side-by-Side', '선택 모델 2~4개의 이미지(같은 View 끼리)·CMF·Cabin·Spec 을 나란히 비교합니다.'),
        h('div', { class: 'card empty' },
          h('p', null, '비교함에 ' + models.length + '개가 있습니다. Card Gallery 에서 2개 이상 담아 주세요.'),
          h('a', { class: 'btn btn-primary', href: '#/gallery' }, 'Card Gallery 로 가기'))
      ];
    }
    var n = models.length;
    var head = h('div', { class: 'sbs-row', style: '--n:' + n },
      h('div', { class: 'lab' }, '모델'),
      models.map(function (m) {
        return h('div', { class: 'sbs-cell' }, h('div', { class: 'cap' }, h('a', { href: '#/model/' + m.id }, L.brandShort(m.brand) + ' ' + m.model_name)),
          h('div', { class: 'cap note', style: 'font-weight:400' }, tonName(m) + ' · ' + specLine(m)),
          h('div', { class: 'cap no-print' }, h('button', { type: 'button', class: 'btn btn-sm', onclick: function () { toggleCompareId(m.id); render(); } }, '비교에서 빼기')));
      }));
    var usedViews = L.VIEWS.filter(function (v) { return models.some(function (m) { return (m.media || []).some(function (x) { return x.view_type === v; }); }); });
    var imgRows = usedViews.map(function (v) {
      return h('div', { class: 'sbs-row', style: '--n:' + n }, h('div', { class: 'lab' }, v),
        models.map(function (m) {
          var x = (m.media || []).filter(function (y) { return y.view_type === v; })[0];
          return h('div', { class: 'sbs-cell' }, h('div', { class: 'img' }, x ? imgEl(x, m.model_name + ' ' + v) : '이 View 없음'));
        }));
    });
    var rows = L.compareRows(models, { hideEmpty: cmpState.hideEmpty });
    if (cmpState.diffOnly) rows = rows.filter(function (r) { return r.differs; });
    var table = h('div', { class: 'table-wrap' }, h('table', { class: 'list' },
      h('thead', null, h('tr', null, h('th', { scope: 'col' }, '블록'), h('th', { scope: 'col' }, '항목'),
        models.map(function (m) { return h('th', { scope: 'col' }, L.brandShort(m.brand) + ' ' + m.model_name); }))),
      h('tbody', null, rows.map(function (r) {
        return h('tr', { class: r.differs ? 'differs' : null }, h('td', { class: 'blk' }, r.block, h('br'), r.kind), h('th', { scope: 'row' }, r.label),
          r.values.map(function (v) { return h('td', null, v || '-'); }));
      }))));

    function exportXlsx() {
      var wb = XLSX.utils.book_new();
      var ws = XLSX.utils.aoa_to_sheet(L.compareSheet(models, sc, { hideEmpty: cmpState.hideEmpty }));
      ws['!cols'] = [{ wch: 16 }, { wch: 16 }, { wch: 24 }].concat(models.map(function () { return { wch: 26 }; })).concat([{ wch: 10 }]);
      XLSX.utils.book_append_sheet(wb, ws, '비교표');
      var src = [['모델', 'Source URL', 'Source Type', 'Publisher', '수집일', 'Reliability', '검증 상태', '이미지']].concat(models.map(function (m) {
        return [L.brandShort(m.brand) + ' ' + m.model_name, m.source_url, m.source_type, m.publisher, m.collected_at, m.source_reliability, m.human_review_status,
          (m.media || []).map(function (x) { return x.view_type + ': ' + (x.path || '(브라우저 보관 이미지)'); }).join('; ')];
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(src), '출처·근거');
      var out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      download('Benchmark_비교표_' + (sc ? sc.scope_id + '_' : '') + stamp() + fileTag() + '.xlsx', new Blob([out], { type: 'application/octet-stream' }));
    }
    function exportCsv() {
      download('Benchmark_비교표_' + stamp() + fileTag() + '.csv', new Blob([L.toCsv(L.compareSheet(models, sc, { hideEmpty: cmpState.hideEmpty }))], { type: 'text/csv;charset=utf-8' }));
    }

    return [
      pageHead('STAGE 04', 'Side-by-Side', '같은 View 끼리 이미지를 맞대고, 제원(FACT)과 관찰(OBSERVATION)을 나누어 비교합니다. 값이 서로 다른 행은 옅은 노란색입니다.',
        h('div', { class: 'btn-row no-print' },
          h('button', { type: 'button', class: 'btn btn-primary', onclick: exportXlsx }, '비교표 Excel 내보내기'),
          h('button', { type: 'button', class: 'btn', onclick: function () { window.print(); } }, '인쇄용 PDF'),
          h('button', { type: 'button', class: 'btn', onclick: exportCsv }, 'CSV'))),
      h('div', { class: 'print-only' }, h('p', null, 'Benchmark 비교표 · ' + (sc ? 'Scope ' + sc.scope_id : 'Scope 미지정') + ' · ' + L.toDateStr(new Date()) + (db._sample ? ' · 예시 데이터(가상)' : ''))),
      h('section', { class: 'card' }, h('h2', null, '이미지 (View 별)'), h('div', { class: 'sbs' }, head, imgRows.length ? imgRows : h('p', { class: 'note' }, '비교할 이미지가 없습니다.'))),
      h('section', { class: 'card' },
        h('div', { class: 'page-head', style: 'margin-bottom:10px' }, h('h2', { class: 'titles', style: 'margin:0' }, '비교표'),
          h('div', { class: 'btn-row no-print' },
            h('label', { class: 'opt' }, h('input', { type: 'checkbox', checked: cmpState.hideEmpty, onchange: function (e) { cmpState.hideEmpty = e.target.checked; render(); } }), h('span', { class: 't' }, '빈 항목 숨기기')),
            h('label', { class: 'opt' }, h('input', { type: 'checkbox', checked: cmpState.diffOnly, onchange: function (e) { cmpState.diffOnly = e.target.checked; render(); } }), h('span', { class: 't' }, '차이만 보기')))),
        table)
    ];
  }

  /* ── Detail / Evidence ───────────────── */
  function kvList(m, keys) {
    var dl = h('dl', { class: 'kvs' });
    keys.forEach(function (f) {
      var v = L.displayValue(m, f);
      dl.appendChild(h('dt', null, f.label));
      dl.appendChild(h('dd', null, v ? (f.key === 'source_url' && /^https?:/.test(v) ? h('a', { href: v, target: '_blank', rel: 'noopener' }, v) : v) : h('span', { class: 'note' }, '-')));
    });
    return dl;
  }
  function evalCard(m) {
    var e = L.modelEvaluations([m])[0];
    return h('section', { class: 'card span-all' }, h('h2', null, 'Design Evaluation — 8기준', h('span', { class: 'kind obs' }, '평가 1~5')),
      h('p', { class: 'note' }, '가중 점수 ' + (e.avg == null ? '-' : e.avg + ' / 5 (' + L.levelLabel(e.avg) + ')') + ' · 평가한 비중 ' + e.coverage + '% · 기준 ' + e.rated + '/' + L.SCORE_AXES.length +
        (e.aiOnly ? ' · 디자이너 검증 전 AI 점수 ' + e.aiOnly + '개' : '')),
      h('div', { class: 'table-wrap' }, h('table', { class: 'list' },
        h('thead', null, h('tr', null, ['평가 기준', '비중', '최종', '디자이너', 'AI', '근거 / 코멘트'].map(function (t) { return h('th', { scope: 'col' }, t); }))),
        h('tbody', null, L.SCORE_AXES.map(function (a) {
          var f = e.scores[a.key];
          return h('tr', null, h('th', { scope: 'row' }, 'C' + a.no + ' ' + a.name), h('td', { class: 'num' }, a.weight + '%'),
            h('td', { class: 'num' }, f == null ? '-' : f + (e.source[a.key] === 'ai' ? ' (AI)' : '')),
            h('td', { class: 'num' }, m[a.key] === '' || m[a.key] == null ? '-' : String(m[a.key])),
            h('td', { class: 'num' }, m[a.aiKey] === '' || m[a.aiKey] == null ? '-' : String(m[a.aiKey])),
            h('td', null, m[a.noteKey] || ''));
        })))),
      m.legacy_scores ? h('p', { class: 'note' }, '이전 4축 점수(v0.3, 참고용 — 계산에 쓰지 않음): ' + Object.keys(m.legacy_scores).map(function (k) { return k + ' ' + m.legacy_scores[k]; }).join(', ')) : null);
  }
  function viewDetail(id) {
    var m = modelById(id);
    if (!m) return [h('p', { class: 'empty' }, '해당 모델이 없습니다. ', h('a', { href: '#/gallery' }, '갤러리로'))];
    var comp = L.completeness(m);
    var mm = L.tonnageMismatch(m);
    var cur = m.media[0] || null;
    var mainImg = h('div', { class: 'main-img' }, imgEl(cur, m.model_name));
    var cap = h('p', { class: 'note', style: 'margin:6px 0 0' }, cur ? cur.view_type + (cur.caption ? ' · ' + cur.caption : '') + (cur.resolution ? ' · ' + cur.resolution : '') : '');
    var thumbs = h('div', { class: 'thumbs' }, m.media.map(function (x, i) {
      return h('button', { type: 'button', 'aria-pressed': i === 0 ? 'true' : 'false', onclick: function (e) {
        thumbs.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
        e.currentTarget.setAttribute('aria-pressed', 'true');
        mainImg.innerHTML = ''; append(mainImg, imgEl(x, m.model_name + ' ' + x.view_type));
        cap.textContent = x.view_type + (x.caption ? ' · ' + x.caption : '') + (x.resolution ? ' · ' + x.resolution : '') + (x.path ? ' · ' + x.path : '');
      } }, x.view_type);
    }));
    var picked = db.compare.indexOf(m.id) >= 0;
    function block(bid, kindCls, kindLabel, extra) {
      var b = L.BLOCKS.filter(function (x) { return x.id === bid; })[0];
      return h('section', { class: 'card' }, h('h2', null, b.name, h('span', { class: 'kind ' + kindCls }, kindLabel)), extra || null, kvList(m, L.fieldsOf(bid)));
    }
    var obsNote = h('p', { class: 'note' }, '입력 출처: ' + (m.obs_origin || '디자이너 입력') + (m.obs_origin === 'AI 관찰' ? ' — AI observation 이므로 디자이너 확인 후 확정합니다.' : ''));
    return [
      pageHead('DETAIL', L.brandShort(m.brand) + ' ' + m.model_name, m.equipment_type + ' · ' + tonName(m) + ' · ' + specLine(m),
        h('div', { class: 'btn-row' },
          h('button', { type: 'button', class: 'btn' + (picked ? ' btn-primary' : ''), onclick: function () { if (toggleCompareId(m.id)) render(); } }, picked ? '비교에서 빼기' : '비교에 담기'),
          h('a', { class: 'btn', href: '#/edit/' + m.id }, '수정'),
          h('button', { type: 'button', class: 'btn btn-danger', onclick: function () {
            confirmBox('모델 삭제', m.model_name + ' 자료를 지웁니다. 되돌릴 수 없습니다.', '삭제', function () {
              db.models = db.models.filter(function (x) { return x.id !== m.id; });
              db.compare = db.compare.filter(function (x) { return x !== m.id; });
              save(); toast('삭제했습니다.'); go('#/gallery');
            }, true);
          } }, '삭제'))),
      comp.ok ? null : h('p', { class: 'alert warn' }, '필수 메타 누락: ' + comp.missing.map(function (k) { return L.REQUIRED.filter(function (r) { return r.key === k; })[0].label; }).join(', ')),
      mm ? h('p', { class: 'alert warn' }, '운전중량(' + L.formatNum(m.operating_weight) + ' kg) 기준 부록 C 분류는 ' + L.tonnageClass(m.equipment_type, mm).name + ' 입니다. 톤급을 확인해 주세요.') : null,
      h('div', { class: 'detail-top' },
        h('section', { class: 'card viewer' }, h('h2', null, '원본 이미지'), mainImg, cap, thumbs),
        h('div', null,
          block('identity', 'meta', '식별'),
          h('section', { class: 'card' }, h('h2', null, '검증 상태'), h('dl', { class: 'kvs' },
            h('dt', null, '검증 상태'), h('dd', null, h('span', { class: 'tag ' + (m.human_review_status === '확정' ? 'ok' : m.human_review_status === '반려' ? 'warn' : 'muted') }, m.human_review_status || '미검토')),
            h('dt', null, '입력자'), h('dd', null, m.entered_by || '-'),
            h('dt', null, 'Scope ID'), h('dd', null, m.benchmark_scope_id || '-'),
            h('dt', null, 'schema_version'), h('dd', null, m.schema_version))))),
      h('div', { class: 'blocks' },
        block('engineering', 'fact', '제원 FACT', h('p', { class: 'note' }, '카탈로그·스펙 시트 원문과 대조할 값입니다.')),
        block('source', 'meta', '출처'),
        block('design', 'obs', '관찰 OBSERVATION', obsNote),
        block('cabin', 'obs', '관찰 OBSERVATION', obsNote.cloneNode(true)),
        block('cmf', 'obs', '관찰 OBSERVATION', obsNote.cloneNode(true)),
        block('service', 'obs', '관찰 OBSERVATION', obsNote.cloneNode(true)),
        evalCard(m),
        block('evidence', 'meta', '근거·검증'))
    ];
  }

  /* ── 05 자료 등록 / 수정 ─────────────── */
  function readImage(file, maxPx, quality) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onerror = function () { reject(new Error('read')); };
      fr.onload = function () {
        var url = fr.result;
        if (/svg/.test(file.type)) { resolve({ data: url, resolution: '', media_type: file.type }); return; }
        var img = new Image();
        img.onerror = function () { reject(new Error('image')); };
        img.onload = function () {
          var w = img.naturalWidth, hh = img.naturalHeight;
          var k = Math.min(1, maxPx / Math.max(w, hh));
          var cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(hh * k));
          var c = document.createElement('canvas'); c.width = cw; c.height = ch;
          var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cw, ch); g.drawImage(img, 0, 0, cw, ch);
          resolve({ data: c.toDataURL('image/jpeg', quality), resolution: w + 'x' + hh, media_type: file.type || 'image' });
        };
        img.src = url;
      };
      fr.readAsDataURL(file);
    });
  }
  function control(f, m) {
    var v = m[f.key];
    if (f.type === 'select') return selectEl(f.key, f.options, v, '선택 안 함');
    if (f.type === 'score') return selectEl(f.key, L.SCORE_OPTIONS, v, '평가 안 함');
    if (f.type === 'tags') return h('input', { name: f.key, value: (v || []).join(', '), placeholder: '쉼표로 구분' });
    if (f.type === 'date') return h('input', { name: f.key, type: 'date', value: L.toDateStr(v) || '' });
    if (f.type === 'number') return h('input', { name: f.key, type: 'text', inputmode: 'decimal', value: v === '' || v == null ? '' : String(v), placeholder: f.unit ? '숫자 (' + f.unit + ') · 단위 적으면 변환' : '' });
    if (f.key === 'extracted_text' || f.key === 'reviewer_note') return h('textarea', { name: f.key }, v || '');
    return h('input', { name: f.key, value: v || '' });
  }
  function viewEdit(id) {
    var orig = id ? modelById(id) : null;
    if (id && !orig) return [h('p', { class: 'empty' }, '해당 모델이 없습니다.')];
    var sc = scopeNow();
    var m = orig ? JSON.parse(JSON.stringify(orig)) : L.emptyModel();
    if (!orig && sc) { m.equipment_type = sc.equipment_type; m.tonnage_class = sc.tonnage_class; m.benchmark_scope_id = sc.scope_id; }
    if (!orig) m.collected_at = L.toDateStr(new Date());
    var media = (m.media || []).slice();
    var REQ = L.REQUIRED.map(function (r) { return r.key; });

    var form = h('form', { novalidate: true });
    var brandList = h('datalist', { id: 'brandList' }, L.BRANDS.map(function (b) { return h('option', { value: b.name }); }));
    var tonSel = h('select', { name: 'tonnage_class' });
    var tonHint = h('small', { class: 'hint' });
    function fillTon() {
      var et = form.elements.equipment_type.value;
      var p = L.productByName(et);
      var cur = tonSel.value || m.tonnage_class;
      tonSel.innerHTML = '';
      tonSel.appendChild(h('option', { value: '' }, p ? '운전중량으로 자동' : '장비군 먼저'));
      if (p) p.classes.forEach(function (c) { var o = h('option', { value: c.code }, c.name + ' (' + c.range + ')'); if (c.code === cur) o.selected = true; tonSel.appendChild(o); });
      updateTonHint();
    }
    function updateTonHint() {
      var et = form.elements.equipment_type.value, w = L.parseQuantity(form.elements.operating_weight.value, 'weight', 'kg');
      var s = L.suggestTonnage(et, w);
      var c = s ? L.tonnageClass(et, s) : null;
      tonHint.textContent = c ? '운전중량 기준(부록 C): ' + c.name + (tonSel.value && tonSel.value !== s ? ' — 선택한 톤급과 다릅니다' : '') : '부록 C 분류. 비워 두면 운전중량으로 채웁니다.';
    }

    function blockFs(bid, kindCls, kindLabel, note) {
      var b = L.BLOCKS.filter(function (x) { return x.id === bid; })[0];
      var grid = h('div', { class: 'form-grid' });
      L.fieldsOf(bid).forEach(function (f) {
        var c;
        if (f.key === 'tonnage_class') c = tonSel;
        else if (f.key === 'brand') c = h('input', { name: 'brand', list: 'brandList', value: m.brand || '', autocomplete: 'off' });
        else c = control(f, m);
        var hint = f.key === 'tonnage_class' ? tonHint : null;
        var lab = field(f.label + (f.unit ? ' (' + f.unit + ')' : ''), c, { key: f.key, req: REQ.indexOf(f.key) >= 0 || f.key === 'equipment_type', span: f.type === 'text' && (f.key === 'extracted_text' || f.key === 'reviewer_note') });
        if (hint) lab.appendChild(hint);
        grid.appendChild(lab);
      });
      return h('fieldset', { class: 'block' }, h('legend', null, b.name, h('span', { class: 'kind ' + kindCls }, kindLabel)), note ? h('p', { class: 'note' }, note) : null, grid);
    }

    /* 디자인 평가 8기준 — 기준마다 디자이너 점수 · AI 점수 · 근거/코멘트 (평가 기준 자료 5·6절) */
    function evalFs() {
      var rows = L.SCORE_AXES.map(function (a) {
        var d = control(L.fieldByKey(a.key), m), ai = control(L.fieldByKey(a.aiKey), m);
        var nt = h('input', { name: a.noteKey, value: m[a.noteKey] || '', placeholder: '이미지 / URL / 분석 근거 / Designer Comment' });
        d.setAttribute('aria-label', 'C' + a.no + ' 디자이너 점수'); ai.setAttribute('aria-label', 'C' + a.no + ' AI 점수'); nt.setAttribute('aria-label', 'C' + a.no + ' 근거');
        return h('tr', null, h('th', { scope: 'row' }, 'C' + a.no + ' ' + a.name, h('div', { class: 'note' }, a.ko + ' · 비중 ' + a.weight + '%'),
          h('details', null, h('summary', { class: 'note' }, '체크리스트'), h('ul', { class: 'note' }, a.checks.map(function (c) { return h('li', null, c); })))),
          h('td', null, d), h('td', null, ai), h('td', null, nt));
      });
      var ansTa = h('textarea', { rows: 4, placeholder: 'AI 가 준 JSON 답을 붙여 넣어 주세요' });
      function formModel() {
        var data = {}; L.FIELDS.forEach(function (f) { var el = form.elements[f.key]; if (el) data[f.key] = el.value; });
        return L.cleanModel(data);
      }
      function applyAnswer(text) {
        try {
          var r = L.parseEvalAnswer(text), n = 0;
          L.SCORE_AXES.forEach(function (a) {
            if (r.scores[a.aiKey] != null) { form.elements[a.aiKey].value = String(r.scores[a.aiKey]); n++; }
            if (r.notes[a.noteKey] && !form.elements[a.noteKey].value.trim()) form.elements[a.noteKey].value = r.notes[a.noteKey];
          });
          if (form.elements.prompt_version) form.elements.prompt_version.value = L.EVAL_PROMPT_VERSION;
          toast('AI 점수 ' + n + '개를 넣었습니다(디자이너 점수는 그대로).' + (r.errors.length ? ' 참고: ' + r.errors.join(' · ') : '') + ' 저장해야 반영됩니다.');
        } catch (e) { toast('읽지 못했습니다: ' + e.message, true); }
      }
      return h('fieldset', { class: 'block' }, h('legend', null, 'Design Evaluation — 8기준', h('span', { class: 'kind obs' }, '평가 1~5')),
        h('p', { class: 'note' }, '척도: ' + levelNote() + '. 디자이너 점수(Designer Validation)가 최종 점수이고, 비어 있으면 AI 점수(AI Analysis)를 「검증 전」으로 씁니다. 근거 칸에 이미지·URL·분석 근거·코멘트를 적어 주세요. 기준 설명은 07 Insight 「평가 기준」.'),
        h('div', { class: 'table-wrap' }, h('table', { class: 'list eval-table' },
          h('thead', null, h('tr', null, ['평가 기준', '디자이너', 'AI', '근거 / 코멘트'].map(function (t) { return h('th', { scope: 'col' }, t); }))),
          h('tbody', null, rows))),
        h('details', { style: 'margin-top:10px' }, h('summary', null, 'AI 1차 평가(선택) — 관찰 기록으로 AI 점수 받기'),
          h('p', { class: 'note' }, '위 관찰 블록(Design·Cabin·CMF·Service)에 적은 글과 태그만 보냅니다. 이미지·출처 URL 은 보내지 않습니다. 관찰 기록이 없는 기준은 AI 가 점수를 비워 둡니다. 받은 점수는 「AI」 칸에만 들어갑니다.'),
          h('div', { class: 'btn-row' },
            h('button', { type: 'button', class: 'btn', onclick: function () { copyText(L.evalPrompt(formModel())); } }, 'AI 평가 프롬프트 복사'),
            aiSend('설정한 AI 서버로 보내기', function () { return L.evalPrompt(formModel()); }, function (t) { ansTa.value = t; applyAnswer(t); })),
          field('AI 답', ansTa),
          h('div', { class: 'btn-row' }, h('button', { type: 'button', class: 'btn', onclick: function () { applyAnswer(ansTa.value); } }, 'AI 답 읽기'))));
    }

    /* 이미지 */
    var mediaBox = h('div', { class: 'media-list' });
    function drawMedia() {
      mediaBox.innerHTML = '';
      if (!media.length) mediaBox.appendChild(h('p', { class: 'note' }, '아직 이미지가 없습니다. 이미지 경로(image path)는 필수 메타입니다.'));
      media.forEach(function (x, i) {
        var vs = selectEl('v' + i, L.VIEWS, x.view_type);
        vs.addEventListener('change', function () { x.view_type = vs.value; });
        var capIn = h('input', { value: x.caption || '', placeholder: '설명(선택)', 'aria-label': '이미지 설명' });
        capIn.addEventListener('input', function () { x.caption = capIn.value; });
        mediaBox.appendChild(h('div', { class: 'media-item' },
          h('div', { class: 'thumb' }, imgEl(x, x.view_type)),
          h('label', null, h('span', { class: 'sr' }, 'View'), vs), capIn,
          h('button', { type: 'button', class: 'btn btn-sm btn-danger', onclick: function () { media.splice(i, 1); drawMedia(); } }, '빼기')));
      });
    }
    drawMedia();
    var fileIn = h('input', { type: 'file', accept: 'image/*', multiple: true });
    var newView = selectEl('new_view', L.VIEWS, 'Side');
    fileIn.addEventListener('change', function () {
      var files = Array.prototype.slice.call(fileIn.files);
      Promise.all(files.map(function (f) {
        return readImage(f, db.settings.imageMaxPx, db.settings.imageQuality).then(function (r) {
          return { view_type: newView.value, path: f.name, data: r.data, resolution: r.resolution, media_type: r.media_type, caption: '' };
        }).catch(function () { toast(f.name + ' 은(는) 이미지로 읽지 못했습니다.', true); return null; });
      })).then(function (list) {
        list.filter(Boolean).forEach(function (x) { media.push(x); });
        fileIn.value = ''; drawMedia();
      });
    });
    var pathIn = h('input', { placeholder: '예: \\\\NAS\\benchmark\\EX210_side.jpg', 'aria-label': '이미지 경로' });
    var mediaFs = h('fieldset', { class: 'block' }, h('legend', null, 'Media', h('span', { class: 'kind meta' }, '이미지·View')),
      h('p', { class: 'note' }, '파일을 고르면 긴 변 ' + db.settings.imageMaxPx + 'px 로 줄여 이 브라우저에 보관합니다(설정은 「가져오기·내보내기」). 팀 공용 폴더에 둔 파일은 경로만 적어도 됩니다. 공개 웹의 이미지 주소(https://…)를 적으면 인터넷이 될 때 그 주소에서 바로 보여 줍니다.'),
      h('div', { class: 'form-grid' },
        field('추가할 이미지의 View', newView),
        field('이미지 파일', fileIn),
        field('또는 파일 경로', h('div', { class: 'btn-row', style: 'flex-wrap:nowrap' }, pathIn,
          h('button', { type: 'button', class: 'btn', onclick: function () {
            if (!pathIn.value.trim()) return;
            media.push({ view_type: newView.value, path: pathIn.value.trim(), data: '', caption: '' }); pathIn.value = ''; drawMedia();
          } }, '추가')))),
      mediaBox);

    append(form, [
      blockFs('identity', 'meta', '식별'),
      blockFs('source', 'meta', '출처', '제출 기획서 12절: 공식 OEM → 공식 Press/Exhibition → 신뢰 미디어 → 기타 순으로 신뢰도를 매깁니다.'),
      mediaFs,
      blockFs('engineering', 'fact', '제원 FACT', '카탈로그·스펙 시트 원문 값. 「21.5 t」「150 hp」처럼 단위를 적으면 kg·kW 로 바꿔 저장합니다.'),
      blockFs('design', 'obs', '관찰 OBSERVATION'),
      blockFs('cabin', 'obs', '관찰 OBSERVATION'),
      blockFs('cmf', 'obs', '관찰 OBSERVATION'),
      blockFs('service', 'obs', '관찰 OBSERVATION'),
      evalFs(),
      blockFs('evidence', 'meta', '근거·검증', '관찰 블록을 AI 가 채웠다면 「관찰 입력 출처」를 AI 관찰로 두고, 디자이너가 확인한 뒤 검증 상태를 「확정」으로 바꿉니다. Embedding ID 는 2단계용 빈 칸입니다.'),
      blockFs('scope', 'meta', 'Scope'),
      h('div', { class: 'submit-bar' },
        orig ? h('a', { class: 'btn', href: '#/model/' + orig.id }, '취소') : null,
        h('button', { type: 'submit', class: 'btn btn-primary btn-big' }, orig ? '수정 저장' : '등록'))
    ]);
    form.insertBefore(brandList, form.firstChild);
    form.elements.equipment_type.addEventListener('change', fillTon);
    form.elements.operating_weight.addEventListener('input', updateTonHint);
    tonSel.addEventListener('change', updateTonHint);
    fillTon();

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = { id: orig ? orig.id : '' };
      L.FIELDS.forEach(function (f) { var el = form.elements[f.key]; if (el) data[f.key] = el.value; });
      data.media = media;
      if (orig && orig.legacy_scores) data.legacy_scores = orig.legacy_scores;   // 예전 4축 점수는 보존
      var clean = L.cleanModel(data);
      clean.id = data.id;
      var errs = L.validateModel(clean, db.models);
      form.querySelectorAll('.field').forEach(function (x) { x.classList.remove('invalid'); var er = x.querySelector('.err'); if (er) er.remove(); });
      if (errs.length) {
        var msgs = { required: '필수 입력입니다.', date: '날짜 형식이 아닙니다.', url: 'http(s):// 주소나 파일 경로를 적어 주세요.', duplicate: '같은 브랜드·모델명이 이미 있습니다.' };
        errs.forEach(function (er) {
          var fe = form.querySelector('[data-field="' + er.field + '"]');
          if (!fe) return;
          fe.classList.add('invalid');
          var box = h('small', { class: 'err' }, msgs[er.code] || er.code);
          if (er.code === 'duplicate') append(box, [' ', h('a', { href: '#/model/' + er.id }, '기존 자료 보기')]);
          fe.appendChild(box);
        });
        var first = form.querySelector('.invalid input, .invalid select');
        if (first) first.focus();
        toast('입력을 확인해 주세요.', true);
        return;
      }
      if (!clean.id) { clean.id = L.nextId(db.models); db.models.push(clean); }
      else db.models = db.models.map(function (x) { return x.id === clean.id ? clean : x; });
      save();
      var miss = L.missingFields(clean);
      toast((orig ? '수정했습니다.' : '등록했습니다.') + (miss.length ? ' 필수 메타 ' + miss.length + '개가 비어 있습니다.' : ''));
      go('#/model/' + clean.id);
    });

    return [
      pageHead('STAGE 05', orig ? '자료 수정 — ' + orig.model_name : '자료 등록', '모델 1건 = Identity + 출처 + 이미지(View 지정) + 제원(FACT) + Design/Cabin/CMF/Service 관찰(OBSERVATION). * 는 필수 메타입니다(없어도 저장은 되며 현황판에 누락으로 표시).'),
      sc && !orig ? h('p', { class: 'alert info' }, '현재 Scope(' + sc.scope_id + ')의 장비군·톤급을 기본값으로 채웠습니다.') : null,
      form
    ];
  }

  /* ── 06 가져오기·내보내기 ─────────────── */
  var imp = null; // { name, sheets: {name: aoa}, sheet, headerRow, mapping, units }
  function readTable(file) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onerror = function () { reject(new Error('read')); };
      if (/\.csv$/i.test(file.name)) {
        fr.onload = function () { resolve({ CSV: L.parseCsv(fr.result) }); };
        fr.readAsText(file, 'utf-8');
      } else {
        fr.onload = function () {
          try {
            var wb = XLSX.read(new Uint8Array(fr.result), { type: 'array', cellDates: true });
            var out = {};
            wb.SheetNames.forEach(function (n) { out[n] = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' }); });
            resolve(out);
          } catch (e) { reject(e); }
        };
        fr.readAsArrayBuffer(file);
      }
    });
  }
  function startImport(name, sheets) {
    var names = Object.keys(sheets);
    var pick = names.filter(function (n) { return n === '모델목록'; })[0] || names.filter(function (n) { return (sheets[n] || []).length > 1; })[0] || names[0];
    imp = { name: name, sheets: sheets, sheet: pick, headerRow: 1, units: { weight: 'kg', power: 'kW', volume: 'm³' } };
    imp.mapping = L.guessMapping(currentRows()[0] || []);
    render();
    var el = document.getElementById('importMap'); if (el) el.scrollIntoView({ block: 'start' });
  }
  function currentRows() { var rows = imp.sheets[imp.sheet] || []; return rows.slice(Math.max(0, imp.headerRow - 1)); }
  function importPanel() {
    if (!imp) return null;
    var rows = currentRows();
    var headers = rows[0] || [];
    var targets = L.importTargets();
    var used = {};
    Object.keys(imp.mapping).forEach(function (k) { if (imp.mapping[k]) used[imp.mapping[k]] = (used[imp.mapping[k]] || 0) + 1; });
    var grid = h('div', { class: 'map-grid' }, headers.map(function (hd, i) {
      var ex = rows.slice(1, 4).map(function (r) { return r[i]; }).filter(function (v) { return v !== '' && v != null; }).map(function (v) { return v instanceof Date ? L.toDateStr(v) : String(v); }).join(' / ');
      var sel = selectEl('map' + i, targets.map(function (t) { return { value: t.key, label: t.label }; }), imp.mapping[i], '— 가져오지 않음 —');
      sel.addEventListener('change', function () { imp.mapping[i] = sel.value; render(); });
      var dup = imp.mapping[i] && used[imp.mapping[i]] > 1;
      return h('div', { class: 'map-row' }, h('span', { class: 'col' }, String(hd || '(빈 머리글 ' + (i + 1) + '열)')), h('span', { class: 'ex', title: ex }, ex || '값 없음'), sel,
        dup ? h('small', { class: 'err', style: 'color:var(--danger)' }, '같은 항목에 두 열이 연결됨 — 뒤 열 값이 씁니다') : null);
    }));
    var res = L.rowsToModels(rows, imp.mapping, imp.units);
    var need = ['brand', 'model_name'].filter(function (k) { return !Object.keys(imp.mapping).some(function (c) { return imp.mapping[c] === k; }); });
    var sheetSel = selectEl('sheet', Object.keys(imp.sheets), imp.sheet);
    sheetSel.addEventListener('change', function () { imp.sheet = sheetSel.value; imp.mapping = L.guessMapping(currentRows()[0] || []); render(); });
    var hr = h('input', { type: 'number', min: '1', value: String(imp.headerRow), inputmode: 'numeric' });
    hr.addEventListener('change', function () { imp.headerRow = Math.max(1, Number(hr.value) || 1); imp.mapping = L.guessMapping(currentRows()[0] || []); render(); });
    function unitSel(k, opts) {
      var s = selectEl('u_' + k, opts, imp.units[k]);
      s.addEventListener('change', function () { imp.units[k] = s.value; render(); });
      return s;
    }
    function doImport() {
      var r = L.mergeModels(db.models, res.models);
      db.models = r.models; save();
      dialog('가져오기 결과', h('div', null,
        h('p', null, '새로 추가 ' + r.added + '건 · 기존 모델 갱신 ' + r.updated + '건 · 건너뜀 ' + res.skipped.length + '행'),
        res.skipped.length ? h('ul', null, res.skipped.slice(0, 20).map(function (s) { return h('li', null, s.row + '행: ' + s.reason); })) : null,
        h('p', { class: 'note' }, '같은 브랜드+모델명은 기존 자료를 갱신합니다(빈 칸은 덮어쓰지 않음). 필수 메타 누락은 Status Dashboard 에서 확인하세요.')),
        [{ label: '닫기' }, { label: 'Status Dashboard 로', primary: true, onClick: function () { go('#/dashboard'); } }]);
      imp = null; render();
    }
    return h('section', { class: 'card', id: 'importMap' },
      h('h2', null, '열 연결 — ' + imp.name),
      h('p', { class: 'note' }, '엑셀의 각 열을 표준 Schema 항목에 연결합니다. 이름이 비슷한 열은 미리 연결해 두었으니 확인만 하세요. 머리글에 「(t)」「(hp)」처럼 단위가 있으면 그 단위를 먼저 씁니다.'),
      h('div', { class: 'form-grid' },
        Object.keys(imp.sheets).length > 1 ? field('시트', sheetSel) : null,
        field('머리글 행 번호', hr),
        field('운전중량 기본 단위', unitSel('weight', ['kg', 't'])),
        field('엔진 출력 기본 단위', unitSel('power', ['kW', 'hp', 'PS'])),
        field('버킷 용량 기본 단위', unitSel('volume', ['m³', 'L']))),
      h('div', { style: 'margin-top:14px' }, grid),
      need.length ? h('p', { class: 'alert warn' }, '브랜드와 모델명 열은 꼭 연결해야 합니다. 빠진 것: ' + need.map(function (k) { return L.fieldByKey(k).label; }).join(', ')) : null,
      h('p', { class: 'alert info' }, '미리보기: 가져올 모델 ' + res.models.length + '건, 건너뛸 행 ' + res.skipped.length + '건' +
        (res.models.length ? ' — 첫 건: ' + L.brandShort(res.models[0].brand) + ' ' + res.models[0].model_name + ' · ' + tonName(res.models[0]) + ' · ' + specLine(res.models[0]) : '')),
      h('div', { class: 'btn-row' },
        h('button', { type: 'button', class: 'btn btn-primary', disabled: !!need.length || !res.models.length, onclick: doImport }, res.models.length + '건 가져오기'),
        h('button', { type: 'button', class: 'btn', onclick: function () { imp = null; render(); } }, '취소')));
  }
  function exportModelsXlsx() {
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(L.modelsToSheet(db.models)), '모델목록');
    var sc = [['scope_id', 'equipment_type', 'tonnage_class', 'brands', 'purposes', 'scope_version', 'schema_version', 'created_at']].concat(db.scopes.map(function (s) {
      return [s.scope_id, s.equipment_type, s.tonnage_class, s.brands.join('; '), s.purposes.join('; '), s.scope_version, s.schema_version, s.created_at];
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sc), 'Scope');
    var out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    download('Benchmark_KB_' + stamp() + fileTag() + '.xlsx', new Blob([out], { type: 'application/octet-stream' }));
  }
  function loadSample() {
    function doIt() {
      db = Sample.build(new Date()); db.compare = [];
      save(); scopeDraft = null; toast('예시 데이터를 불러왔습니다. 모두 가상 자료입니다.'); go('#/dashboard');
    }
    if (db.models.length && !db._sample) confirmBox('예시 데이터 불러오기', '지금 있는 자료 ' + db.models.length + '건을 지우고 예시 데이터로 바꿉니다. 먼저 JSON 백업을 받아 두세요.', '바꾸기', doIt, true);
    else doIt();
  }
  function viewData() {
    var fileIn = h('input', { type: 'file', accept: '.xlsx,.xls,.csv' });
    fileIn.addEventListener('change', function () {
      var f = fileIn.files[0]; if (!f) return;
      readTable(f).then(function (sheets) { startImport(f.name, sheets); }).catch(function () { toast('파일을 읽지 못했습니다. xlsx·csv 파일인지 확인해 주세요.', true); });
    });
    var jsonIn = h('input', { type: 'file', accept: '.json,application/json' });
    jsonIn.addEventListener('change', function () {
      var f = jsonIn.files[0]; if (!f) return;
      var fr = new FileReader();
      fr.onload = function () {
        try {
          var p = JSON.parse(fr.result);
          if (!p || !Array.isArray(p.models)) throw new Error('shape');
          confirmBox('백업 복원', '지금 자료를 지우고 백업 파일의 모델 ' + p.models.length + '건 · Scope ' + (p.scopes || []).length + '건으로 바꿉니다.', '복원', function () {
            db = L.restoreDb(p); save(); scopeDraft = null; toast('복원했습니다.'); render();
          }, true);
        } catch (e) { toast('이 도구의 JSON 백업 파일이 아닙니다.', true); }
        jsonIn.value = '';
      };
      fr.readAsText(f, 'utf-8');
    });
    var pxIn = h('input', { type: 'number', min: '200', max: '4000', step: '50', value: String(db.settings.imageMaxPx), inputmode: 'numeric' });
    var qIn = h('input', { type: 'number', min: '0.3', max: '1', step: '0.05', value: String(db.settings.imageQuality), inputmode: 'decimal' });
    function saveSettings() {
      var px = Number(pxIn.value), q = Number(qIn.value);
      if (!(px >= 200 && px <= 4000) || !(q >= 0.3 && q <= 1)) { toast('긴 변은 200~4000px, 품질은 0.3~1 사이로 적어 주세요.', true); return; }
      db.settings.imageMaxPx = px; db.settings.imageQuality = q; save(); toast('설정을 저장했습니다. 다음에 추가하는 이미지부터 적용됩니다.');
    }
    return [
      pageHead('STAGE 06', '가져오기·내보내기', '기존 엑셀 정리 자료를 열 연결로 표준 Schema 에 넣고, 전체 자료를 엑셀·CSV·JSON 으로 내보냅니다.'),
      h('div', { class: 'grid-2' },
        h('section', { class: 'card' }, h('h2', null, '엑셀·CSV 가져오기'),
          h('p', { class: 'note' }, '한 행 = 모델 1건인 표를 받습니다. 이미지 경로 열은 ; 로 여러 개를 적을 수 있습니다.'),
          field('파일 선택 (.xlsx · .csv)', fileIn),
          h('div', { class: 'btn-row', style: 'margin-top:10px' },
            h('button', { type: 'button', class: 'btn', onclick: function () { startImport('예시 사내 정리표(가상)', { '예시': Sample.importSheet() }); } }, '예시 정리표로 열 연결 연습'))),
        h('section', { class: 'card' }, h('h2', null, '내보내기·백업'),
          h('p', { class: 'note' }, '엑셀·CSV 에는 이미지 파일 자체가 들어가지 않습니다(경로만). 이미지까지 옮기려면 JSON 백업을 쓰세요.'),
          h('div', { class: 'btn-row' },
            h('button', { type: 'button', class: 'btn btn-primary', disabled: !db.models.length, onclick: exportModelsXlsx }, '엑셀 내보내기(모델목록·Scope)'),
            h('button', { type: 'button', class: 'btn', disabled: !db.models.length, onclick: function () { download('Benchmark_KB_' + stamp() + fileTag() + '.csv', new Blob([L.toCsv(L.modelsToSheet(db.models))], { type: 'text/csv;charset=utf-8' })); } }, 'CSV'),
            h('button', { type: 'button', class: 'btn', onclick: function () { download('Benchmark_백업_' + stamp() + fileTag() + '.json', new Blob([JSON.stringify(db)], { type: 'application/json' })); } }, 'JSON 백업(이미지 포함)')),
          field('JSON 백업 복원', jsonIn))),
      importPanel(),
      h('div', { class: 'grid-2' },
        h('section', { class: 'card' }, h('h2', null, '예시 데이터'),
          h('p', null, '가상의 모델 ' + Sample.build(new Date()).models.length + '건(「예시-」 모델명, 도형 이미지, 평가 점수)과 Scope 1개, 운영 루프 이력 1건을 넣습니다. 실제 경쟁사 제품 정보가 아닙니다.'),
          h('p', { class: 'note' }, '열 연결 연습용 파일: samples/예시데이터_사내정리표.xlsx · .csv'),
          h('div', { class: 'btn-row' },
            h('button', { type: 'button', class: 'btn btn-primary', onclick: loadSample }, '예시 데이터 불러오기'),
            db._sample ? h('button', { type: 'button', class: 'btn btn-danger', onclick: function () {
              confirmBox('예시 데이터 지우기', '예시 데이터를 포함한 모든 자료를 지웁니다.', '지우기', function () { db = L.emptyDb(); S.clearDb(); save(); scopeDraft = null; render(); }, true);
            } }, '예시 데이터 지우기') : null)),
        h('section', { class: 'card' }, h('h2', null, '설정'),
          h('div', { class: 'form-grid' },
            field('이미지 긴 변 최대(px)', pxIn, { hint: '브라우저 저장 공간이 작아 줄여서 보관합니다.' }),
            field('JPEG 품질 (0.3~1)', qIn)),
          h('div', { class: 'btn-row', style: 'margin-top:10px' },
            h('button', { type: 'button', class: 'btn', onclick: saveSettings }, '설정 저장'),
            h('button', { type: 'button', class: 'btn btn-danger', onclick: function () {
              confirmBox('모든 자료 지우기', '이 브라우저에 저장한 모델·Scope 를 모두 지웁니다. 되돌릴 수 없습니다.', '모두 지우기', function () { db = L.emptyDb(); S.clearDb(); save(); scopeDraft = null; render(); }, true);
            } }, '모든 자료 지우기')),
          h('p', { class: 'note', style: 'margin-top:10px' }, '현재 저장 크기 약 ' + S.sizeKb() + 'KB. 브라우저마다 한도(대개 5MB 안팎)가 있어, 이미지가 많아지면 JSON 백업으로 나눠 보관하세요.'))),
      window.AIPanel ? AIPanel.settingsCard({ toast: toast, onChange: render }) : null
    ];
  }
  /* 2026-09-29 오후 늦게 — 설정한 OpenAI 호환 AI 서버(사내 온프레미스 LLM 포함)로 프롬프트를 보내는 버튼. 설정은 06 가져오기·내보내기 */
  function aiSend(label, getPrompt, onAnswer) {
    return window.AIPanel ? AIPanel.sendButton(label, getPrompt, onAnswer, { toast: toast, settingsHref: '#/data' }) : null;
  }
  function levelNote() { return L.SCORE_LEVELS.map(function (l) { return l.value + ' ' + l.label; }).join(' · '); }
  /* 평가 기준 안내 — 기준·비중·평가 목적·체크리스트·5점 Scale (평가 기준 자료 2~4절) */
  function rubricCard(open) {
    return h('section', { class: 'card' }, h('h2', null, '평가 기준 — 8-Criteria Design Evaluation Framework'),
      h('p', { class: 'note' }, '수강생이 올린 「BM Agent 평가 점수 기준 자료」의 기준·권장 비중·5점 Scale 입니다(' + L.RUBRIC_VERSION + '). 가중 점수 = Σ(비중 × 점수) ÷ 평가한 기준의 비중 합. ' +
        '기준마다 디자이너 점수와 AI 점수를 따로 두고, 최종 점수는 디자이너 점수가 있으면 그것, 없으면 AI 점수(「AI」 표시 — 검증 전)입니다.'),
      h('div', { class: 'table-wrap' }, h('table', { class: 'list' },
        h('thead', null, h('tr', null, ['No.', '평가 기준', '비중', '평가 목적 · 주요 세부 항목'].map(function (t) { return h('th', { scope: 'col' }, t); }))),
        h('tbody', null, L.SCORE_AXES.map(function (a) {
          return h('tr', null, h('td', { class: 'num' }, String(a.no)), h('th', { scope: 'row' }, a.name, h('div', { class: 'note' }, a.ko)), h('td', { class: 'num' }, a.weight + '%'),
            h('td', null, a.purpose, h('div', { class: 'note' }, a.items),
              h('details', open ? { open: true } : null, h('summary', null, '체크리스트 ' + a.checks.length + '문항'), h('ul', null, a.checks.map(function (c) { return h('li', null, c); })))));
        })))),
      h('div', { class: 'table-wrap', style: 'margin-top:10px' }, h('table', { class: 'list' },
        h('thead', null, h('tr', null, ['점수', '판단 기준', '해석'].map(function (t) { return h('th', { scope: 'col' }, t); }))),
        h('tbody', null, L.SCORE_LEVELS.map(function (l) { return h('tr', null, h('td', { class: 'num' }, String(l.value)), h('th', { scope: 'row' }, l.label), h('td', null, l.meaning)); })))),
      h('p', { class: 'note' }, '운영 원칙(자료 8절): 동급끼리 비교 · Engineering Specs 는 점수가 아니라 맥락 자료 · 관찰 가능한 정보와 출처 없이 AI 가 추정하지 않음 · 점수보다 「왜 그렇게 평가했는가」를 추적(근거/코멘트 칸).'));
  }

  /* ══ 2026-09-29 추가 — 수강생 Proto Web(End-to-End 13단계) 중 08 Insight · 10 Report · 11 Designer Validation · 13 Scheduled Update ══
     계산은 모두 logic.js(buildInsight · buildReport · feedback* · ops*)에 있고, 여기서는 그리기만 합니다. */

  /* 인사이트·리포트 공통 대상 선택 — Scope 가 있으면 Scope 범위, 끄면 장비군 전체 */
  var insState = { useScope: true, equipment_type: '' };
  function targetOpts() {
    var sc = scopeNow();
    return sc && insState.useScope ? { useScope: true } : { useScope: false, equipment_type: insState.equipment_type };
  }
  function targetTools() {
    var sc = scopeNow();
    var usingScope = sc && insState.useScope;
    var etSel = selectEl('et', L.PRODUCTS.map(function (p) { return p.name; }), insState.equipment_type, '전체 장비군');
    etSel.disabled = !!usingScope;
    etSel.addEventListener('change', function () { insState.equipment_type = etSel.value; render(); });
    return h('div', { class: 'btn-row no-print' },
      sc ? h('label', { class: 'opt', style: 'min-height:44px;align-items:center' }, h('input', {
        type: 'checkbox', checked: !!usingScope, onchange: function (e) { insState.useScope = e.target.checked; render(); }
      }), h('span', { class: 't' }, 'Scope ' + sc.scope_id + ' 범위만')) : null,
      h('label', { class: 'field' }, h('span', { class: 'sr' }, '장비군'), etSel));
  }
  function scoreCell(v, d) {
    var cls = 'num' + (d == null ? '' : d >= 0.5 ? ' up' : d <= -0.5 ? ' down' : '');
    return h('td', { class: cls }, v == null ? '-' : v + (d == null ? '' : ' (' + (d > 0 ? '+' : '') + d + ')'));
  }
  function copyText(text) {
    function fallback() {
      var ta = h('textarea', { readonly: true, style: 'width:100%;min-height:260px' }, text);
      dialog('프롬프트를 복사해 주세요', [h('p', { class: 'note' }, '이 브라우저는 자동 복사를 막고 있습니다. 아래 글을 전부 선택(Ctrl+A)해 복사해 주세요.'), ta]);
      setTimeout(function () { ta.focus(); ta.select(); }, 50);
    }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(function () { toast('프롬프트를 복사했습니다. ChatGPT 등에 붙여 넣어 주세요.'); }, fallback);
    else fallback();
  }

  /* ══ 2026-09-30 — 보고서 목적별 비중 프로필 · Radar Chart (수강생 댓글 「보고서 목적별로 비중 변경 옵션」 「Radar Chart 가 필요합니다」) ══
     계산은 logic.js(WEIGHT_PRESETS · saveWeightVersion · radarSvg …). 여기서는 고르기·고치기·그리기만 합니다. */
  function weightOpts() { return { weights: L.currentWeights(db.weighting), weightLabel: L.weightLabel(db.weighting) }; }
  function profileSelect(onChange) {
    var s = selectEl('wprofile', db.weighting.profiles.map(function (p) {
      return { value: p.id, label: p.name + ' v' + L.latestVersion(p).v + (p.builtin ? '' : ' (사용자)') };
    }), db.weighting.active);
    s.setAttribute('aria-label', '비중 프로필');
    s.addEventListener('change', function () { db.weighting.active = s.value; save(); toast('비중 프로필을 「' + L.weightLabel(db.weighting) + '」로 바꿨습니다. 가중 점수·Radar·리포트가 이 비중으로 다시 계산됩니다.'); if (onChange) onChange(); else render(); });
    return s;
  }
  function weightSummary(w) { return L.SCORE_AXES.map(function (a) { return 'C' + a.no + ' ' + w[a.id]; }).join(' · '); }
  function weightCard(sc) {
    var prof = L.weightProfile(db.weighting), cur = L.latestVersion(prof);
    var sug = sc ? L.suggestProfile(sc.purposes) : '';
    var sugProf = sug && sug !== prof.id ? L.weightProfile(db.weighting, sug) : null;
    var inputs = {};
    var totalEl = h('strong', null, '');
    function readW() { var o = {}; L.SCORE_AXES.forEach(function (a) { o[a.id] = inputs[a.id].value; }); return L.cleanWeights(o); }
    function updateTotal() {
      var chk = L.validateWeights(readW());
      totalEl.textContent = '합계 ' + (isFinite(chk.total) ? chk.total : '-') + '%';
      totalEl.className = chk.ok ? 'wt-ok' : 'wt-bad';
    }
    var grid = h('div', { class: 'weight-grid' }, L.SCORE_AXES.map(function (a) {
      inputs[a.id] = h('input', { type: 'number', name: 'w_' + a.id, min: '0', max: '100', step: '1', inputmode: 'numeric', value: String(cur.weights[a.id]) });
      inputs[a.id].addEventListener('input', updateTotal);
      return field('C' + a.no + ' ' + a.ko, inputs[a.id], { hint: '권장 ' + a.weight + '%' });
    }));
    var memo = h('input', { name: 'wmemo', placeholder: '예) 캡 개선 보고용으로 C6 상향' });
    var author = h('input', { name: 'wauthor', value: db.lastAuthor || '', placeholder: '예) 디자인팀 홍길동', autocomplete: 'name' });
    var newName = h('input', { name: 'wname', placeholder: '예) 임원 보고용' });
    function saveVersion() {
      var r = L.saveWeightVersion(db.weighting, prof.id, readW(), { author: author.value, memo: memo.value });
      if (!r.ok) { toast(r.errors.join(' '), true); return; }
      db.weighting = r.weighting; db.lastAuthor = author.value.trim(); save();
      toast('「' + prof.name + '」 v' + r.version.v + ' 로 저장했습니다. 이전 버전은 아래 이력에 그대로 남습니다.'); render();
    }
    function saveNew() {
      var r = L.addWeightProfile(db.weighting, newName.value, readW(), { author: author.value, memo: memo.value });
      if (!r.ok) { toast(r.errors.join(' '), true); return; }
      db.weighting = r.weighting; db.weighting.active = r.profile.id; db.lastAuthor = author.value.trim(); save();
      toast('새 프로필 「' + r.profile.name + '」을 만들고 적용했습니다.'); render();
    }
    function reuse(v) {
      var r = L.saveWeightVersion(db.weighting, prof.id, v.weights, { author: author.value, memo: 'v' + v.v + ' 비중으로 되돌림' });
      if (!r.ok) { toast(r.errors.join(' '), true); return; }
      db.weighting = r.weighting; save(); toast('v' + v.v + ' 비중을 v' + r.version.v + ' 로 다시 저장했습니다.'); render();
    }
    var hist = h('div', { class: 'table-wrap' }, h('table', { class: 'list' },
      h('thead', null, h('tr', null, ['버전', '저장 시각', '작성자', '메모', '비중(%)', ''].map(function (t) { return h('th', { scope: 'col' }, t); }))),
      h('tbody', null, prof.versions.slice().reverse().map(function (v) {
        var latest = v === cur;
        return h('tr', null, h('th', { scope: 'row' }, 'v' + v.v + (latest ? ' (사용 중)' : '')), h('td', null, v.saved_at || '처음 값'), h('td', null, v.author || '-'), h('td', null, v.memo || '-'),
          h('td', { class: 'note' }, weightSummary(v.weights)),
          h('td', null, latest ? null : h('button', { type: 'button', class: 'btn btn-sm', onclick: function () { reuse(v); } }, '이 버전 다시 쓰기')));
      }))));
    var card = h('section', { class: 'card', id: 'weights' }, h('h2', null, '보고서 목적별 비중'),
      h('p', { class: 'note' }, '보고서 목적에 맞는 비중 프로필을 골라 주세요. 가중 점수·강약점·Radar·Benchmarking Report 가 이 비중으로 다시 계산됩니다. ' +
        '「종합 벤치마킹」은 평가 기준 자료의 권장 비중이고, 나머지 다섯 개는 목적에 맞춰 잡은 예시 값입니다. 팀 기준에 맞게 고쳐 새 버전으로 저장해 주세요(평가 기준 자료 8절 「가중치 버전 관리」 — 이전 버전은 지우지 않습니다).'),
      h('div', { class: 'btn-row' }, field('비중 프로필', profileSelect()),
        h('div', null, h('div', null, h('strong', null, prof.name + ' v' + cur.v), h('span', { class: 'note' }, ' · ' + prof.source)), h('div', { class: 'note' }, prof.desc || ''),
          h('div', { class: 'note' }, weightSummary(cur.weights)))),
      sugProf ? h('p', { class: 'alert info' }, 'Scope ' + sc.scope_id + ' 의 목적(' + sc.purposes.join(', ') + ')에는 「' + sugProf.name + '」 프로필이 맞습니다. ',
        h('button', { type: 'button', class: 'btn btn-sm', onclick: function () { db.weighting.active = sugProf.id; save(); render(); } }, '이 프로필로 바꾸기')) : null,
      h('details', null, h('summary', null, '비중 고치기 · 버전 이력 (' + prof.versions.length + '개)'),
        h('p', { class: 'note' }, '0~100 정수, 합계 100% 로 맞춰 주세요. 0 은 「이 보고서에서는 보지 않음」입니다. 점수는 그대로이고 가중 점수만 달라집니다.'),
        grid, h('p', null, totalEl),
        h('div', { class: 'form-grid' }, field('메모', memo), field('작성자', author)),
        h('div', { class: 'btn-row', style: 'margin-top:10px' },
          h('button', { type: 'button', class: 'btn btn-primary', onclick: saveVersion }, '「' + prof.name + '」 새 버전으로 저장'),
          h('button', { type: 'button', class: 'btn', onclick: function () { L.SCORE_AXES.forEach(function (a) { inputs[a.id].value = String(cur.weights[a.id]); }); updateTotal(); } }, '입력 되돌리기')),
        h('div', { class: 'form-grid', style: 'margin-top:10px' }, field('새 프로필 이름', newName)),
        h('div', { class: 'btn-row', style: 'margin-top:6px' }, h('button', { type: 'button', class: 'btn', onclick: saveNew }, '위 비중으로 새 프로필 만들기')),
        h('h3', null, '「' + prof.name + '」 버전 이력'), hist));
    updateTotal();
    return card;
  }
  /* Radar — 브랜드별 8기준 평균. 색은 브랜드를 처음 고른 순서로 자리를 정해, 다른 브랜드를 빼도 색이 바뀌지 않습니다 */
  var radarState = { picked: null, slots: {} };
  function radarColor(brand) {
    if (radarState.slots[brand] == null) {
      var used = Object.keys(radarState.slots).filter(function (b) { return radarState.picked.indexOf(b) >= 0; }).map(function (b) { return radarState.slots[b]; });
      var i = 0; while (used.indexOf(i) >= 0) i++;
      radarState.slots[brand] = i;
    }
    return L.RADAR_COLORS[radarState.slots[brand] % L.RADAR_COLORS.length];
  }
  function radarCard(ins) {
    var rows = ins.scores.rows.filter(function (r) { return r.overall != null; });
    if (!rows.length) return h('section', { class: 'card' }, h('h2', null, 'Radar Chart'), h('p', { class: 'note' }, '평가 점수가 들어간 브랜드가 없습니다. 아래 「디자인 평가」 표에서 점수를 넣으면 그려집니다.'));
    var names = rows.map(function (r) { return r.brand; });
    if (!radarState.picked) radarState.picked = names.slice(0, 5);
    radarState.picked = radarState.picked.filter(function (b) { return names.indexOf(b) >= 0; });
    if (!radarState.picked.length) radarState.picked = names.slice(0, 1);
    Object.keys(radarState.slots).forEach(function (b) { if (radarState.picked.indexOf(b) < 0) delete radarState.slots[b]; });
    var colors = {}; radarState.picked.forEach(function (b) { colors[b] = radarColor(b); });
    var box = h('div', { class: 'radar-box' });
    box.innerHTML = L.radarSvg({ title: 'Radar Chart — 브랜드별 8기준 평균 점수(' + ins.weightLabel + ')', axes: L.radarAxes(ins), series: L.radarSeries(ins, radarState.picked, colors) });  // radarSvg 가 이름을 이스케이프합니다
    var full = radarState.picked.length >= L.RADAR_MAX_SERIES;
    var picks = h('div', { class: 'opt-grid' }, rows.map(function (r) {
      var on = radarState.picked.indexOf(r.brand) >= 0;
      return h('label', { class: 'opt' }, h('input', { type: 'checkbox', checked: on, disabled: !on && full, onchange: function (e) {
        if (e.target.checked) radarState.picked.push(r.brand); else radarState.picked = radarState.picked.filter(function (b) { return b !== r.brand; });
        render();
      } }), h('span', { class: 't' }, r.short + ' ' + r.overall + '점'));
    }));
    return h('section', { class: 'card' }, h('h2', null, 'Radar Chart — 8기준 브랜드 비교'),
      h('p', { class: 'note' }, '브랜드별 8기준 평균 점수(1~5)입니다. 점선은 기준 평균, 축 아래 숫자는 지금 비중(' + ins.weightLabel + ')입니다. 점에 마우스를 올리면 점수가 보입니다. ' +
        '한 번에 ' + L.RADAR_MAX_SERIES + '개 브랜드까지 고를 수 있습니다. 정확한 숫자는 아래 「평가표」에 있습니다. 같은 차트가 Benchmarking Report 4번 항목에도 들어갑니다.'),
      picks, box);
  }
  /* 「내 PC 에서 쓰기」 — 수강생 댓글 「다운로드 받는 방법을 모르겠습니다」 */
  var ZIP_URL = 'https://github.com/aebonlee/data09-10/archive/refs/heads/main.zip';
  function localUseCard() {
    return h('section', { class: 'card local-use' }, h('h2', null, '내 PC 에서 쓰기'),
      h('ol', null,
        h('li', null, h('a', { href: ZIP_URL }, '전체 파일 ZIP 내려받기'), ' 를 눌러 주세요(GitHub 가입·로그인 없이 받아집니다).'),
        h('li', null, '받은 data09-10-main.zip 을 마우스 오른쪽 → 「압축 풀기(모두 추출)」로 풀어 주세요. ZIP 안에서 바로 열면 화면이 깨집니다.'),
        h('li', null, '풀린 폴더의 index.html 을 더블클릭하면 이 화면(과제 A)이, report 폴더의 index.html 을 열면 업무보고 Agent(과제 B)가 열립니다.'),
        h('li', null, '인터넷 없이도 돌아갑니다. 자료는 그 PC 의 브라우저에 저장되니 「가져오기·내보내기」의 JSON 백업을 받아 두세요.')),
      h('p', null, h('a', { class: 'btn', href: 'guide.html' }, '자세한 안내 — 교육 중 실행 · 회사에서 쓰기 · AI 로 고쳐 쓰기')));
  }

  /* ── 07 Insight ─────────────────────── */
  function viewInsight() {
    var models = L.reportModels(db, targetOpts());
    var sc = targetOpts().useScope ? scopeNow() : null;
    var ins = L.buildInsight(models, weightOpts());
    var head = pageHead('STAGE 07', 'Insight', 'BM 결과를 브랜드별 요약·점수 비교·강약점·Design Tag 트렌드·White Space 로 정리합니다. 대상: ' +
      (sc ? 'Scope ' + sc.scope_id : insState.equipment_type || '전체 장비군') + ' · 모델 ' + models.length + '건', targetTools());
    if (!models.length) return [head, h('div', { class: 'card empty' }, h('p', null, '대상 모델이 없습니다. 자료를 등록하거나 범위를 넓혀 주세요.'),
      h('a', { class: 'btn btn-primary', href: '#/edit' }, '자료 등록'))];

    var axes = ins.scores.axes;
    var summaryTbl = h('div', { class: 'table-wrap' }, h('table', { class: 'list' },
      h('thead', null, h('tr', null, ['브랜드', '모델', '평가 입력', '평가 평균', '운전중량(t)', '평균 출력(kW)', '출력대비중량(kW/t)', '출시 연도', '주요 태그', '최근 수집일', '누락'].map(function (t, i) {
        return h('th', { scope: 'col', class: i >= 1 && i <= 6 ? 'num' : null }, t); }))),
      h('tbody', null, ins.summary.map(function (r) {
        return h('tr', null, h('th', { scope: 'row' }, r.short), h('td', { class: 'num' }, String(r.models)), h('td', { class: 'num' }, String(r.scored)),
          h('td', { class: 'num' }, r.overall == null ? '-' : String(r.overall)),
          h('td', { class: 'num' }, r.weight ? r.weight.min + ' ~ ' + r.weight.max : '-'), h('td', { class: 'num' }, r.power == null ? '-' : String(r.power)),
          h('td', { class: 'num' }, r.pwr == null ? '-' : String(r.pwr)), h('td', null, r.years ? r.years.min + ' ~ ' + r.years.max : '-'),
          h('td', null, r.tags.map(function (t) { return h('span', { class: 'tag muted' }, t.tag + ' ' + t.count); })),
          h('td', null, r.latest || '-'), h('td', { class: 'num' + (r.incomplete ? '' : ' zero') }, String(r.incomplete)));
      }))));
    /* 평가 기준 자료 5절의 평가표 모양 — 행 = 기준, 열 = 브랜드 */
    var rowsB = ins.scores.rows;
    var scoreTbl = h('div', { class: 'table-wrap' }, h('table', { class: 'list' },
      h('thead', null, h('tr', null, h('th', { scope: 'col' }, '평가 기준'), h('th', { scope: 'col', class: 'num' }, '가중치'),
        rowsB.map(function (r) { return h('th', { scope: 'col', class: 'num' }, r.short); }), h('th', { scope: 'col', class: 'num' }, '기준 평균'))),
      h('tbody', null, axes.map(function (a) {
        return h('tr', null, h('th', { scope: 'row' }, 'C' + a.no + ' ' + a.name), h('td', { class: 'num' }, a.weight + '%'),
          rowsB.map(function (r) { return scoreCell(r.scores[a.key], r.diff[a.key]); }), h('td', { class: 'num' }, a.avg == null ? '-' : a.avg + ' (' + a.n + '건)'));
      }), h('tr', { class: 'sum' }, h('th', { scope: 'row' }, '가중 점수'), h('td', { class: 'num' }, '100%'),
        rowsB.map(function (r) { return h('td', { class: 'num' }, r.overall == null ? '-' : String(r.overall)); }), h('td', null, '')))));
    var swGrid = h('div', { class: 'sw-grid' }, ins.sw.map(function (r) {
      return h('div', { class: 'sw-card' }, h('h3', null, r.short),
        r.strengths.length ? [h('div', { class: 'sw-k ok' }, '강점'), h('ul', null, r.strengths.map(function (x) { return h('li', null, x.text); }))] : null,
        r.weaknesses.length ? [h('div', { class: 'sw-k bad' }, '약점'), h('ul', null, r.weaknesses.map(function (x) { return h('li', null, x.text); }))] : null,
        !r.strengths.length && !r.weaknesses.length ? h('p', { class: 'note' }, '평균과 큰 차이가 없습니다.') : null,
        r.notes.length ? h('ul', { class: 'note' }, r.notes.map(function (x) { return h('li', null, x); })) : null);
    }));
    var tagTbl = ins.tags.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'list' },
      h('thead', null, h('tr', null, ['Design Tag', '건수', '비율', '최근 2개 연식', '브랜드'].map(function (t, i) { return h('th', { scope: 'col', class: i && i < 4 ? 'num' : null }, t); }))),
      h('tbody', null, ins.tags.slice(0, 15).map(function (t) {
        return h('tr', null, h('th', { scope: 'row' }, t.tag), h('td', { class: 'num' }, String(t.count)), h('td', { class: 'num' }, t.share + '%'), h('td', { class: 'num' }, String(t.recent)), h('td', null, t.brands.join(', ')));
      })))) : h('p', { class: 'note' }, 'Design Tag 가 없습니다. 자료 등록의 Design 블록에 쉼표로 적어 주세요.');
    var wsList = h('ul', null, ins.whitespace.map(function (w) {
      return h('li', null, w.name + ' 평균 ' + w.avg + '점 · 최고 ' + (w.best ? L.brandShort(w.best.brand) + ' ' + w.best.value + '점' : '-'),
        w.open ? h('span', { class: 'tag warn', style: 'margin-left:6px' }, '비어 있는 자리') : null);
    }));

    /* 평가 점수 빠른 입력 — 바꾸면 바로 저장 */
    var evById = {}; ins.evaluations.forEach(function (e) { evById[e.id] = e; });
    var quick = h('div', { class: 'table-wrap' }, h('table', { class: 'list' },
      h('thead', null, h('tr', null, h('th', { scope: 'col' }, '모델'), axes.map(function (a) { return h('th', { scope: 'col', title: a.name }, 'C' + a.no + ' ' + a.ko, h('div', { class: 'note' }, a.weight + '%')); }), h('th', { scope: 'col', class: 'num' }, '가중 점수'))),
      h('tbody', null, L.filterModels(models, {}).map(function (m) {
        var ev = evById[m.id] || L.modelEvaluations([m])[0];
        return h('tr', null, h('th', { scope: 'row' }, h('a', { href: '#/model/' + m.id }, L.brandShort(m.brand) + ' ' + m.model_name)),
          axes.map(function (a) {
            var s = selectEl(a.key, L.SCORE_OPTIONS.map(function (o) { return { value: o.value, label: o.value }; }), m[a.key], ev.source[a.key] === 'ai' ? 'AI ' + ev.scores[a.key] : '-');
            s.setAttribute('aria-label', m.model_name + ' C' + a.no + ' ' + a.name + ' 디자이너 점수');
            s.addEventListener('change', function () {
              var x = modelById(m.id); if (!x) return;
              x[a.key] = L.cleanScore(s.value); save(); render();
            });
            return h('td', null, s);
          }), h('td', { class: 'num' }, ev.avg == null ? '-' : ev.avg + (ev.coverage < 100 ? ' (' + ev.coverage + '%)' : '')));
      }))));

    /* 요약 코멘트 — 직접 쓰거나 AI 요약(반자동)을 붙여 넣습니다 */
    var note = db.insightNote || { text: '', origin: '', saved_at: '' };
    var noteTa = h('textarea', { name: 'note', rows: 6, placeholder: '예) 중형 굴착기는 슬림 필러·넓은 글라스가 공통 흐름입니다. CMF 는 전 브랜드가 평이해 차별화 여지가 있습니다.' }, note.text || '');
    var originSel = selectEl('origin', ['디자이너 작성', 'AI 요약(검토 필요)'], note.origin || '디자이너 작성');
    var noteCard = h('section', { class: 'card' }, h('h2', null, '요약 코멘트'),
      h('p', { class: 'note' }, '리포트 「7. 요약 코멘트」 항목에 들어갑니다. AI 요약을 쓰려면 ① 프롬프트를 복사해 ChatGPT 등에 붙여 넣고 ② 받은 답을 아래 칸에 붙여 넣은 뒤 ③ 출처를 「AI 요약(검토 필요)」로 두고 저장해 주세요. 프롬프트에는 모델명·점수·태그만 들어가고 이미지·출처 URL 은 들어가지 않습니다.'),
      h('div', { class: 'btn-row', style: 'margin-bottom:10px' },
        h('button', { type: 'button', class: 'btn', onclick: function () { copyText(L.insightPrompt(ins, sc)); } }, 'AI 요약 프롬프트 복사'),
        aiSend('설정한 AI 서버로 보내기', function () { return L.insightPrompt(ins, sc); }, function (t) { noteTa.value = t.trim(); originSel.value = 'AI 요약(검토 필요)'; toast('AI 답을 칸에 넣었습니다. 검토 후 「저장」을 눌러 주세요.'); })),
      h('div', { class: 'form-grid' }, field('요약 코멘트', noteTa, { span: true }), field('작성 출처', originSel)),
      h('div', { class: 'btn-row', style: 'margin-top:10px' },
        h('button', { type: 'button', class: 'btn btn-primary', onclick: function () {
          db.insightNote = { text: noteTa.value.trim(), origin: originSel.value, saved_at: L.stampTime(new Date()) };
          save(); toast(db.insightNote.text ? '요약 코멘트를 저장했습니다.' : '요약 코멘트를 비웠습니다.'); render();
        } }, '저장'),
        note.saved_at ? h('span', { class: 'note' }, '마지막 저장 ' + note.saved_at + ' · ' + (note.origin || '')) : null));

    return [
      head,
      h('section', { class: 'card' }, h('h2', null, '주요 인사이트'),
        h('div', { class: 'tiles' }, [['모델', ins.count + '건'], ['브랜드', ins.brandCount + '개'], ['평가 입력', ins.scoredCount + '건'], ['Design Tag', ins.tags.length + '종']].map(function (t) {
          return h('div', { class: 'tile' }, h('div', { class: 'k' }, t[0]), h('div', { class: 'v' }, t[1])); })),
        h('ul', null, ins.headline.map(function (x) { return h('li', null, x); })),
        h('div', { class: 'btn-row' }, h('a', { class: 'btn btn-primary', href: '#/report' }, 'Benchmarking Report 로 보기'), h('a', { class: 'btn', href: '#/feedback/scores' }, '점수 비교에 피드백 남기기'))),
      weightCard(sc),
      radarCard(ins),
      h('section', { class: 'card' }, h('h2', null, '브랜드별 요약'), summaryTbl),
      h('section', { class: 'card' }, h('h2', null, '평가표 — 기준 × 브랜드'),
        h('p', { class: 'note' }, '8기준 최종 점수(1~5)의 브랜드 평균과 가중 점수(비중 ' + ins.weightLabel + ')입니다. 괄호는 기준 평균(모델 단위) 대비 차이이고, 0.5점 이상 높으면 초록·낮으면 빨강입니다.'), scoreTbl),
      h('section', { class: 'card' }, h('h2', null, '강·약점'), h('p', { class: 'note' }, '기준 평균보다 0.5점 이상 높거나 낮은 기준, 출력 대비 중량(kW/t)이 전체 평균과 10% 이상 다른 경우를 적습니다.'), swGrid),
      h('div', { class: 'grid-2' },
        h('section', { class: 'card' }, h('h2', null, 'Design Tag 트렌드'), tagTbl),
        h('section', { class: 'card' }, h('h2', null, 'White Space'), h('p', { class: 'note' }, '전체 평균이 낮은 기준부터 적습니다. 가장 높은 브랜드도 4점이 안 되면 「비어 있는 자리」로 표시합니다.'), wsList)),
      noteCard,
      h('section', { class: 'card' }, h('h2', null, '디자인 평가 — 모델별 8기준 점수(1~5)'), h('p', { class: 'note' }, '디자이너 점수를 1~5점으로 골라 주세요(' + levelNote() + ', 「-」는 평가 안 함, 「AI n」은 디자이너 검증 전 AI 점수). 이 표는 리포트 「2. 디자인 평가」에 그대로 들어가고, 위 Insight 는 이 점수로 계산합니다. 바꾸면 바로 저장되고 위 표가 다시 계산됩니다. AI 점수·근거/코멘트는 자료 등록 화면의 「Design Evaluation」 블록에서 넣습니다.'), quick),
      rubricCard(false)
    ];
  }

  /* ── 08 Benchmarking Report ──────────── */
  var rpStyleDone = false;
  function viewReport() {
    if (!rpStyleDone) { document.head.appendChild(h('style', { id: 'rpCss' }, L.REPORT_CSS)); rpStyleDone = true; }
    var rep = L.buildReport(db, targetOpts());
    var fname = 'Benchmarking_Report_' + (rep.scope ? rep.scope.scope_id + '_' : '') + stamp() + fileTag();
    function exportXlsx() {
      var wb = XLSX.utils.book_new();
      L.reportSheets(rep).forEach(function (s) { XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s.aoa), s.name); });
      var out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      download(fname + '.xlsx', new Blob([out], { type: 'application/octet-stream' }));
    }
    function exportHtml() { download(fname + '.html', new Blob([L.reportHtml(rep)], { type: 'text/html;charset=utf-8' })); }
    var art = h('article', { class: 'rp card rp-screen' });
    art.innerHTML = L.reportBodyHtml(rep);   // reportBodyHtml 은 모든 값을 이스케이프합니다
    var sum = {};
    L.feedbackSummary(db.feedback || []).forEach(function (r) { sum[r.target] = r; });
    art.querySelectorAll('section[data-section]').forEach(function (sec) {
      var id = sec.getAttribute('data-section'), s = sum[id];
      sec.appendChild(h('div', { class: 'btn-row no-print rp-fb' },
        h('a', { class: 'btn btn-sm', href: '#/feedback/' + id }, '이 항목에 피드백'),
        s && s.count ? h('span', { class: 'note' }, '피드백 ' + s.count + '건 · 평균 ' + s.avg + '점' + (s.open ? ' · 열림 ' + s.open : '')) : null));
    });
    return [
      h('div', { class: 'no-print' }, pageHead('STAGE 08', 'Benchmarking Report', '인사이트·비교·전문가 피드백·운영 상태를 한 장의 보고서로 묶습니다. 인쇄 창에서 「PDF로 저장」을 고르면 PDF 가 됩니다.',
        h('div', { class: 'btn-row' },
          h('button', { type: 'button', class: 'btn btn-primary', onclick: function () { window.print(); } }, '인쇄 · PDF 저장'),
          h('button', { type: 'button', class: 'btn', onclick: exportXlsx }, 'Excel(xlsx)'),
          h('button', { type: 'button', class: 'btn', onclick: exportHtml }, 'HTML 내려받기'))),
        targetTools(),
        h('div', { class: 'btn-row' }, field('보고서 목적(비중 프로필)', profileSelect()), h('a', { class: 'btn btn-sm', href: '#/insight' }, '비중 고치기 · 버전 이력(07 Insight)')),
        h('p', { class: 'note' }, 'xlsx 에는 요약·브랜드요약·점수비교·강약점·태그트렌드·선택비교·전문가피드백·운영 시트가 들어갑니다. HTML 은 파일 하나로 열리고 메일로 보내도 모양이 그대로입니다. PPTX 자동 생성은 3단계입니다.')),
      art
    ];
  }

  /* ── 09 전문가(디자이너) 피드백 ──────── */
  var fbState = { status: '', target: '' };
  function viewFeedback(preset) {
    var list = db.feedback || [];
    var targetSel = h('select', { name: 'target' },
      h('optgroup', { label: '리포트 항목' }, L.REPORT_SECTIONS.map(function (s) { return h('option', { value: s.id, selected: s.id === preset }, s.name); })),
      h('optgroup', { label: '모델' }, L.filterModels(db.models, {}).map(function (m) { return h('option', { value: 'model:' + m.id, selected: 'model:' + m.id === preset }, L.brandShort(m.brand) + ' ' + m.model_name); })));
    var typeSel = selectEl('type', L.FEEDBACK_TYPES, L.FEEDBACK_TYPES[1]);
    var rating = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': '평가' }, [1, 2, 3, 4, 5].map(function (n) {
      return h('label', { class: 'opt' }, h('input', { type: 'radio', name: 'rating', value: String(n), checked: n === 3 }), h('span', { class: 't' }, n + '점'));
    }));
    var comment = h('textarea', { name: 'comment', rows: 4, placeholder: '예) 실제 디자인 관점에서는 「Chiseled」보다 「Technical / Functional」에 가깝습니다.' });
    var author = h('input', { name: 'author', value: db.lastAuthor || '', placeholder: '예) 디자인팀 홍길동', autocomplete: 'name' });
    var form = h('form', { novalidate: true, onsubmit: function (e) {
      e.preventDefault();
      var r = form.querySelector('input[name=rating]:checked');
      var res = L.addFeedback(list, { target: targetSel.value, type: typeSel.value, rating: r ? Number(r.value) : 0, comment: comment.value, author: author.value },
        new Date(), scopeNow() ? scopeNow().scope_id : '');
      if (!res.ok) {
        var names = { target: '대상', type: '분류', rating: '평가', author: '작성자', comment: '코멘트(「동의」가 아니면 필수)' };
        toast('확인해 주세요: ' + res.errors.map(function (k) { return names[k]; }).join(', '), true);
        return;
      }
      db.feedback = res.list; db.lastAuthor = author.value.trim();
      save(); toast(res.item.id + ' 피드백을 기록했습니다.'); go('#/feedback');
    } },
      h('div', { class: 'form-grid' },
        field('대상', targetSel, { req: true }), field('분류', typeSel, { req: true }),
        field('평가 (1 매우 부족 ~ 5 매우 좋음)', rating, { req: true, span: true }),
        field('코멘트', comment, { span: true, hint: '「동의(수정 없음)」이 아니면 무엇을 어떻게 고칠지 적어 주세요.' }),
        field('작성자', author, { req: true, hint: '이 브라우저에 기억해 둡니다.' })),
      h('div', { class: 'btn-row', style: 'margin-top:12px' }, h('button', { type: 'submit', class: 'btn btn-primary' }, '피드백 기록')));

    var summary = L.feedbackSummary(list).filter(function (r) { return r.count; });
    var shown = list.filter(function (x) { return (!fbState.status || x.status === fbState.status) && (!fbState.target || x.target === fbState.target); }).slice().reverse();
    var fStatus = selectEl('fs', L.FEEDBACK_STATUS, fbState.status, '상태 전체');
    fStatus.addEventListener('change', function () { fbState.status = fStatus.value; render(); });
    var targets = list.map(function (x) { return x.target; }).filter(function (t, i, a) { return a.indexOf(t) === i; });
    var fTarget = selectEl('ft', targets.map(function (t) { return { value: t, label: L.feedbackTargetLabel(t, db.models) }; }), fbState.target, '대상 전체');
    fTarget.addEventListener('change', function () { fbState.target = fTarget.value; render(); });

    return [
      pageHead('STAGE 09', '전문가 피드백', '분석·리포트 항목과 모델별로 디자이너가 평가(1~5)와 코멘트를 남깁니다. 기록은 고치지 않고 쌓으며, 반영하면 상태만 「반영됨」으로 바꿉니다(작성자·시각 보존).'),
      h('section', { class: 'card' }, h('h2', null, '피드백 남기기'), form),
      summary.length ? h('section', { class: 'card' }, h('h2', null, '항목별 요약'), h('div', { class: 'table-wrap' }, h('table', { class: 'list' },
        h('thead', null, h('tr', null, ['대상', '건수', '평균 평가', '열림', '분류', '최근 작성'].map(function (t, i) { return h('th', { scope: 'col', class: i && i < 4 ? 'num' : null }, t); }))),
        h('tbody', null, summary.map(function (r) {
          return h('tr', null, h('th', { scope: 'row' }, L.feedbackTargetLabel(r.target, db.models)), h('td', { class: 'num' }, String(r.count)), h('td', { class: 'num' }, String(r.avg)),
            h('td', { class: 'num' + (r.open ? '' : ' zero') }, String(r.open)), h('td', null, r.types.map(function (x) { return x.type + ' ' + x.count; }).join(', ')), h('td', null, r.latest));
        }))))) : null,
      h('section', { class: 'card' },
        h('div', { class: 'page-head', style: 'margin-bottom:10px' }, h('h2', { class: 'titles', style: 'margin:0' }, '기록 ' + shown.length + '건'), h('div', { class: 'btn-row' }, fStatus, fTarget)),
        shown.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'list' },
          h('thead', null, h('tr', null, ['ID', '대상', '분류', '평가', '코멘트', '작성자', '작성 시각', '상태', ''].map(function (t) { return h('th', { scope: 'col' }, t); }))),
          h('tbody', null, shown.map(function (x) {
            var done = x.status === '반영됨';
            return h('tr', null, h('td', null, x.id), h('td', null, x.target.indexOf('model:') === 0 ? h('a', { href: '#/model/' + x.target.slice(6) }, L.feedbackTargetLabel(x.target, db.models)) : L.feedbackTargetLabel(x.target, db.models)),
              h('td', null, x.type), h('td', { class: 'num' }, x.rating + ' / 5'), h('td', { class: 'pre' }, x.comment || '-'), h('td', null, x.author), h('td', null, x.created_at),
              h('td', null, h('span', { class: 'tag ' + (done ? 'ok' : 'warn') }, x.status), done && x.resolved_at ? h('div', { class: 'note' }, x.resolved_at) : null),
              h('td', null, h('button', { type: 'button', class: 'btn btn-sm', onclick: function () {
                db.feedback = L.setFeedbackStatus(db.feedback, x.id, done ? '열림' : '반영됨', new Date()); save(); render();
              } }, done ? '다시 열기' : '반영됨으로'))); })))) : h('p', { class: 'note' }, '조건에 맞는 기록이 없습니다.'))
    ];
  }

  /* ── 10 정기 업데이트 · 운영 루프 ────── */
  function opsNow() {
    return L.opsStatus(db.ops, db.models, new Date(), { openFeedback: (db.feedback || []).filter(function (x) { return x.status !== '반영됨'; }).length });
  }
  function viewOps() {
    var st = opsNow();
    var ops = db.ops;
    var cyc = selectEl('cycle', L.UPDATE_CYCLES.map(function (c) { return { value: c.id, label: c.name }; }), ops.cycle);
    var staleIn = h('input', { name: 'stale', type: 'number', min: 7, max: L.STALE_DAYS_MAX, value: String(ops.stale_days), inputmode: 'numeric' });
    var lastIn = h('input', { name: 'last', type: 'date', value: ops.last_update || '' });
    function saveSettings() {
      var o = L.restoreOps({ cycle: cyc.value, stale_days: staleIn.value, last_update: lastIn.value, steps: ops.steps, history: ops.history, defaults: 3 });
      if (String(o.stale_days) !== String(Number(staleIn.value))) toast('오래된 자료 기준은 7~' + L.STALE_DAYS_MAX + '일(30년)입니다. ' + o.stale_days + '일로 두었습니다.', true);
      db.ops = o; save(); toast('운영 설정을 저장했습니다.'); render();
    }
    var stateText = { none: '갱신 기록이 없습니다', ok: st.daysLeft + '일 남음', soon: st.daysLeft + '일 남음', due: '오늘 예정', overdue: (-st.daysLeft) + '일 지남' }[st.state];
    var alert = st.state === 'overdue' ? h('p', { class: 'alert warn' }, '다음 업데이트 예정일(' + st.next + ')이 ' + (-st.daysLeft) + '일 지났습니다. 아래 단계를 진행하고 「이번 사이클 완료」를 눌러 주세요.')
      : st.state === 'due' || st.state === 'soon' ? h('p', { class: 'alert info' }, '다음 업데이트 예정일은 ' + st.next + ' 입니다(' + stateText + ').')
      : st.state === 'none' ? h('p', { class: 'alert info' }, '아직 사이클을 완료한 적이 없습니다. 첫 수집을 마쳤다면 「이번 사이클 완료」를 누르거나 마지막 갱신일을 직접 적어 주세요.') : null;
    var hint = { qa: st.hints.qa ? '필수 메타 누락 ' + st.hints.qa + '건 남음' : '누락 없음', analyze: st.hints.analyze ? '평가 점수 없는 모델 ' + st.hints.analyze + '건' : '모두 평가됨',
      feedback: st.hints.feedback ? '열린 피드백 ' + st.hints.feedback + '건' : '열린 피드백 없음', collect: st.stale.length ? '오래된 자료 ' + st.stale.length + '건 재확인' : '' };
    var steps = h('ol', { class: 'loop' }, L.OPS_STEPS.map(function (s) {
      var on = !!ops.steps[s.id];
      return h('li', { class: on ? 'done' : null },
        h('label', { class: 'opt' }, h('input', { type: 'checkbox', checked: on, onchange: function (e) { db.ops = L.toggleStep(db.ops, s.id, e.target.checked, new Date()); save(); render(); } }),
          h('span', { class: 't' }, s.name), h('span', { class: 's' }, (on ? '체크 ' + ops.steps[s.id] + ' · ' : '') + (hint[s.id] || ''))),
        h('a', { class: 'btn btn-sm', href: s.href }, s.menu));
    }));
    var noteIn = h('input', { name: 'note', placeholder: '예) 신규 2건 등록, CMF Taxonomy 에 Matte 추가' });
    return [
      pageHead('STAGE 10', '정기 업데이트 · 운영 루프', '업데이트 주기를 정하고, 한 바퀴(수집 → 점검 → 평가 → 인사이트 → 리포트 → 피드백 → 보정)를 체크하며 돌립니다. 자동 재수집은 3단계이고, 지금은 예정일·오래된 자료를 알려 주는 방식입니다.'),
      alert,
      h('div', { class: 'tiles' }, [['업데이트 주기', st.cycle.name], ['마지막 갱신일', st.last || '-'], ['다음 예정일', st.next || '-'], ['예정일까지', stateText],
        ['오래된 자료(' + L.staleLabel(st.staleDays) + '+)', st.stale.length + '건'], ['수집일 없음', st.undated.length + '건']].map(function (t) {
        return h('div', { class: 'tile' }, h('div', { class: 'k' }, t[0]), h('div', { class: 'v' }, t[1])); })),
      h('div', { class: 'grid-2' },
        h('section', { class: 'card' }, h('h2', null, '이번 사이클 (' + st.stepsDone + ' / ' + st.stepsTotal + ')'), steps,
          h('div', { class: 'form-grid', style: 'margin-top:12px' }, field('완료 메모 (보정 내용 등)', noteIn, { span: true })),
          h('div', { class: 'btn-row', style: 'margin-top:10px' }, h('button', { type: 'button', class: 'btn btn-primary', onclick: function () {
            var doIt = function () { db.ops = L.completeCycle(db.ops, new Date(), noteIn.value, db.models.length); save(); toast('사이클을 완료했습니다. 다음 예정일은 ' + L.nextDue(db.ops.last_update, db.ops.cycle) + ' 입니다.'); render(); };
            if (st.stepsDone < st.stepsTotal) confirmBox('사이클 완료', '체크하지 않은 단계가 ' + (st.stepsTotal - st.stepsDone) + '개 있습니다. 그래도 오늘을 마지막 갱신일로 기록할까요?', '완료 기록', doIt);
            else doIt();
          } }, '이번 사이클 완료'))),
        h('section', { class: 'card' }, h('h2', null, '설정'),
          h('div', { class: 'form-grid' }, field('업데이트 주기', cyc), field('오래된 자료 기준(일)', staleIn, { hint: '수집일이 이보다 오래되면 경고합니다. 기본 7305일 = 20년(수집일 기준).' }),
            field('마지막 갱신일', lastIn, { hint: '보통은 「이번 사이클 완료」가 채웁니다.' })),
          h('div', { class: 'btn-row', style: 'margin-top:10px' }, h('button', { type: 'button', class: 'btn', onclick: saveSettings }, '설정 저장')))),
      h('section', { class: 'card' }, h('h2', null, '오래된 자료 · 수집일 없음'),
        st.stale.length || st.undated.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'list' },
          h('thead', null, h('tr', null, ['모델', '수집일', '경과', ''].map(function (t) { return h('th', { scope: 'col' }, t); }))),
          h('tbody', null, st.stale.map(function (s) {
            return h('tr', null, h('th', { scope: 'row' }, h('a', { href: '#/model/' + s.id }, L.brandShort(s.brand) + ' ' + s.model_name)), h('td', null, s.collected_at), h('td', { class: 'num' }, s.age + '일'),
              h('td', null, h('a', { class: 'btn btn-sm', href: '#/edit/' + s.id }, '다시 확인·수정')));
          }).concat(st.undated.map(function (s) {
            return h('tr', null, h('th', { scope: 'row' }, h('a', { href: '#/model/' + s.id }, L.brandShort(s.brand) + ' ' + s.model_name)), h('td', null, '없음'), h('td', null, '-'),
              h('td', null, h('a', { class: 'btn btn-sm', href: '#/edit/' + s.id }, '수집일 넣기')));
          }))))) : h('p', { class: 'note' }, '기준보다 오래된 자료가 없습니다.')),
      h('section', { class: 'card' }, h('h2', null, '업데이트 이력'),
        ops.history.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'list' },
          h('thead', null, h('tr', null, ['완료일', '주기', '체크한 단계', '모델 수', '메모'].map(function (t) { return h('th', { scope: 'col' }, t); }))),
          h('tbody', null, ops.history.map(function (x) {
            return h('tr', null, h('td', null, x.date), h('td', null, (L.UPDATE_CYCLES.filter(function (c) { return c.id === x.cycle; })[0] || { name: '-' }).name),
              h('td', null, x.steps_done.length + ' / ' + L.OPS_STEPS.length), h('td', { class: 'num' }, String(x.models || '-')), h('td', null, x.note || '-'));
          })))) : h('p', { class: 'note' }, '아직 완료한 사이클이 없습니다.'))
    ];
  }

  /* ── 라우터 ─────────────────────────── */
  function render() {
    var route = location.hash || (db.scopes.length ? '#/dashboard' : '#/scope');
    var parts = route.replace(/^#\//, '').split('/');
    var view;
    switch (parts[0]) {
      case 'dashboard': view = viewDashboard(); break;
      case 'gallery': view = viewGallery(); break;
      case 'compare': view = viewCompare(); break;
      case 'edit': view = viewEdit(parts[1] ? decodeURIComponent(parts[1]) : ''); break;
      case 'model': view = viewDetail(decodeURIComponent(parts[1] || '')); break;
      case 'data': view = viewData(); break;
      case 'insight': view = viewInsight(); break;
      case 'report': view = viewReport(); break;
      case 'feedback': view = viewFeedback(parts[1] ? decodeURIComponent(parts[1]) : ''); break;
      case 'ops': view = viewOps(); break;
      default: route = '#/scope'; view = viewScope();
    }
    renderChrome(route);
    main.innerHTML = '';
    append(main, view);
    main.setAttribute('data-route', route);
  }
  var lastRoute = '';
  window.addEventListener('hashchange', function () {
    if (location.hash.indexOf('#/scope') !== 0) scopeDraft = null;
    render();
    if (lastRoute !== location.hash) { window.scrollTo(0, 0); main.focus({ preventScroll: true }); }
    lastRoute = location.hash;
  });
  render();
})();
