export function prefersReducedMotion(): boolean {
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export async function runElementAnimation(
	element: HTMLElement | SVGElement | null,
	keyframes: Keyframe[],
	options: KeyframeAnimationOptions,
): Promise<Animation | null> {
	if (!element) return null;
	const animation = element.animate(keyframes, options);
	try {
		await animation.finished;
	} catch {
		return animation;
	}
	return animation;
}

export function startElementAnimation(
	element: HTMLElement | SVGElement | null,
	keyframes: Keyframe[],
	options: KeyframeAnimationOptions,
): Animation | null {
	if (!element) return null;
	return element.animate(keyframes, options);
}

export function cancelAnimation(animation: Animation | null | undefined): void {
	if (animation && animation.playState !== "idle" && animation.playState !== "finished") {
		animation.cancel();
	}
}
