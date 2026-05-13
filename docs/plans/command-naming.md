# 봇 명령어 네이밍 정리 계획

> 작성: 2026-05-14 · 대상 버전: v0.12.x (별도 릴리스 권장)
> 범위: `apps/bot/src/commands/**`, Discord slash 등록, 운영 문서

---

## 1. 현재 상태 (v0.11.0)

총 26개 슬래시 명령어. 인벤토리:

| 한글 명령어 | 파일 | 분류 |
|---|---|---|
| 등록 | register | 사용자 |
| 일괄등록 | bulkRegister | 운영자 |
| 내정보 | whoami | 사용자 |
| 내정보갱신 | refreshProfileIcon | 사용자 |
| 내전기록 | history | 사용자 |
| 랭킹 | leaderboard | 사용자 |
| 전적 | lookup | 사용자 |
| 지금게임 | currentGame | 사용자 |
| 내전모집 | recruit | RANKED |
| 모집인원추가 | recruitMemberAdd | RANKED |
| 모집인원삭제 | recruitMemberRemove | RANKED |
| 랜덤인원추가 | randomRecruitMembers | RANKED 운영자 |
| 모집강제삭제 | forceDeleteRecruitment | RANKED 운영자 |
| 시리즈목록 | seriesList | RANKED 운영자 |
| 시리즈강제삭제 | forceDeleteSeries | RANKED 운영자 |
| 시리즈조기종료 | earlyCompleteSeries | RANKED 운영자 |
| 경매내전모집 | auctionRecruit | AUCTION |
| 경매내전모집인원추가 | auctionRecruitMemberAdd | AUCTION |
| 경매내전모집인원삭제 | auctionRecruitMemberRemove | AUCTION |
| 경매내전강제삭제 | auctionForceDelete | AUCTION 운영자 |
| **경매내전목록** ⭐ | auctionList | AUCTION 운영자 (v0.11.x 추가) |
| **경매내전조기종료** ⭐ | earlyCancelAuctionTournament | AUCTION 운영자 (v0.11.x 추가) |
| 시즌결과리셋 | resetSeasonResults | 운영자 |
| 오래된내전정리 | cleanupStale | 운영자 |
| mmr수정 | adjustMmr | 운영자 |
| 로그 | logs | 운영자 |

---

## 2. 식별된 일관성 문제

### 2.1 도메인 prefix 가 들쭉날쭉
| Prefix | 의미 | 예시 |
|---|---|---|
| `내전` | 일반적 (RANKED 포함) | 내전모집, 내전기록, 오래된내전정리 |
| `시리즈` | RANKED 시리즈 전용 | 시리즈목록, 시리즈강제삭제, 시리즈조기종료 |
| `모집` | RANKED 모집 전용 | 모집인원추가, 모집강제삭제 |
| `경매내전` | AUCTION 전체 | 경매내전모집, 경매내전강제삭제, 경매내전목록 |

→ "내전 모집" 과 "모집" 이 같은 걸 가리키는 두 이름. RANKED 흐름에서 `모집*` 이면서 `시리즈*` 도 같이 등장.

### 2.2 RANKED ↔ AUCTION 비대칭
- `/모집강제삭제` ↔ AUCTION 등가물 없음 (`/경매내전강제삭제` 가 모집+토너먼트 통째 삭제)
- `/랜덤인원추가` ↔ AUCTION 등가물 없음
- `/경매내전강제삭제` 는 모집+토너먼트 통합 (작용 범위가 RANKED 의 `/모집강제삭제`+`/시리즈강제삭제` 모두 커버) — 운영자가 헷갈리기 쉬움

### 2.3 한영 혼용
- `mmr수정` — 한글 사이에 소문자 영문. 다른 명령어는 모두 한글 또는 영문(`limit` 옵션 같은 것)인데 명령어 자체는 한글 통일이 자연스러움.

### 2.4 Discord subcommand groups 미활용
- Flat list 25+ 개. Discord 자동완성은 알파벳/한글 순으로 보여줘서 같은 도메인 명령이 흩어짐.
- Discord 가 지원하는 `/그룹 서브명령` 패턴 (예: `/내전 모집`, `/내전 시리즈 목록`) 미사용.

### 2.5 동사 위치 비일관
- 명사+동사 (`모집강제삭제`, `시리즈조기종료`) — 한국어 자연스러움
- 명사+명사 (`내정보갱신`, `오래된내전정리`) — 명사화된 동사
- 일관 패턴 없음. 대다수 명사+동사.

---

## 3. 옵션별 정리 방향

### 옵션 A — Subcommand groups (구조적 재편)

Discord 의 `/그룹 서브명령` 패턴으로 도메인별 묶음.

```
/내전 모집 시작
/내전 모집 인원추가
/내전 모집 인원삭제
/내전 모집 강제삭제
/내전 시리즈 목록
/내전 시리즈 강제삭제
/내전 시리즈 조기종료

/경매 모집 시작
/경매 모집 인원추가
/경매 모집 인원삭제
/경매 토너먼트 목록
/경매 토너먼트 조기종료
/경매 강제삭제                  (모집+토너 통합 응급 삭제)

/관리 시즌리셋
/관리 정리
/관리 MMR수정
/관리 로그

/나 정보
/나 갱신
/나 기록
/등록
/일괄등록
/랭킹
/전적
/지금게임
```

**장점**: 도메인이 명확히 묶임. 자동완성에서 발견성 향상. 운영자/사용자 영역 시각 분리.
**단점**:
- Major breaking change — 모든 명령어 이름이 바뀜. 사용자 muscle memory 영향.
- discord.js Slash command 구조 재작성 (`addSubcommandGroup` / `addSubcommand`) 필요 → 핸들러 라우팅 (interactionCreate) 도 재구성.
- 작업량: 26개 명령어 전부 재구성, 약 1~2일.

### 옵션 B — Flat prefix 통일 (단순 rename)

명령어 구조는 유지하되 prefix 만 일관화.

```
변경 안 함:
  /등록, /일괄등록, /내정보, /내정보갱신, /내전기록, /랭킹, /전적, /지금게임,
  /로그, /오래된내전정리, /시즌결과리셋

RANKED ("내전" 통일):
  /내전모집                    (그대로)
  /내전인원추가                ← /모집인원추가
  /내전인원삭제                ← /모집인원삭제
  /내전랜덤인원추가            ← /랜덤인원추가
  /내전모집삭제                ← /모집강제삭제   (운영자, "강제" 단어 어차피 admin 컨텍스트라 생략)
  /내전목록                    ← /시리즈목록     ("시리즈" 단어 통일 — 사용자는 "내전" 이라 부름)
  /내전조기종료                ← /시리즈조기종료
  /내전강제삭제                ← /시리즈강제삭제

AUCTION ("경매" 통일, "내전" 중복 제거):
  /경매모집                    ← /경매내전모집
  /경매인원추가                ← /경매내전모집인원추가
  /경매인원삭제                ← /경매내전모집인원삭제
  /경매목록                    ← /경매내전목록
  /경매조기종료                ← /경매내전조기종료
  /경매강제삭제                ← /경매내전강제삭제

운영자:
  /MMR수정                     ← /mmr수정 (대문자 영문)
```

**장점**:
- 단어 길이 짧아짐 (경매내전모집인원추가 9자 → 경매인원추가 6자).
- "내전" / "시리즈" / "모집" 혼란 제거.
- Flat 구조 유지 — discord 재구성 불필요.
- 핸들러 로직 그대로, command name + description 만 변경.

**단점**:
- 여전히 모든 운영자 명령어가 같은 list 에 흩어짐 (subcommand group 안 씀).
- "경매" 만으로 의미 명확한지 (경매 ≠ 경매내전?) — 단어 컨벤션이지만 익숙해질 필요.
- breaking — discord 자동완성에서 옛 이름 안 보임.

작업량: 26개 중 ~12개 rename. 약 2~4시간.

### 옵션 C — 현 네이밍 유지 + 문서/가이드 보강

`docs/runbook/commands.md` 같은 운영자 매뉴얼 추가. `/도움말` 슬래시 명령 가능.

**장점**: breaking change 0. 사용자 영향 0.
**단점**: 근본 일관성 문제 안 풀림.

---

## 4. 권장: **옵션 B (Flat prefix 통일)**

### 이유
1. **옵션 A 의 ROI 가 낮다** — subcommand groups 는 발견성 개선 효과 있으나, 1인 운영 환경에서 명령어 26개는 자동완성으로도 충분히 찾을 수 있다. 재구성 비용 대비 효용 작음.
2. **옵션 B 는 핵심 혼란만 짧게 해결** — "내전" / "시리즈" / "모집" / "경매내전" 4중 prefix 가 2중 (내전 / 경매) 로 단순화. 운영자가 RANKED ↔ AUCTION 페어를 한 줄로 비교 가능.
3. **단어 짧아져 모바일 입력 편함**.

### 단계
1. 옵션 B 의 새 이름으로 `data.setName()` 만 변경 (코드 로직 변경 X).
2. 한 릴리스 (v0.12.0) 안에 일괄 변경 — Discord 가 이전 이름 자동 제거 (slash command 재등록).
3. 운영자에게 안내 (`/도움말` 또는 채널 공지).

### 비-목표
- 옵션 A 의 subcommand groups 는 명령어 수가 50+ 가 되거나, 일반 사용자가 자주 쓰는 명령이 늘면 재검토.

---

## 5. 옵션 B 의 구체 변경 매핑

| 옛 이름 | 새 이름 | breaking? |
|---|---|---|
| 모집인원추가 | 내전인원추가 | yes |
| 모집인원삭제 | 내전인원삭제 | yes |
| 랜덤인원추가 | 내전랜덤인원추가 | yes |
| 모집강제삭제 | 내전모집삭제 | yes |
| 시리즈목록 | 내전목록 | yes |
| 시리즈강제삭제 | 내전강제삭제 | yes |
| 시리즈조기종료 | 내전조기종료 | yes |
| 경매내전모집 | 경매모집 | yes |
| 경매내전모집인원추가 | 경매인원추가 | yes |
| 경매내전모집인원삭제 | 경매인원삭제 | yes |
| 경매내전강제삭제 | 경매강제삭제 | yes |
| 경매내전목록 | 경매목록 | yes |
| 경매내전조기종료 | 경매조기종료 | yes |
| mmr수정 | MMR수정 | yes |

총 14개 변경. 나머지 12개는 유지.

---

## 6. 검증 체크리스트 (옵션 B 진행 시)

- [ ] `apps/bot/src/commands/*.ts` 의 `setName()` 한 줄씩 변경
- [ ] 기존 button customId / select customId 가 옛 이름 참조하면 그것도 (대부분 한글 단어 안 쓰고 `admin:confirm:*` 같은 영문이라 영향 미미)
- [ ] `apps/bot/src/utils/operator.ts` / `permissions.ts` 가 명령어 이름 기반 권한 분기하면 동기화
- [ ] 운영 채널에 변경 공지 후 `pnpm deploy:vps` — Discord 가 자동으로 옛 이름 unregister + 새 이름 register
- [ ] `pnpm test` + 4 패키지 typecheck pass

---

## 7. 다음 단계 (이 plan 밖)

- `/도움말` 명령어 추가 — 명령어 분류별 목록 + 짧은 설명 embed
- 운영자 권한 명령어만 별도 그룹화 (description 에 `[운영자]` 일관 prefix — 이미 거의 일관)
