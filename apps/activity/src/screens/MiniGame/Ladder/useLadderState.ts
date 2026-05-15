import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ANIM_DURATION_MS, ROW_TIME_MS, STAGGER_MS } from "./constants.js";
import {
	buildLadderGeom,
	buildPath,
	defaultInputLabel,
	defaultOutputLabel,
	generateRungs,
	type InputState,
	type Rung,
	rungsAlongPath,
	simulate,
} from "./ladderLogic.js";

export function useLadderState() {
	const [count, setCount] = useState(2);
	const [inputLabels, setInputLabels] = useState<string[]>(() =>
		Array.from({ length: 2 }, (_, i) => defaultInputLabel(i, 2)),
	);
	const [outputLabels, setOutputLabels] = useState<string[]>(() =>
		Array.from({ length: 2 }, (_, i) => defaultOutputLabel(i, 2)),
	);
	const [rungs, setRungs] = useState<Rung[]>(() => generateRungs(2));
	const [results, setResults] = useState<number[]>(() => simulate(2, rungs));
	const [inputStates, setInputStates] = useState<Record<number, InputState>>({});
	const [rungDelays, setRungDelays] = useState<Map<number, number>>(new Map());
	const [rungsKey, setRungsKey] = useState(0);
	const timersRef = useRef<number[]>([]);

	const clearTimers = useCallback(() => {
		for (const id of timersRef.current) window.clearTimeout(id);
		timersRef.current = [];
	}, []);

	const regenerate = useCallback(
		(nextCount: number) => {
			clearTimers();
			const nextRungs = generateRungs(nextCount);
			setRungs(nextRungs);
			setResults(simulate(nextCount, nextRungs));
			setInputStates({});
			setRungDelays(new Map());
			setRungsKey((key) => key + 1);
		},
		[clearTimers],
	);

	useEffect(() => {
		regenerate(count);
		setInputLabels((prev) =>
			Array.from({ length: count }, (_, i) => prev[i] ?? defaultInputLabel(i, count)),
		);
		setOutputLabels((prev) =>
			Array.from({ length: count }, (_, i) => prev[i] ?? defaultOutputLabel(i, count)),
		);
	}, [count, regenerate]);

	useEffect(() => {
		return () => clearTimers();
	}, [clearTimers]);

	const inputs = useMemo(() => Array.from({ length: count }, (_, i) => i), [count]);
	const outputs = useMemo(() => Array.from({ length: count }, (_, i) => i), [count]);
	const geom = useMemo(() => buildLadderGeom(count), [count]);
	const pathsByInput = useMemo(() => {
		const paths = new Map<number, string>();
		for (const i of inputs) paths.set(i, buildPath(i, rungs, geom));
		return paths;
	}, [inputs, rungs, geom]);

	const isLocked = Object.values(inputStates).some(
		(state) => state === "running" || state === "done",
	);
	const allDone = inputs.every((i) => inputStates[i] === "done");
	const anyDone = Object.values(inputStates).some((state) => state === "done");

	function startInput(i: number) {
		if (inputStates[i] === "running" || inputStates[i] === "done") return;
		setInputStates((prev) => ({ ...prev, [i]: "running" }));
		setRungDelays((prev) => {
			const next = new Map(prev);
			for (const idx of rungsAlongPath(i, rungs)) {
				if (next.has(idx)) continue;
				const rung = rungs[idx];
				if (rung) next.set(idx, rung.row * ROW_TIME_MS);
			}
			return next;
		});
		const id = window.setTimeout(() => {
			setInputStates((prev) => ({ ...prev, [i]: "done" }));
		}, ANIM_DURATION_MS);
		timersRef.current.push(id);
	}

	function startAll() {
		const pending = inputs.filter((i) => inputStates[i] !== "running" && inputStates[i] !== "done");
		pending.forEach((i, idx) => {
			const startId = window.setTimeout(() => {
				startInput(i);
			}, idx * STAGGER_MS);
			timersRef.current.push(startId);
		});
	}

	function reset() {
		regenerate(count);
	}

	return {
		allDone,
		anyDone,
		count,
		geom,
		inputLabels,
		inputs,
		inputStates,
		isLocked,
		outputLabels,
		outputs,
		pathsByInput,
		results,
		rungDelays,
		rungs,
		rungsKey,
		reset,
		setCount,
		setInputLabels,
		setOutputLabels,
		startAll,
		startInput,
	};
}
