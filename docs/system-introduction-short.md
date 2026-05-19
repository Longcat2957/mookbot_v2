# mookbot v2 소개

mookbot v2는 Discord 서버 안에서 League of Legends 내전을 모집, 편성, 진행, 기록하는 운영 시스템입니다. 봇 슬래시 명령과 Discord Activity를 함께 사용해, 기존 채팅 메시지 기반 운영보다 빠르고 안정적인 내전 진행 경험을 제공합니다.

사용자에게 보이는 서비스 브랜드는 **monkey**이며, `mookbot`은 코드베이스와 배포 식별자에 남아 있는 내부 이름입니다.

## 핵심 기능

- **내전 모집**: Discord 슬래시 명령으로 일반 내전과 경매 내전을 모집합니다.
- **엔트리 편성**: Discord Activity 화면에서 참가자를 드래그 앤 드롭으로 팀과 라인에 배치합니다.
- **픽/밴 진행**: 챔피언 검색, 밴/픽 입력, Hard Fearless 규칙, Bo3 결과 기록을 지원합니다.
- **MMR 및 리더보드**: 라인별 MMR, 통합 리더보드, 사용자 프로필, 최근 전적을 제공합니다.
- **경매 내전**: 팀장 선출, 포인트 배정, 입찰, 토너먼트 진행, 결과 기록을 지원합니다.
- **운영 안정성**: 권한 게이트, audit log, soft-delete, D1 migration safety, Redis/Valkey 기반 hot state 저장을 갖췄습니다.

## 시스템 구성

| 영역 | 역할 |
|---|---|
| Discord Bot | 슬래시 명령, 모집 메시지, 내부 알림 처리 |
| API Server | OAuth 세션, DB read/write, WebSocket broadcast |
| Activity App | 엔트리 편성, 픽/밴, 경매 진행, 리더보드, 프로필 UI |
| Core Package | DB 도메인 로직, MMR, Riot API, Data Dragon 연동 |
| Infrastructure | Cloudflare, VPS nginx, Docker compose, D1, Valkey |

## 운영 흐름

1. 운영자가 Discord에서 내전 모집을 생성합니다.
2. 참가자가 모집 메시지에서 참여합니다.
3. 운영자가 Activity에서 팀과 라인을 편성합니다.
4. 픽/밴과 게임 결과를 Activity에서 입력합니다.
5. 시스템이 MMR, 전적, 리더보드, 종료 카드, audit log를 자동 반영합니다.

## 현재 상태

- 운영 도메인: `bot.mooklol.com`
- 현재 버전: `v0.18.9`
- 운영 형태: 단일 VPS Docker compose stack
- 주요 컨테이너: `bot`, `api`, `activity`, `nginx`, `valkey`

## 요약

mookbot v2는 “Discord 안에서 내전 운영자가 반복하던 수작업”을 Activity 기반 도구로 옮긴 시스템입니다. 참가자 모집부터 팀 편성, 픽/밴, 기록, 리더보드까지 한 흐름 안에서 처리하도록 설계되었습니다.
