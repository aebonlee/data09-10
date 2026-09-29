<#
.SYNOPSIS
  클래식 Outlook 의 메일 폴더에서 기간 안의 메일을 .eml 파일로 저장합니다. (과제 B 업무보고 Agent 입력용)

.DESCRIPTION
  - 읽기 전용입니다. Outlook 안의 메일을 옮기거나 지우거나 「읽음」으로 바꾸지 않습니다.
    (메일 항목에서 제목·보낸이·날짜·본문·첨부 이름만 읽고, 저장은 -OutDir 폴더에만 합니다)
  - 저장한 .eml 은 report/index.html 의 「02 메일·자료 입력 → 메일 파일 불러오기」로 한 번에 넣습니다.
  - 첨부 파일 내용은 저장하지 않고 이름과 크기만 적습니다(업무보고 도구가 쓰는 것은 첨부 이름뿐).
  - 본문은 Outlook 의 텍스트 본문(MailItem.Body)입니다.
  - Microsoft Graph API 나 관리자 승인이 필요 없습니다. 내 PC 의 클래식 Outlook(COM)만 씁니다.

.PARAMETER FolderPath
  Outlook 메일 폴더 경로. 「받은 편지함」 또는 「받은 편지함\프로젝트A」처럼 적습니다(디스크 경로가 아닙니다).
  비워 두면 Outlook 의 폴더 고르기 창이 뜹니다.

.PARAMETER From
  시작일(이날 0시부터). 예: 2026-09-28. 기본값: 7일 전.

.PARAMETER To
  종료일(이날 24시까지). 예: 2026-10-02. 기본값: 오늘.

.PARAMETER OutDir
  .eml 을 저장할 폴더. 기본값: 바탕화면\outlook-eml

.PARAMETER Recurse
  하위 폴더까지 함께 저장합니다.

.PARAMETER IncludeSent
  보낸 편지함에서도 같은 기간의 메일을 함께 저장합니다(내가 보낸 회신·요청도 업무 근거가 될 때).

.PARAMETER ListOnly
  저장하지 않고 대상 메일 목록만 보여 줍니다.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\Export-OutlookMail.ps1 -From 2026-09-28 -To 2026-10-02
  (폴더 고르기 창이 뜹니다)

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\Export-OutlookMail.ps1 -FolderPath "받은 편지함\프로젝트A" -Recurse -IncludeSent -From 2026-09-28 -To 2026-10-02 -OutDir "C:\업무보고\2026-09-28"

.NOTES
  data09-10 과제 B · 2026-09-29. 이 파일은 UTF-8(BOM)로 저장되어 있습니다 — Windows PowerShell 5.1 에서 한글이 깨지지 않게.
  회사 정책으로 스크립트 실행이 막혀 있으면 tools/outlook/README.md 의 다른 방법(끌어 놓기·내보내기·VBA)을 써 주세요.
#>
[CmdletBinding()]
param(
  [string]$FolderPath = '',
  [datetime]$From = (Get-Date).Date.AddDays(-7),
  [datetime]$To = (Get-Date).Date,
  [string]$OutDir = (Join-Path ([Environment]::GetFolderPath('Desktop')) 'outlook-eml'),
  [switch]$Recurse,
  [switch]$IncludeSent,
  [switch]$ListOnly,
  [int]$MaxItems = 3000
)

$ErrorActionPreference = 'Stop'
$olMail = 43                       # OlObjectClass.olMail — 회의 요청·보고서 등은 건너뜁니다
$olFolderInbox = 6
$olFolderSentMail = 5
$PR_INTERNET_MESSAGE_ID = 'http://schemas.microsoft.com/mapi/proptag/0x1035001F'
$PR_IN_REPLY_TO_ID      = 'http://schemas.microsoft.com/mapi/proptag/0x1042001F'
$PR_INTERNET_REFERENCES = 'http://schemas.microsoft.com/mapi/proptag/0x1039001F'
$PR_ATTACHMENT_HIDDEN   = 'http://schemas.microsoft.com/mapi/proptag/0x7FFE000B'
$Inv = [Globalization.CultureInfo]::InvariantCulture
$Utf8 = New-Object System.Text.UTF8Encoding($false)

function Get-MapiProp($obj, [string]$tag) {
  try { return $obj.PropertyAccessor.GetProperty($tag) } catch { return $null }
}
# RFC 2047 — 한 조각에 15글자씩 나눠 =?UTF-8?B?…?= 로 (긴 제목도 줄 길이를 지킴)
function Encode-Words([string]$text) {
  if ([string]::IsNullOrEmpty($text)) { return '' }
  if ($text -match '^[\x20-\x7E]*$') { return $text }
  $parts = @()
  for ($i = 0; $i -lt $text.Length; $i += 15) {
    $n = [Math]::Min(15, $text.Length - $i)
    if ($n -lt $text.Length - $i -and [char]::IsHighSurrogate($text[$i + $n - 1])) { $n-- }   # 이모지 등을 반으로 자르지 않게
    $parts += '=?UTF-8?B?' + [Convert]::ToBase64String($Utf8.GetBytes($text.Substring($i, $n))) + '?='
    if ($n -lt 15) { $i -= (15 - $n) }
  }
  return ($parts -join "`r`n ")
}
function Wrap-Base64([byte[]]$bytes) {
  $b = [Convert]::ToBase64String($bytes)
  $out = New-Object System.Text.StringBuilder
  for ($i = 0; $i -lt $b.Length; $i += 76) { [void]$out.Append($b.Substring($i, [Math]::Min(76, $b.Length - $i))).Append("`r`n") }
  return $out.ToString()
}
function Format-MailDate([datetime]$t) {
  $off = [TimeZoneInfo]::Local.GetUtcOffset($t)
  $sign = '+'; if ($off.Ticks -lt 0) { $sign = '-'; $off = $off.Negate() }
  return $t.ToString('ddd, dd MMM yyyy HH:mm:ss ', $Inv) + $sign + $off.Hours.ToString('00') + $off.Minutes.ToString('00')
}
function Get-SenderSmtp($item) {
  try {
    if ($item.SenderEmailType -eq 'EX' -and $item.Sender) {
      $u = $item.Sender.GetExchangeUser()
      if ($u -and $u.PrimarySmtpAddress) { return $u.PrimarySmtpAddress }
    }
  } catch { }
  return [string]$item.SenderEmailAddress
}
function Angle([string]$id) {
  if ([string]::IsNullOrWhiteSpace($id)) { return '' }
  $id = $id.Trim(); if (-not $id.StartsWith('<')) { $id = '<' + $id + '>' }
  return $id
}
function Guess-Type([string]$name) {
  switch -regex ($name.ToLower()) {
    '\.png$' { return 'image/png' } '\.jpe?g$' { return 'image/jpeg' } '\.gif$' { return 'image/gif' }
    '\.pdf$' { return 'application/pdf' } '\.xlsx$' { return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
    '\.pptx$' { return 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }
    '\.docx$' { return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
    default { return 'application/octet-stream' }
  }
}

# 메일 1통 → .eml 문자열 (첨부는 이름·크기만 — Content-Disposition 의 size 매개변수, RFC 2183)
function Build-Eml($item, [string]$folderName) {
  $boundary = '----=_data0910_' + [guid]::NewGuid().ToString('N')
  $fromName = [string]$item.SenderName
  $fromAddr = Get-SenderSmtp $item
  $h = New-Object System.Text.StringBuilder
  [void]$h.Append('From: ' + (Encode-Words $fromName) + ' <' + $fromAddr + ">`r`n")
  if ($item.To) { [void]$h.Append('To: ' + (Encode-Words ([string]$item.To)) + "`r`n") }
  if ($item.CC) { [void]$h.Append('Cc: ' + (Encode-Words ([string]$item.CC)) + "`r`n") }
  [void]$h.Append('Date: ' + (Format-MailDate $item.ReceivedTime) + "`r`n")
  [void]$h.Append('Subject: ' + (Encode-Words ([string]$item.Subject)) + "`r`n")
  $mid = Angle (Get-MapiProp $item $PR_INTERNET_MESSAGE_ID)
  $irt = Angle (Get-MapiProp $item $PR_IN_REPLY_TO_ID)
  $refs = [string](Get-MapiProp $item $PR_INTERNET_REFERENCES)
  if ($mid) { [void]$h.Append('Message-ID: ' + $mid + "`r`n") }
  if ($irt) { [void]$h.Append('In-Reply-To: ' + $irt + "`r`n") }
  if ($refs) { [void]$h.Append('References: ' + ($refs.Trim() -replace '\s+', ' ') + "`r`n") }
  [void]$h.Append("MIME-Version: 1.0`r`n")
  [void]$h.Append('X-Outlook-Folder: ' + (Encode-Words $folderName) + "`r`n")
  [void]$h.Append("X-Exported-By: data09-10 Export-OutlookMail.ps1 (read-only)`r`n")

  $body = Wrap-Base64 ($Utf8.GetBytes([string]$item.Body))
  $atts = @()
  foreach ($a in $item.Attachments) {
    if ((Get-MapiProp $a $PR_ATTACHMENT_HIDDEN) -eq $true) { continue }   # 본문에 박힌 그림(서명 로고 등)은 뺍니다
    $atts += ,@([string]$a.FileName, [int64]$a.Size)
  }
  if ($atts.Count -eq 0) {
    [void]$h.Append("Content-Type: text/plain; charset=utf-8`r`nContent-Transfer-Encoding: base64`r`n`r`n")
    [void]$h.Append($body)
    return $h.ToString()
  }
  [void]$h.Append('Content-Type: multipart/mixed; boundary="' + $boundary + "`"`r`n`r`n")
  [void]$h.Append('--' + $boundary + "`r`nContent-Type: text/plain; charset=utf-8`r`nContent-Transfer-Encoding: base64`r`n`r`n" + $body)
  foreach ($x in $atts) {
    $enc = [Uri]::EscapeDataString($x[0])
    [void]$h.Append('--' + $boundary + "`r`n")
    [void]$h.Append('Content-Type: ' + (Guess-Type $x[0]) + "; name*=UTF-8''" + $enc + "`r`n")
    [void]$h.Append("Content-Disposition: attachment; filename*=UTF-8''" + $enc + '; size=' + $x[1] + "`r`n")
    [void]$h.Append("Content-Transfer-Encoding: base64`r`n`r`n")
  }
  [void]$h.Append('--' + $boundary + "--`r`n")
  return $h.ToString()
}

function Find-Folder($ns, [string]$path) {
  $root = $ns.GetDefaultFolder($olFolderInbox).Parent
  $parts = @($path -split '[\\/]+' | Where-Object { $_ -ne '' })
  if ($parts.Count -gt 0 -and $parts[0] -eq $root.Name) { $parts = @($parts | Select-Object -Skip 1) }
  $cur = $root
  foreach ($p in $parts) {
    $next = $null
    foreach ($f in $cur.Folders) { if ($f.Name -eq $p) { $next = $f; break } }
    if (-not $next) {
      $names = @(); foreach ($f in $cur.Folders) { $names += $f.Name }
      throw ("Outlook 폴더 「" + $p + "」를 「" + $cur.Name + "」 아래에서 찾지 못했습니다. 있는 폴더: " + ($names -join ', '))
    }
    $cur = $next
  }
  return $cur
}
function Get-Folders($folder, [bool]$deep) {
  $list = @($folder)
  if ($deep) { foreach ($f in $folder.Folders) { $list += Get-Folders $f $true } }
  return $list
}
function Safe-Name([string]$s) {
  $s = ($s -replace '[\\/:*?"<>|\r\n\t]', '_').Trim()
  if ($s.Length -gt 60) { $s = $s.Substring(0, 60) }
  if (-not $s) { $s = '(제목 없음)' }
  return $s
}

# ── 실행 ──
$start = $From.Date
$end = $To.Date.AddDays(1)           # To 날짜의 24시까지
if ($end -le $start) { throw '종료일(-To)이 시작일(-From)보다 빠릅니다.' }

$ol = New-Object -ComObject Outlook.Application
$ns = $ol.GetNamespace('MAPI')
if ($FolderPath) { $target = Find-Folder $ns $FolderPath }
else {
  $target = $ns.PickFolder()
  if (-not $target) { Write-Host '폴더를 고르지 않아 끝냅니다.'; return }
}
$folders = Get-Folders $target $Recurse.IsPresent
if ($IncludeSent) { $folders += $ns.GetDefaultFolder($olFolderSentMail) }

if (-not $ListOnly) { New-Item -ItemType Directory -Force -Path $OutDir | Out-Null }
$saved = 0; $skipped = 0; $seen = @{}
foreach ($f in $folders) {
  $items = $f.Items
  $items.Sort('[ReceivedTime]', $true)   # 최신부터 — 시작일보다 오래되면 멈춥니다
  $n = 0
  foreach ($it in $items) {
    if ($saved -ge $MaxItems) { break }
    if ($it.Class -ne $olMail) { $skipped++; continue }
    $t = $it.ReceivedTime
    if ($t -ge $end) { continue }
    if ($t -lt $start) { break }
    $name = $t.ToString('yyyyMMdd_HHmm', $Inv) + '_' + (Safe-Name ([string]$it.Subject))
    $file = $name + '.eml'; $k = 2
    while ($seen.ContainsKey($file)) { $file = $name + '_' + $k + '.eml'; $k++ }
    $seen[$file] = 1
    if ($ListOnly) { Write-Host ($f.Name + ' | ' + $t.ToString('yyyy-MM-dd HH:mm', $Inv) + ' | ' + $it.Subject) }
    else { [IO.File]::WriteAllText((Join-Path $OutDir $file), (Build-Eml $it $f.FolderPath), $Utf8) }
    $saved++; $n++
  }
  Write-Host ('  ' + $f.FolderPath + ' : ' + $n + '통')
}
$verb = '저장'; if ($ListOnly) { $verb = '대상' }
Write-Host ('기간 ' + $start.ToString('yyyy-MM-dd', $Inv) + ' ~ ' + $To.ToString('yyyy-MM-dd', $Inv) + ' · 메일 ' + $saved + '통 ' + $verb + ' · 메일이 아닌 항목 ' + $skipped + '개 건너뜀')
if (-not $ListOnly) { Write-Host ('저장 폴더: ' + $OutDir + '  → report/index.html 「02 메일·자료 입력」에서 이 폴더의 .eml 을 모두 골라 불러오세요.') }
