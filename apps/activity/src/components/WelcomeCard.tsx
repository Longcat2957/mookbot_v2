// 신규 사용자 안내 — 대시보드 상단에 한 번만 표시. ✕ 닫으면 localStorage 에 dismiss flag.
// 다시 보려면 도움말 (?) 모달에서 동일 내용 확인 가능.

import { useEffect, useState } from "react";

const STORAGE_KEY = "mookbot-welcome-dismissed-v0.3";

export function WelcomeCard({
	onOpenLeaderboard,
	onOpenMinigame,
	onOpenHelp,
}: {
	onOpenLeaderboard: () => void;
	onOpenMinigame: () => void;
	onOpenHelp: () => void;
}) {
	const [dismissed, setDismissed] = useState<boolean | null>(null);

	useEffect(() => {
		try {
			setDismissed(localStorage.getItem(STORAGE_KEY) === "1");
		} catch {
			setDismissed(false);
		}
	}, []);

	if (dismissed !== false) return null;

	const dismiss = () => {
		try {
			localStorage.setItem(STORAGE_KEY, "1");
		} catch {
			// quota / private mode — 그냥 세션 단위로만 닫힘
		}
		setDismissed(true);
	};

	return (
		<div className="card bg-gradient-to-br from-primary/10 via-base-200 to-info/10 border border-primary/30 shadow-sm">
			<div className="card-body p-4 sm:p-5 gap-3">
				<div className="flex items-start justify-between gap-2">
					<div>
						<h2 className="card-title text-base sm:text-lg flex items-center gap-2">
							👋 monkey Activity 사용 안내
						</h2>
						<p className="text-xs text-base-content/60">
							우상단 작은 아이콘들이 자주 안 보일 수 있어 한 번만 정리해 둡니다.
						</p>
					</div>
					<button
						type="button"
						className="btn btn-ghost btn-xs btn-circle"
						onClick={dismiss}
						aria-label="닫기"
						title="다시 보지 않기"
					>
						✕
					</button>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-3 gap-2">
					<FeatureChip
						icon="🏆"
						title="리더보드"
						desc="라인별 + 통합 MMR 랭킹. 행 클릭 → 그 사람 프로필"
						action="열기"
						onClick={onOpenLeaderboard}
					/>
					<FeatureChip
						icon="🎲"
						title="미니게임"
						desc="동전 / 사다리 / 원판 — BLUE/RED 진영 뽑기 등"
						action="열기"
						onClick={onOpenMinigame}
					/>
					<FeatureChip
						icon="📇"
						title="내 프로필"
						desc="라인별 MMR · MMR 그래프 · 최근 게임 · 주력 챔프"
						action="우상단 닉네임 클릭"
					/>
				</div>

				<div className="text-xs text-base-content/60 flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-base-300/50">
					<span>💡 시리즈 라인업의 멤버 이름을 클릭하면 그 사람 프로필로 이동합니다.</span>
					<button
						type="button"
						className="btn btn-ghost btn-xs"
						onClick={onOpenHelp}
						title="? 키로도 열림"
					>
						❓ 도움말 전체 보기
					</button>
				</div>
			</div>
		</div>
	);
}

// 공통 chip 본문 — clickable / static 가 시각만 동일하게 공유.
function FeatureChipBody({
	icon,
	title,
	desc,
	action,
}: {
	icon: string;
	title: string;
	desc: string;
	action: string;
}) {
	return (
		<>
			<div className="flex items-center gap-2">
				<span className="text-2xl leading-none">{icon}</span>
				<div className="flex-1 min-w-0">
					<div className="font-bold text-sm">{title}</div>
					<div className="text-[10px] text-primary/80 uppercase tracking-wide">{action}</div>
				</div>
			</div>
			<div className="text-xs text-base-content/70 mt-1.5 leading-snug">{desc}</div>
		</>
	);
}

interface FeatureChipBaseProps {
	icon: string;
	title: string;
	desc: string;
	action: string;
}

// onClick 분기로 button/div 가 type 무결성을 잃던 패턴을 두 컴포넌트로 분리.
function FeatureChip(props: FeatureChipBaseProps & { onClick?: () => void }) {
	return props.onClick ? (
		<FeatureChipButton {...props} onClick={props.onClick} />
	) : (
		<FeatureChipStatic {...props} />
	);
}

function FeatureChipButton({ onClick, ...body }: FeatureChipBaseProps & { onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="text-left rounded-md p-3 bg-base-100/60 border border-base-300 hover:bg-base-100 hover:border-primary/40 transition cursor-pointer"
		>
			<FeatureChipBody {...body} />
		</button>
	);
}

function FeatureChipStatic(body: FeatureChipBaseProps) {
	return (
		<div className="text-left rounded-md p-3 bg-base-100/60 border border-base-300">
			<FeatureChipBody {...body} />
		</div>
	);
}
