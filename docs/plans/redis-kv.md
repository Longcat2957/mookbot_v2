# Redis 도입 — KV 백엔드 분리 (최우선)

> 작성: 2026-05-14 · 대상 버전: v0.15.0
> 범위: `packages/core/src/db/kv.ts` + `apps/api/src/**`, `.env*`, VPS `docker-compose.yml`
> 비범위: schema 변경, 멀티테넌시, 신규 도메인 기능

---

## 1. 목표

EntryEditing / PickBan / read-through cache 가 매 액션마다 D1 (Cloudflare REST) 을 때리는
구조를 VPS 로컬 Redis 로 분리. D1 write 한도 / latency 부담 ↓, TTL 자동화, 추후 pub/sub
기반 확장 가능.

DoD:
- `entry:*`, `pickban:*`, `cache:*` key 가 Redis 로 라우팅된다.
- `guild_kv` D1 테이블은 영구 설정 (`config:*`) 만 보관.
- 기존 호출처 (10건) 코드 변경 0.
- typecheck/biome/vitest pass.
- VPS docker-compose 에 redis 서비스 추가 + 정상 healthcheck.

---

## 2. 현재 호출처 (전부)

```
packages/core/src/db/kv.ts        # 3 fn: getKv / setKv / deleteKv
apps/api/src/http/recruit.ts      # 3건 (entry:${id} 드래프트)
apps/api/src/http/series.ts       # 5건 (pickban:${id} 드래프트)
apps/api/src/http/users.ts        # 2건 (leaderboard read-through cache)
```

호출 signature 가 이미 KV 모양이라 facade 패턴으로 backend 만 갈아끼우면 됨.

---

## 3. 구조

```
packages/core/src/kv/
  types.ts       # KvStore interface
  d1.ts          # D1 어댑터 (기존 kv.ts 로직 이동)
  redis.ts       # Redis 어댑터 (ioredis)
  routed.ts      # prefix 기반 라우터 (entry:/pickban:/cache: → Redis, 그 외 → D1)
  factory.ts     # 싱글톤 빌더
  redis.test.ts  # ioredis-mock 기반 단위 테스트
  d1.test.ts     # 기존 kv.test.ts 이동

packages/core/src/db/kv.ts        # facade — getKv/setKv/deleteKv 그대로 export (호출처 변경 0)
```

prefix 라우팅 규칙:
| prefix | backend | 이유 |
|---|---|---|
| `entry:*` | Redis | hot, ephemeral, 다중 PUT |
| `pickban:*` | Redis | hot, ephemeral, 다중 PUT |
| `cache:*` | Redis | read-through, TTL 의미 강함 |
| 그 외 | D1 | 영구 설정 (`config:guild:*`, 시즌 메타 등) |

---

## 4. KvStore 인터페이스

```typescript
// packages/core/src/kv/types.ts
export interface KvSetOptions {
  ttlSec?: number;       // 0 또는 미지정 → no expire
  updatedBy?: string;    // D1 어댑터에서만 사용. Redis 어댑터는 무시.
}

export interface KvStore {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string, opts?: KvSetOptions): Promise<void>;
  delete(key: string): Promise<void>;
}
```

---

## 5. 구현 스니펫

### 5.1 Redis 어댑터
```typescript
// packages/core/src/kv/redis.ts
import type Redis from "ioredis";
import type { KvSetOptions, KvStore } from "./types.js";

export class RedisKvStore implements KvStore {
  constructor(private client: Redis) {}
  async get(k: string) {
    return (await this.client.get(k)) ?? undefined;
  }
  async set(k: string, v: string, opts?: KvSetOptions) {
    if (opts?.ttlSec && opts.ttlSec > 0) {
      await this.client.set(k, v, "EX", opts.ttlSec);
    } else {
      await this.client.set(k, v);
    }
  }
  async delete(k: string) {
    await this.client.del(k);
  }
}
```

### 5.2 라우터
```typescript
// packages/core/src/kv/routed.ts
import type { KvSetOptions, KvStore } from "./types.js";

const REDIS_PREFIXES = ["entry:", "pickban:", "cache:"] as const;

export class RoutedKvStore implements KvStore {
  constructor(private redis: KvStore, private d1: KvStore) {}
  private pick(k: string): KvStore {
    return REDIS_PREFIXES.some((p) => k.startsWith(p)) ? this.redis : this.d1;
  }
  get(k: string) { return this.pick(k).get(k); }
  set(k: string, v: string, o?: KvSetOptions) { return this.pick(k).set(k, v, o); }
  delete(k: string) { return this.pick(k).delete(k); }
}
```

### 5.3 facade
```typescript
// packages/core/src/db/kv.ts (rewrite)
import { getKvStore } from "../kv/factory.js";

export async function getKv(key: string): Promise<string | undefined> {
  return getKvStore().get(key);
}
export async function setKv(key: string, value: string, updatedBy?: string): Promise<void> {
  return getKvStore().set(key, value, { updatedBy });
}
export async function deleteKv(key: string): Promise<void> {
  return getKvStore().delete(key);
}
```

### 5.4 factory (싱글톤)
```typescript
// packages/core/src/kv/factory.ts
import IORedis from "ioredis";
import { D1KvStore } from "./d1.js";
import { RedisKvStore } from "./redis.js";
import { RoutedKvStore } from "./routed.js";
import type { KvStore } from "./types.js";

let cached: KvStore | null = null;

export function getKvStore(): KvStore {
  if (cached) return cached;
  const url = process.env.REDIS_URL;
  if (!url) {
    // dev / 테스트 환경 — D1 단일 backend 로 폴백.
    cached = new D1KvStore();
    return cached;
  }
  const client = new IORedis(url, {
    maxRetriesPerRequest: 3,
    lazyConnect: false,
  });
  cached = new RoutedKvStore(new RedisKvStore(client), new D1KvStore());
  return cached;
}

export function __resetKvStoreForTest(store: KvStore | null) {
  cached = store;
}
```

---

## 6. 작업 순서 (반나절)

| # | 항목 | 추정 |
|---|---|---|
| 1 | `pnpm add ioredis` (core), `pnpm add -D ioredis-mock` (core) | 5분 |
| 2 | `kv/types.ts` + `kv/d1.ts` (기존 코드 이동) | 15분 |
| 3 | `kv/redis.ts` + `kv/routed.ts` + `kv/factory.ts` | 20분 |
| 4 | `db/kv.ts` facade rewrite | 5분 |
| 5 | `apps/api/src/env.ts` 에 `REDIS_URL` 추가 (optional, default 없음) | 5분 |
| 6 | `.env.example` 에 `REDIS_URL=redis://redis:6379` 추가 | 2분 |
| 7 | `kv/redis.test.ts` (ioredis-mock) | 30분 |
| 8 | `kv/routed.test.ts` (prefix 라우팅 검증) | 15분 |
| 9 | typecheck + biome + vitest 통과 확인 | 10분 |
| 10 | 호출처 TTL 옵션 추가 (선택, recruit/series.ts) | 30분 |
| 11 | VPS `docker-compose.yml` 갱신 (수동) + `.env` 에 `REDIS_URL` | 15분 |
| 12 | VPS 배포 + healthcheck 확인 | 15분 |

= 약 **3~4시간**.

---

## 7. VPS docker-compose 변경 (수동)

repo 에 compose 파일 없음 (`/root/deploy/docker-compose.yml` VPS-only). 배포 시 다음 블록 추가:

```yaml
services:
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3

  api:
    # ... 기존 설정
    environment:
      - REDIS_URL=redis://redis:6379
    depends_on:
      redis:
        condition: service_healthy

volumes:
  redis-data:
```

`/root/deploy/api/.env` 에도 `REDIS_URL=redis://redis:6379` 추가.

---

## 8. 위험 + 완화

| 위험 | 영향 | 완화 |
|---|---|---|
| Redis 컨테이너 다운 | 드래프트 unavailable, EntryEditing/PickBan 화면 실패 | healthcheck + `depends_on: service_healthy`. ioredis `maxRetriesPerRequest: 3` 으로 빠르게 실패. UI 측 ErrorBoundary 가 토스트로 처리 |
| VPS 재시작 데이터 손실 | 드래프트 손실 (ephemeral 이라 영향 작음) | `--appendonly yes` (AOF). 사용자는 재진입 시 다시 작성 |
| 메모리 폭주 | OOM | `--maxmemory 256mb --maxmemory-policy allkeys-lru` |
| 테스트 환경에 Redis 없음 | CI 실패 | `REDIS_URL` 미설정 → D1 단일 backend 폴백 (factory 에서 처리). 단위 테스트는 `ioredis-mock` |
| 기존 D1 의 `entry:*` / `pickban:*` 데이터 | 마이그레이션 시 보이지 않게 됨 | 모두 ephemeral. 다음 사용 시 새로 작성. 기존 row 는 `cleanupStale` 또는 일회성 `DELETE FROM guild_kv WHERE k LIKE 'entry:%' OR k LIKE 'pickban:%'` 로 정리 |
| ioredis singleton 누수 | api 재기동 시 connection leak | `process.on('SIGTERM', () => client.quit())` graceful shutdown 훅 추가 |

---

## 9. 호환성 메모

- 기존 `setKv(k, v, sid)` 의 `sid` (`updatedBy`) 인자: Redis 어댑터에서는 무시. D1 어댑터 (config 영구) 에서만 의미 있음. 호출처 변경 불필요.
- D1 의 `guild_kv` 테이블은 그대로 유지. 향후 멀티테넌시 작업 시 `config:guild:${gid}:*` 키 컨벤션으로 자연 확장.

---

## 10. 후속 (별도 phase)

- TTL 일괄 도입: `entry:*` = 3600s, `pickban:*` = 3600s, `cache:users:leaderboard` = 60s 등.
- rate limit 미들웨어: Redis 가 있으니 `@fastify/rate-limit` + Redis store 로 통일 (public 봇 단계에서).
- `auth/perms.ts` memberCache Redis 이전 — 60s TTL, 재시작 시 cold start 방지.

---

## 11. 확장 — WS 상태공유 + BidIntent (포함됨)

KV 어댑터와 같은 사이클에 처리. 단순 캐시뿐 아니라 **WS 로 공유되는 모든 상태가 Redis 를 거치도록** 구조화.

### 11.1 WS broadcast → Redis Pub/Sub

`apps/api/src/ws/rooms.ts` 재작성:

- `broadcast(topic, msg)` → `PUBLISH ws:<topic> <json>`
- api 부팅 시 `initWsPubSub()` 가 단일 `PSUBSCRIBE ws:*` 등록
- 수신 시 `localBroadcast(topic, data)` 로 로컬 소켓 fan-out
- `REDIS_URL` 미설정 시 in-process 즉시 fan-out (legacy 동작 유지)
- `factory.ts` 에 `getRedisSubscriber()` 추가 — subscribe 모드는 publisher 와 분리 필요 (ioredis 제약)

**UX gain**:
- 다중 api 인스턴스 시 broadcast 가 모든 인스턴스에 전파됨 → 무중단 배포 / scale-out foundation
- 단일 인스턴스에선 변경 0 (publish→subscribe 한 hop 추가, latency 영향 미미)

### 11.2 BidIntent → Redis hash

`apps/api/src/domain/auctionBidIntents.ts` 재작성 — sync → async:

- key = `bidIntent:<tournamentId>`, hash field = `<teamId>`, value = JSON
- `setBidIntent` 시 `HSET` + `EXPIRE 3600s` (BIDDING 단계 자동 만료)
- `clearBidIntents` → `DEL`
- `getBidIntents` → `HGETALL` + JSON parse
- `REDIS_URL` 미설정 시 in-process Map 폴백

호출처 11건 (`apps/api/src/http/auction-tournament.ts`) 에 `await` 추가.

**UX gain**:
- 운영자가 입찰 의도 입력 중 api 재시작 → 의도 보존 (v0.14.0 핵심 기능 신뢰성 ↑)
- 다중 인스턴스 동일 의도 공유
- TTL 자동 청소

### 11.3 graceful shutdown

`apps/api/src/index.ts` 에 SIGTERM/SIGINT 핸들러 추가 — `closeRedis()` 로 publisher/subscriber 모두 quit. 컨테이너 재기동 시 연결 누수 방지.
