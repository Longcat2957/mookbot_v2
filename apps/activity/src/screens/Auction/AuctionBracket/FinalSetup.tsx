import { useCallback, useEffect, useState } from "react";
import { api } from "../../../api/rest.js";
import { wsClient } from "../../../api/ws.js";
import { UserAvatar } from "../../../components/UserAvatar.js";
import { useStaleWhileRevalidate } from "../../../state/useStaleWhileRevalidate.js";
import type { AuctionMatch, AuctionTournamentDetail, MatchFormat } from "../types.js";
import type { MatchDetail } from "./_shared.js";
import { FormatSelect } from "./FormatSelect.js";

export function FinalSetup({
	detail,
	semis,
	onCreate,
}: {
	detail: AuctionTournamentDetail;
	semis: AuctionMatch[];
	onCreate: (input: {
		round: "FINAL";
		bracketIndex: null;
		team1Id: number;
		team2Id: number;
		format: MatchFormat;
	}) => Promise<{ matchId: number }>;
}) {
	const [format, setFormat] = useState<MatchFormat>("BO3");
	const [creating, setCreating] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// 4강 둘 다 완료된 시리즈에서 winner 가져오기
	const winners = useFinalParticipants(detail, semis);

	if (!winners) return <div className="text-sm text-base-content/60">_(4강 결과 대기 중)_</div>;

	const [t1Id, t2Id] = winners;
	const t1 = detail.teams.find((t) => t.id === t1Id);
	const t2 = detail.teams.find((t) => t.id === t2Id);

	const create = async () => {
		setCreating(true);
		setError(null);
		try {
			await onCreate({ round: "FINAL", bracketIndex: null, team1Id: t1Id, team2Id: t2Id, format });
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setCreating(false);
		}
	};

	return (
		<div className="card surface-base shadow border-l-4 border-warning">
			<div className="card-body p-5 gap-3">
				<h3 className="text-lg font-bold">결승 생성</h3>
				<FormatSelect value={format} onChange={setFormat} />
				<div className="text-base flex items-center gap-2 flex-wrap">
					{t1 && (
						<UserAvatar
							discordId={t1.captainUserId}
							displayName={t1.captainName}
							imageUrl={t1.captainProfileIconUrl}
							size="sm"
						/>
					)}
					<strong>{t1?.captainName ?? `팀${t1?.teamIndex}`}</strong>
					<span className="text-base-content/40">vs</span>
					{t2 && (
						<UserAvatar
							discordId={t2.captainUserId}
							displayName={t2.captainName}
							imageUrl={t2.captainProfileIconUrl}
							size="sm"
						/>
					)}
					<strong>{t2?.captainName ?? `팀${t2?.teamIndex}`}</strong>
				</div>
				{error && <div className="alert alert-error">{error}</div>}
				<button type="button" className="btn btn-primary btn-lg" onClick={create} disabled={creating}>
					▶ 결승 시작
				</button>
			</div>
		</div>
	);
}

function useFinalParticipants(
	_detail: AuctionTournamentDetail,
	semis: AuctionMatch[],
): [number, number] | null {
	// 각 4강 매치 series 를 SWR + WS subscribe 로 reactive 하게 추적 — 매치 결과
	// 변경 시 즉시 재계산. 기존 useEffect 는 semis 배열 자체가 같으면 (id 동일) 재실행
	// 안 돼 4강 끝나도 결승 진입 불가던 버그 fix.
	const m1Id = semis[0]?.matchId ?? null;
	const m2Id = semis[1]?.matchId ?? null;

	const m1Fetcher = useCallback(
		() =>
			m1Id !== null
				? api<MatchDetail>(`/auction-matches/${m1Id}`)
				: Promise.reject(new Error("no semi 1")),
		[m1Id],
	);
	const m2Fetcher = useCallback(
		() =>
			m2Id !== null
				? api<MatchDetail>(`/auction-matches/${m2Id}`)
				: Promise.reject(new Error("no semi 2")),
		[m2Id],
	);
	const m1Swr = useStaleWhileRevalidate<MatchDetail>(m1Id, m1Fetcher, {
		enabled: m1Id !== null,
	});
	const m2Swr = useStaleWhileRevalidate<MatchDetail>(m2Id, m2Fetcher, {
		enabled: m2Id !== null,
	});

	useEffect(() => {
		if (m1Id === null) return;
		return wsClient.subscribe(`auction-match:${m1Id}`, () => m1Swr.refresh());
	}, [m1Id, m1Swr]);
	useEffect(() => {
		if (m2Id === null) return;
		return wsClient.subscribe(`auction-match:${m2Id}`, () => m2Swr.refresh());
	}, [m2Id, m2Swr]);

	const [semi1, semi2] = semis;
	if (
		!semi1 ||
		!semi2 ||
		!m1Swr.data ||
		!m2Swr.data ||
		m1Swr.data.match.status !== "COMPLETED" ||
		m2Swr.data.match.status !== "COMPLETED" ||
		!m1Swr.data.match.winningTeam ||
		!m2Swr.data.match.winningTeam
	) {
		return null;
	}
	const w1 = m1Swr.data.match.winningTeam === "TEAM_1" ? semi1.team1Id : semi1.team2Id;
	const w2 = m2Swr.data.match.winningTeam === "TEAM_1" ? semi2.team1Id : semi2.team2Id;
	return [w1, w2];
}
