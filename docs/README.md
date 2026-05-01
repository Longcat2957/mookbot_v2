# mookbot v2 — Docs

이 디렉토리는 프로젝트 문서 모음. 코드/계획 문서는 repo 루트에 따로 있음.

## 문서 목록

### 개발
- [`how_to_dev.md`](./how_to_dev.md) — 개발환경 셋업 + 테스트 실행 / 디버그 / 트러블슈팅 / cheat sheet
- [`cicd.md`](./cicd.md) — GitHub Actions 워크플로 (CI gate + D1 백업) 정리

### 테스트
- [`testing/README.md`](./testing/README.md) — 테스트 전체 현황, 실행법, 카테고리 분류
- [`testing/infrastructure.md`](./testing/infrastructure.md) — 하네스 / 모킹 패턴 / vitest 설정
- [`testing/core-tests.md`](./testing/core-tests.md) — `packages/core` 단위 테스트 (14 파일)
- [`testing/app-tests.md`](./testing/app-tests.md) — `apps/api` 통합 + `apps/bot` 단위 (3 파일)

## 외부 문서 (repo 루트)

- [`../PLAN.md`](../PLAN.md) — 전체 마스터 플랜 (Phase 0~Q)
- [`../full_code_review_and_refactoring.md`](../full_code_review_and_refactoring.md) — Phase Q 상세 (Wave 1~6)
- [`../README.md`](../README.md), [`../SETUP.md`](../SETUP.md)

## 문서 갱신 정책

이 문서는 **2026-05-01 v0.2.8 시점 스냅샷**. 테스트 파일이 추가/변경되면 같이 갱신.
번거로우면 README + infrastructure 만 유지하고 file-by-file 도큐먼트는 코드 자체로 대체 가능.
