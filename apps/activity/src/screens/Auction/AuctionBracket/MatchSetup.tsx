import { useState } from "react";
import type { AuctionTournamentDetail, MatchFormat } from "../types.js";
import { FormatSelect } from "./FormatSelect.js";
import { MatchupBuilder } from "./MatchupBuilder.js";

// ============================================================
// MatchSetup — 4강 매치업 구성 (20인) 또는 단일 매치 (10인)
// ============================================================
export function MatchSetup({
	detail,
	onCreate,
}: {
	detail: AuctionTournamentDetail;
	onCreate: (input: {
		round: "SEMI" | "FINAL" | "SINGLE";
		bracketIndex: number | null;
		team1Id: number;
		team2Id: number;
		format: MatchFormat;
	}) => Promise<{ matchId: number }>;
}) {
	const [format, setFormat] = useState<MatchFormat>("BO3");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const allTeams = detail.teams;
	const remaining = allTeams.filter(
		(t) => !detail.matches.some((m) => m.team1Id === t.id || m.team2Id === t.id),
	);

	const createSemi = async (team1Id: number, team2Id: number) => {
		setSubmitting(true);
		setError(null);
		try {
			const semiCount = detail.matches.filter((m) => m.round === "SEMI").length;
			await onCreate({
				round: "SEMI",
				bracketIndex: semiCount + 1,
				team1Id,
				team2Id,
				format,
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setSubmitting(false);
		}
	};

	const createSingle = async (team1Id: number, team2Id: number) => {
		setSubmitting(true);
		setError(null);
		try {
			await onCreate({
				round: "SINGLE",
				bracketIndex: null,
				team1Id,
				team2Id,
				format,
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setSubmitting(false);
		}
	};

	// 10인 — 1매치만, 2팀
	if (detail.tournament.format === 10) {
		if (detail.matches.length > 0 || allTeams.length !== 2) return null;
		const [t1, t2] = allTeams;
		return (
			<div className="card surface-base shadow">
				<div className="card-body p-5 gap-3">
					<h3 className="text-lg font-bold">매치 생성</h3>
					<FormatSelect value={format} onChange={setFormat} />
					<div className="text-base">
						<strong>{t1?.captainName}</strong> vs <strong>{t2?.captainName}</strong>
					</div>
					{error && <div className="alert alert-error">{error}</div>}
					<button
						type="button"
						className="btn btn-primary btn-lg"
						onClick={() => t1 && t2 && createSingle(t1.id, t2.id)}
						disabled={submitting}
					>
						▶ 매치 시작
					</button>
				</div>
			</div>
		);
	}

	// 20인 — 4강 매치업 2개. 운영자가 짝짓기 (Q3 결정: 수동)
	if (remaining.length === 0) return null;
	return (
		<div className="card surface-base shadow">
			<div className="card-body p-5 gap-3">
				<h3 className="text-lg font-bold">4강 매치업 구성</h3>
				<p className="text-base text-base-content/60">
					팀 두 개를 선택하면 매치업이 생성됩니다. (남은 팀 {remaining.length}/4)
				</p>
				<FormatSelect value={format} onChange={setFormat} />
				<MatchupBuilder teams={remaining} onPair={createSemi} submitting={submitting} />
				{error && <div className="alert alert-error">{error}</div>}
			</div>
		</div>
	);
}
