# 전적검토 Benchmark 기반 개선 계획

## 배경

현재 `/전적검토`는 최근 솔로랭크 표본의 절대 지표를 휴리스틱 임계값과 비교한다.

- `부계정`과 `티어불일치`가 별도 카테고리지만 실제 신호가 중복된다.
- KDA, DPM, GPM, CS/M 임계값이 전 티어/전 포지션에 동일하게 적용된다.
- 포지션별 특성이 큰 지표를 절대값으로 평가해 오탐이 발생한다.

대표 사례:

- `Hide on bush#KR1`: CHALLENGER I 1932LP 미드 75%. 챌린저 미드 기준 없이 DPM/GPM 절대값으로 `티어불일치 71 HIGH`가 발화했다. 정상적인 상위 티어 고성과를 의심 신호로 과대평가한 사례다.
- `Longcat#KR1`: PLATINUM III 정글 98%. 정글 KDA baseline이 높은 포지션 특성을 반영하지 못해 KDA 중심 신호와 계정일관성 신호가 `MANUAL_REVIEW`까지 밀었다. 사용자 본계 기준 false positive다.
- `dolf931#KR1`: SILVER I, 솔로랭크 시즌 16판, 포지션 분산, 긴 연패, 높은 DPM. 부캐가 명확한 사례지만 `부계정`과 `티어불일치`가 분산되어 핵심 신호가 흐려졌다.

## 목표

`merged.json`의 티어/포지션별 `kills`, `kda`, `deaths`, `csm` 기준선을 사용해 전적검토를 benchmark 기반으로 바꾼다.

- `부계정`과 `티어불일치`를 `계정/티어 불일치` 하나로 합친다.
- 성과 지표는 절대 임계값이 아니라 `tier + position + metric` 기준선 대비 초과/미달로 판단한다.
- 신규 계정/낮은 솔랭 판수는 단독 판정 신호가 아니라 benchmark 과성과을 증폭하는 context로 쓴다.
- `패배패턴`, `계정일관성`, `포지션`, `데이터품질`은 별도 유지한다.

## 데이터 모델

`merged.json`을 core package 안의 정적 benchmark로 편입한다.

추천 위치:

- `packages/core/src/screening/benchmarks.json`
- `packages/core/src/screening/benchmarks.ts`

형태:

```ts
type BenchmarkMetric = "kills" | "kda" | "deaths" | "csm";
type BenchmarkRole = "top" | "jungle" | "middle" | "bottom";
type BenchmarkTier =
	| "IRON"
	| "BRONZE"
	| "SILVER"
	| "GOLD"
	| "PLATINUM"
	| "EMERALD"
	| "DIAMOND"
	| "MASTER"
	| "GRANDMASTER"
	| "CHALLENGER";

interface BenchmarkRow {
	value: number;
	redside: number;
	blueside: number;
	total: number;
}
```

`UTILITY`/서포터는 현재 benchmark가 없으므로 1차에서는 benchmark 평가에서 제외하고 evidence에 `supportBenchmarkMissing`을 남긴다.

## 산식 변경

### 1. 새 카테고리

기존:

```ts
scores: {
	smurfRisk: RiskScore;
	rankMismatchRisk: RiskScore;
}
```

변경:

```ts
scores: {
	accountTierMismatchRisk: RiskScore;
}
```

Discord embed label:

```text
계정/티어
```

evidence category:

```text
accountTierMismatch
```

### 2. 포지션별 경기 집계

최근 솔로랭크 표본을 포지션별로 묶는다.

- `TOP -> top`
- `JUNGLE -> jungle`
- `MIDDLE -> middle`
- `BOTTOM -> bottom`
- `UTILITY -> 제외/fallback`

포지션별 최소 표본:

- 3판 미만: 점수화 제외
- 3-7판: 점수 50% 감쇠
- 8판 이상: 정상 반영

### 3. Benchmark delta

metric별 포지션 평균과 benchmark를 비교한다.

```text
ratio = userMetric / benchmarkMetric
deltaPct = ratio - 1
```

방향:

- `kda`: 높을수록 과성과
- `kills`: 높을수록 과성과
- `csm`: 높을수록 과성과
- `deaths`: 낮을수록 과성과, 높을수록 패배패턴 쪽 후보

1차 점수 예시:

```text
KDA    +10% 이상 +6, +20% 이상 +12, +35% 이상 +18
kills  +10% 이상 +4, +20% 이상 +8,  +35% 이상 +12
CS/M   +8% 이상  +4, +15% 이상 +8,  +25% 이상 +12
deaths -8% 이하  +3, -15% 이하 +6,  -25% 이하 +10
```

상위 티어 과대평가 방지:

- `MASTER+`는 benchmarkPerformanceScore를 20% 감쇠한다.
- `CHALLENGER`는 35% 감쇠한다.
- 단, 계정 context가 신규/저판수이면 감쇠를 완화한다.

### 4. Context booster

낮은 레벨/낮은 솔랭 판수는 단독으로 큰 점수를 주지 않는다.

```text
performanceScore < 15:
  contextScore max 5

performanceScore >= 15:
  lowLevel / lowRankedGames / highWinRate / oneChampFocus를 booster로 반영
```

예시:

- 솔랭 누적 `<20`: base +4, performanceScore >= 20이면 추가 +10
- 솔랭 누적 `<40`: base +2, performanceScore >= 20이면 추가 +6
- 최근 승률 `>=58%`: +8
- 최근 승률 `>=65%`: +14
- Top1 챔피언 집중 `>=50%`이고 신규 계정: +6

### 5. DPM/GPM 처리

`merged.json`에는 DPM/GPM benchmark가 없다. 1차 개선에서는 `accountTierMismatchRisk`의 핵심 evidence에서 DPM/GPM을 제외하거나 낮은 보조 신호로만 유지한다.

- `DPM`은 carry 참고로 최대 +8
- `GPM`은 1차에서 제거 권장
- embed의 “벤치” 값도 hardcoded `650/400` 대신 `보조` 또는 `-`로 표시한다.

## 패배패턴 개선

`deaths` benchmark를 `derankOrThrowRisk`에도 사용한다.

- 패배 경기의 포지션별 deaths가 benchmark 대비 높을 때만 death anomaly로 점수화한다.
- 단순 `lossDeaths >= 8`은 제거하거나 fallback으로만 사용한다.
- `longestLossStreak`는 유지하되 단독 고점수 방지: 7연패도 개인 지표 급락이 없으면 최대 +15.

예시:

```text
loss deaths >= role/tier benchmark +20%: +8
loss deaths >= role/tier benchmark +35%: +15
loss KDA <= own win KDA -50% and loss deaths anomaly: +12
```

## 계정일관성 개선

KDA 변동성은 포지션/승패 특성에 민감하므로 감쇠한다.

- `kdaCoefficientOfVariation` 단독으로 `MANUAL_REVIEW`를 만들지 않는다.
- 계정일관성 50점 이상은 최소 두 종류 이상의 강한 신호가 있을 때만 허용한다.
- `splitWinRateDelta`는 표본 날짜 범위가 너무 길면 감쇠한다. 예: 90일 초과 표본은 50% 감쇠.

Longcat 사례처럼 정글 단일 포지션에서 KDA 변동만 큰 경우는 LOW에 머물러야 한다.

## 출력 변경

카테고리:

```text
계정/티어
패배패턴
계정일관성
포지션
데이터품질
```

분당 평균 표는 benchmark 기반으로 바꾼다.

```text
          값      기준      차이    판정
KDA       4.17    3.74    +12%     ↑
CS/M      7.4     7.80     -5%     ·
킬        5.8     5.65     +3%     ·
데스      4.9     4.92      0%     ·
```

주 포지션이 여러 개면 포지션별 benchmark 요약을 별도 블록으로 표시한다.

```text
미드 36판: KDA +12%, CS/M -5%, 킬 +3%, 데스 0%
정글 8판: KDA -8%, CS/M +4%, 킬 +6%, 데스 -3%
```

## 기대 결과

### Hide on bush#KR1

기대:

- `accountTierMismatchRisk`: LOW
- recommendation: `AUTO_PASS` 또는 `MANUAL_REVIEW` 미만
- 이유: CHALLENGER 미드 benchmark 대비 KDA/CS/M/kills/deaths가 정상 범위면 DPM 절대값만으로 HIGH 금지

### Longcat#KR1

기대:

- `accountTierMismatchRisk`: LOW
- `accountConsistencyRisk`: LOW 또는 낮은 MED 미만
- recommendation: `AUTO_PASS`
- 이유: PLATINUM 정글 benchmark상 KDA 4점대는 과성과으로 보기 어렵고, DPM도 낮다. KDA 변동성 단독 수동검토 금지.

### dolf931#KR1

기대:

- `accountTierMismatchRisk`: MED 이상
- recommendation: `MANUAL_REVIEW`
- 이유: 낮은 솔랭 누적, 넓은 챔피언/포지션 분산, silver benchmark 대비 포지션별 과성과이 확인되면 하나의 카테고리로 모아 표시한다.

## 구현 순서

1. `merged.json`을 `packages/core/src/screening` 아래 benchmark asset으로 이동/정규화한다.
2. tier/role/metric lookup helper를 추가한다.
3. `MatchSummary`에 kills/deaths/kda/csm benchmark 비교용 포지션 그룹 집계를 추가한다.
4. `scoreSmurfRisk`와 `scoreRankMismatchRisk`를 `scoreAccountTierMismatchRisk`로 합친다.
5. `scoreDerankOrThrowRisk`가 deaths benchmark를 사용하게 바꾼다.
6. `scoreAccountConsistencyRisk`의 KDA 변동성 단독 영향력을 줄인다.
7. bot embed와 API response 타입을 새 scores shape에 맞춘다.
8. fixture 테스트를 추가한다.

## 테스트 계획

단위 테스트:

- CHALLENGER/MIDDLE 고성과 정상 계정이 티어불일치 HIGH를 받지 않는다.
- PLATINUM/JUNGLE KDA 4점대 저DPM 계정이 KDA만으로 수동검토되지 않는다.
- SILVER 다포지션 저판수 계정이 benchmark 대비 과성과이면 `accountTierMismatchRisk`가 MED 이상이다.
- SUPPORT 표본은 benchmark 누락으로 crash 없이 fallback/evidence 처리된다.
- `overallReviewRisk`는 통합 카테고리 기준으로 계산된다.

수동 검증:

```sh
pnpm --filter @mookbot/core test
pnpm typecheck
```
