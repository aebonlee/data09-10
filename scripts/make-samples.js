// 예시 데이터 파일 생성: node scripts/make-samples.js
// 전부 가상 자료입니다. 「예시-」 모델명, 가상 제원, example.com 출처.
const fs = require('fs');
const path = require('path');
const XLSX = require('../vendor/xlsx.full.min.js');
const L = require('../js/logic.js');
const Sample = require('../js/sample-data.js');

const out = path.join(__dirname, '..', 'samples');
fs.mkdirSync(out, { recursive: true });

// 1) 열 이름이 스키마와 다른 「사내 정리표」 — 열 연결 연습용
const sheet = Sample.importSheet();
let wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheet), '예시');
fs.writeFileSync(path.join(out, '예시데이터_사내정리표.xlsx'), XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }));
fs.writeFileSync(path.join(out, '예시데이터_사내정리표.csv'), L.toCsv(sheet));

// 2) 예시 KB 를 이 도구의 내보내기 형식으로 (이미지는 브라우저 보관이라 경로 칸에 표시만)
const db = Sample.build(new Date(2026, 8, 28));
wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(L.modelsToSheet(db.models)), '모델목록');
fs.writeFileSync(path.join(out, '예시데이터_모델목록.xlsx'), XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }));

// 검증: 방금 쓴 파일을 앱과 같은 방식으로 다시 읽어 가져오기 결과를 확인
function readBack(file) {
  const b = XLSX.read(fs.readFileSync(path.join(out, file)), { type: 'buffer', cellDates: true });
  return XLSX.utils.sheet_to_json(b.Sheets[b.SheetNames[0]], { header: 1, raw: true, defval: '' });
}
const r1 = readBack('예시데이터_사내정리표.xlsx');
const res1 = L.rowsToModels(r1, L.guessMapping(r1[0]), {});
const r2 = readBack('예시데이터_모델목록.xlsx');
const res2 = L.rowsToModels(r2, L.guessMapping(r2[0]), {});
const csv = L.parseCsv(fs.readFileSync(path.join(out, '예시데이터_사내정리표.csv'), 'utf8'));
const res3 = L.rowsToModels(csv, L.guessMapping(csv[0]), {});
console.log('사내정리표 xlsx:', res1.models.length, '건, 건너뜀', res1.skipped.length);
console.log('사내정리표 csv :', res3.models.length, '건, 건너뜀', res3.skipped.length);
console.log('모델목록 xlsx  :', res2.models.length, '건 (원본', db.models.length + ')');
if (res1.models.length !== 4 || res3.models.length !== 4 || res2.models.length !== db.models.length) { console.error('왕복 불일치'); process.exit(1); }
