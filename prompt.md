# monkey 사용법 인포그래픽 — 이미지 생성 프롬프트 모음

> 6개 인포그래픽으로 monkey (LoL 내전 운영 봇 + Discord Activity) 사용 흐름 전체 커버.
> 각 프롬프트는 GPT Image 2 / Nano Banana / Imagen 등 고성능 모델 기준 영어로 작성. 이미지 안에 들어갈 한국어 글자는 따옴표 안에 정확한 글자로 명시.
> 디자인 톤: daisyUI minimalism + 의미 기반 컬러 + LoL 게이밍 액센트 (골드/사파이어/마젠타) + Discord 보라.
> 공통 negative: no watermark, no random English placeholder text, no Lorem Ipsum, no fake brand logos.

---

## 1. Hero — "monkey 한눈에" (Periodic-Table Overview)

**용도**: README 상단, 공식 발표용. monkey 가 무엇을 어떤 흐름으로 해주는지 한 장으로 압축.

**프롬프트:**

```
Create a high-end hero infographic introducing "monkey" — a Discord-integrated tournament platform for League of Legends 5v5 custom matches. Design it like a futuristic periodic table fused with a sleek control panel from a premium gaming UI: a precise 6-cell grid (3 columns × 2 rows) of mini scenes, each illustrating one stage of the workflow — Riot account registration, recruitment posting, team-entry editing, draft pick/ban, match result input, and MMR/ELO update. Each cell carries a short Korean label rendered crisply: "1. 라이엇 등록", "2. 내전 모집", "3. 엔트리 편성", "4. 픽밴", "5. 결과 입력", "6. MMR 갱신". A bold central headline reads in Korean: "monkey — LoL 내전을 더 쉽게". A subdued Korean tagline beneath it reads "Discord 한 곳에서, 모집부터 전적까지". Tiny English subtitles like "STAGE 01" through "STAGE 06" appear above each cell as monospaced micro-labels. The overall mood is electric, premium, modern — dark navy background (#0E1116) with subtle dot-grid texture, Discord blurple (#5865F2) for primary accents, LoL gold (#C8AA6E) for stage numerals, sapphire and magenta glow for connecting flow lines that subtly thread cells in reading order. Use thin 1px hairline borders, generous negative space, sharp sans-serif Korean typography (Pretendard-like), and tasteful glassmorphism on each cell. Mini illustrations inside cells should be flat-isometric 3D vector style: a Riot logo silhouette, a chat bubble with a recruit roster, a drag-and-drop hand placing player tiles into a 5v5 lattice, a champion pick/ban grid with one champion glowing, a scoreboard tablet, and a rising bar chart with an "ELO +25" badge. The infographic itself must visually demonstrate that the product is polished — perfect grid alignment, identical cell padding, consistent Korean font weight, and a quiet visual hierarchy that reads top-left to bottom-right. No date. No URL. No extra English copy beyond the stage labels.
```

---

## 2. 운영자 워크플로우 — "BalanceTeam 의 하루" (5-Step Vertical Stepper)

**용도**: 운영자 (BalanceTeam role 보유자) 가 처음 운영할 때 보는 가이드. 슬래시 명령어 → Activity → 결과 기록의 책임 사슬.

**프롬프트:**

```
Create a polished vertical 5-step infographic titled in Korean "운영자 가이드 — 모집부터 결과까지" with a smaller subtitle reading "BalanceTeam 권한 보유자 전용 흐름". The layout is a tall portrait composition (2:3 ratio) with five horizontal step cards stacked vertically and connected by a glowing thin sapphire flow line on the left, each card numbered "01" through "05" in oversized LoL-gold serif numerals. Each card contains: (a) a Korean step title, (b) a one-line Korean micro-description, (c) a small isometric 3D illustration on the right side of the card, and (d) a tiny monospaced badge showing the slash command or screen name in light gray.

Step 01 — Korean title: "내전 모집 시작". Description: "Discord 채널에서 슬래시 명령으로 모집 메시지 게시". Badge: "/내전모집". Illustration: a chat channel with a fresh Components V2 recruit card and a glowing primary button labeled "참가".

Step 02 — Korean title: "엔트리 편성". Description: "모집 마감 후 Activity 에서 드래그 & 드롭으로 팀 구성". Badge: "Activity → 엔트리 수정". Illustration: 10 player avatar tiles being arranged into two columns labeled "BLUE" and "RED" by a hand cursor, ELO numbers floating beside each tile.

Step 03 — Korean title: "픽밴 진행". Description: "사다리식 픽밴 화면에서 챔피언 선택, 단계별 fade-in". Badge: "Activity → 픽밴". Illustration: a champion grid with 3 banned slots dimmed and one champion portrait glowing as the active pick.

Step 04 — Korean title: "결과 입력". Description: "Bo3 게임별 승팀 + 챔피언/스탯 입력, 자동으로 MMR 계산". Badge: "Activity → 결과". Illustration: a sleek tablet UI with two columns of stat rows and a green check overlay.

Step 05 — Korean title: "MMR 자동 갱신". Description: "리더보드와 개인 전적이 즉시 반영". Badge: "/랭킹 · /전적". Illustration: a rising bar chart with three player avatars stacked next to "ELO +25" "+12" "−8" badges in green and red.

Visual direction: dark theme (#0F1218 base), Discord blurple primary (#5865F2), LoL sapphire (#0AC8B9) for the connecting flow line, LoL gold (#C8AA6E) for step numerals only, soft success green and warning amber used sparingly for deltas. Korean typography: clean modern Pretendard-style sans-serif, semibold for titles, regular for descriptions, monospace for badges. Cards have 16px corner radius, 1px hairline borders at 8% white, and a faint inner glow when the card depicts an active stage. The bottom of the composition has a quiet horizontal divider and a small Korean footnote reading "권한이 없는 멤버는 같은 화면을 read-only 로 열람". No watermark, no fake company logo, no English filler text.
```

---

## 3. 참가자 가이드 — 4컷 만화 (Webtoon Style)

**용도**: 일반 참가자 (BalanceTeam 미보유) 가 모집부터 결과 확인까지 어떻게 행동하는지 친근한 톤으로.

**프롬프트:**

```
Create a 4-panel vertical webtoon-style comic in Korean explaining how a regular Discord member joins a custom match through "monkey". Art style: clean modern Korean webtoon (Naver/Kakao Webtoon aesthetic), soft cel-shading, expressive but minimal line art, light pastel palette with Discord blurple and LoL sapphire as accent colors, screen-tone gradients for backgrounds. Each panel is a 16:9 horizontal frame stacked vertically with thin gutters. Characters are stylized late-20s gamer avatars in casual clothing, sitting at desks with multi-monitor setups.

Panel 1 — Setting: a desk with a Discord window open. The protagonist (medium-length black hair, oversized hoodie) notices a fresh recruit card in a guild channel. Speech bubble in Korean: "오 내전 모집이다!". A small thought bubble shows the protagonist eyeing a glowing Korean button labeled "참가". Caption strip at bottom: "1. Discord 채널에서 모집 메시지를 본다".

Panel 2 — The protagonist clicks the "참가" button. The recruit card visibly updates with their avatar joining a roster of 6 → 10 players. Other Discord members' tiny avatars pop in sequence with a soft "ding" sound effect rendered as a Korean onomatopoeia "딩". Speech bubble: "10명 다 모였네!". Caption: "2. 인원이 모이면 자동으로 마감".

Panel 3 — The protagonist puts on a headset and joins a voice channel. A pop-up appears in the center showing the Discord Activity launcher with a tile labeled "monkey" highlighted. Their hand cursor hovers over it. Speech bubble: "보이스 채널 → Activity → monkey 선택!". Small Korean side-text reads "엔트리는 운영진이 짜줘요". Caption: "3. 보이스 채널에서 Activity 진입".

Panel 4 — Split scene: top-half shows the in-game champion select screen with the protagonist's chosen champion glowing, bottom-half shows the post-game scoreboard with a Korean toast notification reading "전적 자동 기록 완료". The protagonist gives a satisfied smile and a thumbs-up. Speech bubble: "끝나면 알아서 다 기록되네". Caption: "4. 게임 끝나면 결과는 운영진이 입력, 전적은 자동 반영".

A title banner at the very top (above panel 1) reads in Korean: "monkey 첫 내전 — 참가자 편" with a small subtitle "처음이라도 5분이면 충분". Korean typography: rounded modern sans-serif (Pretendard or Noto Sans KR), all speech bubbles use natural conversational tone with proper Korean punctuation. No English filler text inside speech bubbles. No Lorem Ipsum, no fake watermarks, no Discord/Riot logos rendered photorealistically (use silhouette suggestions only).
```

---

## 4. 슬래시 명령어 치트시트 — "monkey 키캡" (Mechanical Keyboard Style)

**용도**: 모든 슬래시 명령어를 한 장으로. 색으로 권한과 카테고리 구분.

**프롬프트:**

```
Create a high-end infographic poster styled like an exploded-view of a premium mechanical keyboard, where each keycap represents one of monkey's slash commands. The composition is landscape (16:9), centered on a dark charcoal background (#1A1B23) with a faint isometric grid. The "keyboard" is rendered as a 4-row × 4-column grid of 16 oversized PBT-style keycaps in soft isometric perspective, each cap front-printed with a Korean command name and side-printed with a one-line Korean description.

Keycap labels (top row left → bottom row right):
- "/등록" — desc: "라이엇 계정 연결" — color: info blue
- "/내정보" — desc: "내 ELO·승률 조회" — color: info blue
- "/내전기록" — desc: "지난 내전 목록" — color: info blue
- "/전적" — desc: "특정 유저 전적" — color: info blue
- "/랭킹" — desc: "리더보드 TOP" — color: info blue
- "/지금게임" — desc: "라이브 게임 정보" — color: info blue
- "/내전모집" — desc: "새 모집 게시" — color: warning amber
- "/일괄등록" — desc: "길드 멤버 일괄 라이엇 연결" — color: warning amber
- "/엔트리수정" — desc: "Activity 엔트리 진입" — color: warning amber
- "/조기마감" — desc: "모집 즉시 마감" — color: warning amber
- "/모집삭제" — desc: "모집 강제 삭제" — color: error red
- "/시리즈삭제" — desc: "시리즈 강제 삭제" — color: error red
- "/MMR조정" — desc: "수동 MMR 보정" — color: error red
- "/시즌초기화" — desc: "시즌 결과 reset" — color: error red
- "/멤버추가" — desc: "모집 멤버 직접 추가" — color: warning amber
- "/멤버제거" — desc: "모집 멤버 강제 제외" — color: warning amber

Each keycap has a tiny corner badge: blue dot for "조회 — 모두 가능", amber dot for "쓰기 — BalanceTeam", red dot for "위험 — BalanceTeam · 신중히". A legend strip at the top of the poster shows three Korean labels: "🔵 조회 (모두)", "🟡 쓰기 (BalanceTeam)", "🔴 위험 작업 (BalanceTeam · 확인 후 실행)". The poster title at the very top reads in Korean: "monkey 슬래시 명령어 치트시트" with a subtitle "16개 명령으로 내전 운영 끝". 

Design details: keycaps have realistic PBT shine-through legends, sharp 0.5mm hairline edges, subtle cyan-to-magenta rim lighting around the entire keyboard, faint volumetric haze on the bottom. Korean text uses condensed modern sans-serif (Pretendard SemiBold for command names at ~22pt, Regular for descriptions at ~12pt). The layout has perfect grid spacing — every keycap is the same size, every gap is identical, every label is bottom-aligned. No actual keyboard brand logo, no fake company watermark, no English filler.
```

---

## 5. Activity 화면 워크스루 — "픽셀 단위로 보는 monkey Activity" (UI Showcase Grid)

**용도**: Activity 의 6개 핵심 화면을 실제 mockup 처럼. 각 screenshot 에 한국어 주석.

**프롬프트:**

```
Create a clean UI showcase infographic presenting 6 mockup screens of the "monkey" Discord Activity in a 3-column × 2-row grid. The composition is landscape, on a soft off-white background (#F7F7F9) for the surrounding canvas with a centered title in Korean reading "monkey Activity — 화면 가이드" and subtitle "Discord 보이스 채널에서 바로 열리는 6개 화면". Each of the 6 mockups is rendered inside a stylized rounded device frame (Discord-shaped overlay window with subtle drop shadow), with a thin Korean caption beneath and one or two arrow-style annotations pointing to a key UI element.

Mockup A (top-left) — Welcome 카드. Show a centered card with a Korean greeting "👋 monkey Activity 사용 안내", a small primary button labeled "시작", and three quick-tip rows with Korean micro-text. Caption below: "처음 진입 시 보이는 안내 카드". Annotation arrow points to the "시작" button with Korean note "한 번 dismiss 하면 다시 안 보임".

Mockup B (top-center) — 모집 대시보드. Show a list of 3–4 closed recruitment cards each with a roster of 10 avatar circles, ELO sums, and a "엔트리 수정" link. Caption: "마감된 모집 목록". Annotation: arrow to one card with Korean note "클릭하면 엔트리 화면".

Mockup C (top-right) — 엔트리 편성 화면. Show a drag-and-drop board with two team columns (BLUE, RED), 5 slots each, with player tiles being moved by a hand cursor. Each tile shows avatar + Korean nickname + ELO. Caption: "드래그 & 드롭으로 팀 편성". Annotation: arrow with Korean note "BalanceTeam 만 편집 가능".

Mockup D (bottom-left) — 픽밴 화면. Show a champion grid (e.g., 8×6) with 3 dimmed banned champions, 2 picked champions glowing in BLUE/RED frames, and a turn indicator at top reading Korean "BLUE 픽". Caption: "사다리식 픽밴". Annotation: arrow to turn indicator with Korean note "행 단위 fade-in".

Mockup E (bottom-center) — 결과 입력. Show three game tabs (게임 1, 게임 2, 게임 3) with a winner toggle (BLUE/RED) and 10 stat rows for K/D/A. Caption: "Bo3 결과 입력". Annotation: arrow to a green "저장" button with Korean note "저장 시 MMR 자동 계산".

Mockup F (bottom-right) — 리더보드 + 유저 프로필. Show a top-10 ranking table on the left (rank, avatar, 닉네임, ELO, 승률) and a user profile card on the right (avatar, recent 5 games as colored squares, win streak). Caption: "리더보드 & 개인 프로필". Annotation: arrow to the streak indicator with Korean note "최근 5경기".

Design direction: modern flat UI with daisyUI-style minimalism — generous padding, soft shadows, semantic color usage (info blue, success green, warning amber, error red used only where meaningful), 12px corner radius on cards, subtle 1px hairline borders. Korean typography uses Pretendard or Noto Sans KR throughout, with consistent type scale across all mockups. Annotation arrows are thin 1.5px curved lines in Discord blurple. The grid spacing between mockups is uniform (32px gutters). No fake user data that looks like real names — use generic Korean nicknames like "원숭이123", "정글러", "탑솔러", "미드", "서폿". No watermark, no fake brand logos, no English placeholder text.
```

---

## 6. 권한 안내 — "BalanceTeam vs 일반 멤버" (Split Comparison Card)

**용도**: 길드 운영진이 권한 정책을 멤버에게 공지할 때. 두 역할의 액션 매트릭스.

**프롬프트:**

```
Create a premium split-screen comparison infographic explaining the two-tier permission model in monkey. The composition is landscape (16:9), divided vertically down the center by a thin glowing seam — left half is dark with LoL gold accents, right half is light with cool gray accents. A unified centered title at the top reads in Korean "권한 한눈에 보기" with subtitle "monkey 는 두 가지 역할로 동작".

Left half — "BalanceTeam"
- Top label in Korean: "👑 BalanceTeam 멤버"
- Subtitle in Korean: "쓰기 + 조회 — 모든 운영 액션 가능"
- Background: deep charcoal (#16181F) with subtle gold particle haze and faint dot grid
- A central vertical list of 6 capability rows, each with a gold check icon and Korean label:
  ✓ "모집 생성 · 마감 · 삭제"
  ✓ "엔트리 드래그 & 드롭 편집"
  ✓ "픽밴 진행 (BLUE/RED 양쪽)"
  ✓ "Bo3 결과 입력 · 수정"
  ✓ "MMR 수동 보정 (`/MMR조정`)"
  ✓ "시즌 초기화 · 시리즈 삭제"
- Bottom Korean micro-text: "Discord 길드에서 BalanceTeam role 부여 필요"

Right half — "일반 멤버"
- Top label in Korean: "👀 일반 길드 멤버"
- Subtitle in Korean: "조회 전용 — read-only 모드"
- Background: soft warm white (#F4F5F8) with very faint blue grid
- A central vertical list of 6 capability rows, each with a muted blue eye icon and Korean label:
  👁 "리더보드 · 랭킹 조회"
  👁 "개인 전적 · 내정보"
  👁 "지난 내전 기록 열람"
  👁 "모집 메시지 참가 · 취소"
  👁 "모집 대시보드 보기"
  👁 "Activity 화면 진입 (read-only UI)"
- Bottom Korean micro-text: "쓰기 액션은 자동으로 disabled 표시"

The dividing seam between halves has a soft glowing gradient transitioning from gold to blue, with a small centered icon — a balanced scale silhouette — straddling the boundary. Below the comparison, a single Korean callout strip reads: "권한 변경은 길드 관리자가 Discord 에서 role 부여/회수로 조정". 

Typography: Pretendard or Noto Sans KR — bold semibold for top labels (~36pt), regular for capability rows (~16pt), light italic for micro-text (~12pt). Icon style: minimalist line icons, gold (#C8AA6E) for checks on left, muted blue (#5865F2 at 70%) for eyes on right. The whole composition is perfectly mirrored in spacing — left and right halves use identical row heights, identical icon sizes, identical text alignment. No watermark, no Korean text outside what is specified, no fake brand logos, no English placeholder.
```

---

## 사용 팁

- **이미지 모델별 한국어 렌더링 차이**: GPT Image / Imagen 3+ / Nano Banana 는 짧은 한국어 (1–6자) 는 안정적, 긴 문장은 종종 깨짐. 인포그래픽 핵심 라벨이 깨지면 그 단어만 따로 후처리 합성 권장.
- **컬러 일관성**: 6개 모두 Discord 블루 (#5865F2), LoL 골드 (#C8AA6E), 사파이어 (#0AC8B9) 를 공통 액센트로 — 시리즈로 보일 때 통일감 확보.
- **버전 변형**: 같은 프롬프트로 light/dark 두 톤 생성하면 README dark mode + light mode 양쪽 대응.
- **재현성**: 모델이 layout 을 매번 다르게 그리므로 4–8장 시드 변경하며 가장 깨끗한 컷 채택.
