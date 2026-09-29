# 클래식 Outlook 메일을 업무보고 도구로 가져오기

과제 B(`report/index.html`)는 브라우저 도구라서 Outlook 에 직접 들어가지 못합니다. 메일을 **파일(.eml)** 로 꺼내 주면 그 파일을 읽습니다.
Microsoft Graph API(관리자 승인 필요)가 없어도 되는 방법을 쉬운 순서로 적었습니다.

## 먼저 — 「대상 메일 폴더」는 무엇인가요?

**Outlook 안의 메일 폴더**입니다. 예: 「받은 편지함」, 「받은 편지함\프로젝트A」, 「보낸 편지함」.
내 PC 디스크의 경로(`C:\…\Outlook\*.ost`)가 아닙니다. 어느 폴더의 메일을 보고서 근거로 쓸지(규칙으로 따로 모으는 폴더가 있는지, 보낸 메일도 넣을지)를 여쭤본 것입니다.

## 방법 비교

| 방법 | 여러 통 | 회신 흐름(Message-ID) | 준비 | 비고 |
|---|---|---|---|---|
| ① 내보내기 스크립트 `Export-OutlookMail.ps1` (권장) | 폴더째·기간 지정 | 유지 | PowerShell 실행 허용 | 읽기 전용. 첨부는 이름·크기만 |
| ② 메일을 끌어 놓기 | 몇 통 | — | 없음 | 클래식 Outlook 은 `.msg` 가 되는데 브라우저가 못 읽음 → ③ 이나 붙여 넣기 |
| ③ 다른 이름으로 저장 → 텍스트(.txt) | 한 통씩 | 없음 | 없음 | 도구가 .txt 머리글(보낸 사람·보낸 날짜·제목)을 읽음 |
| ④ 파일 → 열기 및 내보내기 → 내보내기(PST·CSV) | 폴더째 | CSV 는 없음 | 없음 | PST 는 브라우저가 못 읽음, CSV 는 본문·스레드가 잘려 권하지 않음 |
| ⑤ VBA 매크로(아래) | 폴더째 | 없음(.txt) | 매크로 허용 | 스크립트가 막히고 매크로는 되는 PC 용 |

## ① 내보내기 스크립트 (권장)

`Export-OutlookMail.ps1` 은 **내 PC 의 클래식 Outlook** 에서 고른 폴더의 기간 안 메일을 `.eml` 로 저장합니다.

- **읽기 전용** — 메일을 옮기거나 지우거나 「읽음」으로 바꾸지 않습니다. 저장은 지정한 폴더에만 합니다.
- **밖으로 보내지 않습니다** — 인터넷·서버 연결이 없습니다. Outlook(COM)과 내 PC 파일만 씁니다.
- 첨부 파일 **내용은 저장하지 않고** 이름·크기만 적습니다(업무보고 도구가 쓰는 것은 첨부 이름).
- 회신·전달 흐름(Message-ID · In-Reply-To · References)을 그대로 남겨 도구가 업무 단위로 묶을 수 있습니다.

### 실행

1. 이 파일을 내려받아 예: `C:\업무보고\Export-OutlookMail.ps1` 에 둡니다. Outlook 을 켜 둡니다.
2. 시작 메뉴에서 「Windows PowerShell」을 열고:

```powershell
cd C:\업무보고
# 폴더 고르는 창이 뜹니다. 9/28(월) ~ 10/2(금) 메일
powershell -ExecutionPolicy Bypass -File .\Export-OutlookMail.ps1 -From 2026-09-28 -To 2026-10-02

# 폴더를 이름으로, 하위 폴더와 보낸 편지함까지, 저장 위치 지정
powershell -ExecutionPolicy Bypass -File .\Export-OutlookMail.ps1 -FolderPath "받은 편지함\프로젝트A" -Recurse -IncludeSent -From 2026-09-28 -To 2026-10-02 -OutDir "C:\업무보고\메일_0928"

# 저장하지 않고 대상 목록만 확인
powershell -ExecutionPolicy Bypass -File .\Export-OutlookMail.ps1 -From 2026-09-28 -To 2026-10-02 -ListOnly
```

3. `report/index.html` → 「02 메일·자료 입력」 → 「메일 파일 불러오기」에서 저장 폴더의 `.eml` 을 모두 고릅니다(Ctrl+A).

| 옵션 | 뜻 | 기본값 |
|---|---|---|
| `-FolderPath` | Outlook 폴더(예: `받은 편지함\프로젝트A`). 비우면 고르기 창 | 고르기 창 |
| `-From` · `-To` | 기간(`To` 날짜의 24시까지) | 7일 전 ~ 오늘 |
| `-OutDir` | 저장 폴더 | 바탕화면\outlook-eml |
| `-Recurse` | 하위 폴더 포함 | 끔 |
| `-IncludeSent` | 보낸 편지함의 같은 기간 메일도 | 끔 |
| `-ListOnly` | 목록만 보기 | 끔 |

### 막힐 때

- **「스크립트를 실행할 수 없습니다」** — 회사 정책으로 막힌 경우입니다. 위처럼 `-ExecutionPolicy Bypass` 로 이 파일 하나만 허용해 실행하거나, IT 담당에 문의해 주세요. 정책상 안 되면 ⑤ VBA 나 ③ 을 씁니다.
- **「다른 프로그램이 Outlook 의 전자 메일 주소 정보에 액세스하려고 합니다」** 창 — Outlook 보안 확인입니다. 「허용」 후 시간을 골라 주세요(백신이 최신이면 대개 뜨지 않습니다).
- 한글이 깨지면 파일이 UTF-8(BOM)로 저장되어 있는지 확인해 주세요(깃허브에서 받은 원본은 BOM 포함).

## ⑤ VBA 매크로 (스크립트가 막힌 PC 용)

Outlook 에서 `Alt + F11` → 「삽입 → 모듈」에 붙여 넣고 `F5`. 고른 폴더의 기간 안 메일을 `.txt`(Outlook 텍스트 저장)로 저장합니다. 읽기 전용이며, 회신 흐름(Message-ID)은 남지 않아 도구는 제목으로만 묶습니다.

```vba
Sub ExportMailAsText()
    Dim f As Outlook.MAPIFolder, it As Object, items As Outlook.Items
    Dim fromDay As Date, toDay As Date, outDir As String, n As Long, nm As String
    Set f = Application.Session.PickFolder
    If f Is Nothing Then Exit Sub
    fromDay = CDate(InputBox("시작일 (예: 2026-09-28)"))
    toDay = CDate(InputBox("종료일 (예: 2026-10-02)")) + 1
    outDir = Environ("USERPROFILE") & "\Desktop\outlook-txt\"
    If Dir(outDir, vbDirectory) = "" Then MkDir outDir
    Set items = f.Items
    items.Sort "[ReceivedTime]", True
    For Each it In items
        If it.Class = olMail Then
            If it.ReceivedTime < fromDay Then Exit For
            If it.ReceivedTime < toDay Then
                n = n + 1
                nm = Format(it.ReceivedTime, "yyyymmdd_hhnn") & "_" & n & ".txt"
                it.SaveAs outDir & nm, olTXT
            End If
        End If
    Next
    MsgBox n & "통 저장: " & outDir
End Sub
```

## 다음 단계 — Agent 가 Outlook 을 직접 읽는 설계

지금은 「사람이 내보내기 → 도구가 읽기 → (선택) 사내 AI 로 분류」입니다. 다음 단계는 사람 손을 빼는 것이고, 길이 둘입니다.

1. **PC 에서 COM 으로 직접 (Graph 승인 없이)** — 이 스크립트를 그대로 발전시켜, 정해진 시간(작업 스케줄러)에 폴더를 읽고 → 사내 LLM(OpenAI 호환 주소)에 분류를 요청하고 → 보고서 초안 파일을 만드는 **로컬 Agent**(PowerShell 또는 Python `pywin32`). 메일·AI 모두 사내망 안에서 끝납니다. 사용자 PC 와 Outlook 이 켜져 있어야 합니다.
2. **Microsoft Graph API (승인 후)** — IT 가 앱 등록·`Mail.Read` 권한을 승인하면 서버에서 사용자 메일함을 읽을 수 있어 PC 가 꺼져 있어도 됩니다. Power Automate 의 Outlook 커넥터도 같은 권한 체계입니다.

어느 쪽이든 결과를 이 도구가 읽는 `.eml`(또는 같은 모양의 JSON)으로 넘기면 분류·근거·보고서 부분은 그대로 씁니다.
