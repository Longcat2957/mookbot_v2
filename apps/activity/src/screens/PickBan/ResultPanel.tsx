import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../api/rest.js";
import type { LineupParticipant } from "../../components/LineupPreview.js";
import { usePerms } from "../../state/perms.js";
import { ResultRadioCard } from "./ResultRadioCard.js";
import { type Champion, type GameDraft, LANE_ORDER, type Team } from "./types.js";

export function ResultPanel({
	seriesId,
	gameDraft,
	teamSize,
	participants,
	champions,
	onRecorded,
}: {
	seriesId: number;
	gameDraft: GameDraft;
	teamSize: number;
	participants: LineupParticipant[];
	champions: Champion[];
	onRecorded: () => void;
}) {
	const perms = usePerms();
	const [winner, setWinner] = useState<Team | null>(null);
	const [durationMin, setDurationMin] = useState<string>("");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const lanes = LANE_ORDER.slice(0, teamSize);

	const champById = useMemo(() => {
		const m = new Map<number, Champion>();
		for (const c of champions) m.set(c.id, c);
		return m;
	}, [champions]);

	// 모든 슬롯 채워졌는지 검증
	const allBansFilled =
		gameDraft.bans.TEAM_1.every((c) => c !== null) && gameDraft.bans.TEAM_2.every((c) => c !== null);
	const allPicksFilled =
		gameDraft.picks.TEAM_1.every((c) => c !== null) &&
		gameDraft.picks.TEAM_2.every((c) => c !== null);
	const ready = allBansFilled && allPicksFilled && winner !== null && gameDraft.team1Side !== null;

	const submit = useCallback(async () => {
		if (!ready || gameDraft.team1Side === null || winner === null) return;
		setSubmitting(true);
		setError(null);
		try {
			const buildPicks = (team: Team) =>
				lanes.map((lane, i) => ({
					role: lane,
					championId: gameDraft.picks[team][i] ?? -1,
				}));

			await api(`/series/${seriesId}/games`, {
				method: "POST",
				body: JSON.stringify({
					gameNumber: gameDraft.gameNumber,
					team1Side: gameDraft.team1Side,
					winningTeam: winner,
					durationMin: durationMin ? Number(durationMin) : undefined,
					picks: {
						TEAM_1: buildPicks("TEAM_1"),
						TEAM_2: buildPicks("TEAM_2"),
					},
					bans: {
						TEAM_1: gameDraft.bans.TEAM_1.filter((c): c is number => c !== null),
						TEAM_2: gameDraft.bans.TEAM_2.filter((c): c is number => c !== null),
					},
				}),
			});
			onRecorded();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
			setSubmitting(false);
		}
	}, [ready, gameDraft, winner, durationMin, lanes, seriesId, onRecorded]);

	// W1 키보드 단축키 — 1/2 (승자) + Ctrl+Enter (기록).
	// IME 한글 자모 조합 중에는 isComposing 으로 skip. input focus 시 native 우선.
	useEffect(() => {
		if (!perms.canEdit) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.isComposing) return;
			const tag = (document.activeElement as HTMLElement | null)?.tagName;
			const isInInput = tag === "INPUT" || tag === "TEXTAREA";

			// Ctrl+Enter — 기록 (input focus 여도 동작)
			if (e.ctrlKey && e.key === "Enter") {
				e.preventDefault();
				if (ready && !submitting) submit();
				return;
			}

			// 1/2 — 승자 (input focus 시 skip)
			if (isInInput) return;
			if (e.key === "1") {
				e.preventDefault();
				setWinner("TEAM_1");
			} else if (e.key === "2") {
				e.preventDefault();
				setWinner("TEAM_2");
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [perms.canEdit, ready, submitting, submit]);

	return (
		<div className="card surface-base shadow-sm border-l-4 border-success">
			<div className="card-body p-4 gap-3">
				<div className="space-y-2">
					<h3 className="card-title text-base">Game {gameDraft.gameNumber} 결과 입력</h3>
					{/* D2 — 4단계 진행 시각화 */}
					<ul className="steps steps-horizontal w-full text-xs">
						<li className={`step ${gameDraft.team1Side ? "step-success" : ""}`}>사이드</li>
						<li className={`step ${allBansFilled ? "step-success" : ""}`}>밴</li>
						<li className={`step ${allPicksFilled ? "step-success" : ""}`}>픽</li>
						<li className={`step ${winner ? "step-success" : ""}`}>승자</li>
					</ul>
				</div>

				{(!allBansFilled || !allPicksFilled) && (
					<div className="alert alert-warning alert-soft py-2">
						<span className="text-xs">
							{!allBansFilled && "⚠️ 밴 슬롯이 비어있습니다. "}
							{!allPicksFilled && "⚠️ 픽 슬롯이 비어있습니다."}
						</span>
					</div>
				)}

				<div className="grid grid-cols-2 gap-3">
					<ResultRadioCard
						team="TEAM_1"
						selected={winner === "TEAM_1"}
						onClick={() => setWinner("TEAM_1")}
						pickIds={gameDraft.picks.TEAM_1}
						lanes={lanes}
						champById={champById}
						disabled={!perms.canEdit}
					/>
					<ResultRadioCard
						team="TEAM_2"
						selected={winner === "TEAM_2"}
						onClick={() => setWinner("TEAM_2")}
						pickIds={gameDraft.picks.TEAM_2}
						lanes={lanes}
						champById={champById}
						disabled={!perms.canEdit}
					/>
				</div>

				<label className="form-control">
					<div className="label py-1">
						<span className="label-text text-xs text-base-content/70">게임 시간 (분, 선택)</span>
					</div>
					<input
						type="number"
						min="0"
						placeholder="예: 32"
						value={durationMin}
						onChange={(e) => setDurationMin(e.target.value)}
						className="input input-bordered input-sm"
					/>
				</label>

				{error && (
					<div className="alert alert-error">
						<span>{error}</span>
					</div>
				)}

				{(() => {
					const tip = !perms.canEdit
						? "쓰기 권한이 없습니다 (읽기 전용)"
						: !allBansFilled
							? "밴 슬롯을 모두 채워야 합니다."
							: !allPicksFilled
								? "픽 슬롯을 모두 채워야 합니다."
								: gameDraft.team1Side === null
									? "사이드(BLUE/RED)를 먼저 선택하세요."
									: winner === null
										? "승리 팀을 선택하세요."
										: undefined;
					const btn = (
						<button
							type="button"
							className="btn btn-success btn-block sticky bottom-2"
							onClick={submit}
							disabled={!ready || submitting || !perms.canEdit}
						>
							{submitting ? (
								<>
									<span className="loading loading-spinner loading-sm" />
									기록 중…
								</>
							) : (
								<>
									Game {gameDraft.gameNumber} 결과 기록
									{perms.canEdit && (
										<span className="ml-2 inline-flex items-center gap-0.5 opacity-80">
											<kbd className="kbd kbd-sm">Ctrl</kbd>
											<span className="opacity-60">+</span>
											<kbd className="kbd kbd-sm">Enter</kbd>
										</span>
									)}
								</>
							)}
						</button>
					);
					return tip ? (
						<span className="tooltip tooltip-top w-full block" data-tip={tip}>
							{btn}
						</span>
					) : (
						btn
					);
				})()}
			</div>
		</div>
	);
}
