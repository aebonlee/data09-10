/* Design Benchmarking Agent — 화면
   화면 목록(기획서 5장 MVP): Scope Setup · Status Dashboard · Card Gallery · Side-by-Side · 자료 등록 · Detail · 가져오기/내보내기 */
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
    ['#/data', '06', '가져오기·내보내기', '엑셀·CSV·백업']
  ];
  function renderChrome(route) {
    route = route || location.hash || '#/scope';
    var nav = document.getElementById('nav'); nav.innerHTML = '';
    NAV.forEach(function (n) {
      var cur = route === n[0] || route.indexOf(n[0] + '/') === 0 || (n[0] === '#/gallery' && route.indexOf('#/model/') === 0);
      nav.appendChild(h('a', { href: n[0], 'aria-current': cur ? 'page' : null },
        h('span', { class: 'no' }, n[1]), h('span', { class: 't' }, n[2]), h('span', { class: 's' }, n[3]),
        n[0] === '#/compare' && db.compare.length ? h('span', { class: 's' }, '비교함 ' + db.compare.length + '/' + L.MAX_COMPARE) : null));
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
            h('h3', { class: 'titles', style: 'margin:0' }, 'Competitor brands ', h('small', { class: 'note' }, '— 부록 B 13개사, 1개 이상')),
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
      h('section', { class: 'card' }, h('h2', null, '저장한 Scope'), saved)
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
      h('p', { class: 'note' }, '파일을 고르면 긴 변 ' + db.settings.imageMaxPx + 'px 로 줄여 이 브라우저에 보관합니다(설정은 「가져오기·내보내기」). 팀 공용 폴더에 둔 파일은 경로만 적어도 됩니다.'),
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
          h('p', null, '가상의 모델 14건(「예시-」 모델명, 도형 이미지)과 Scope 1개를 넣습니다. 실제 경쟁사 제품 정보가 아닙니다.'),
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
          h('p', { class: 'note', style: 'margin-top:10px' }, '현재 저장 크기 약 ' + S.sizeKb() + 'KB. 브라우저마다 한도(대개 5MB 안팎)가 있어, 이미지가 많아지면 JSON 백업으로 나눠 보관하세요.')))
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
