import type { FastifyInstance } from "fastify";
import { joinRoom, leaveAllRooms } from "./rooms.js";

export async function registerWs(app: FastifyInstance): Promise<void> {
	app.get("/ws", { websocket: true }, (socket, req) => {
		const sid = req.cookies.sid ? req.unsignCookie(req.cookies.sid) : null;
		if (!sid?.valid) {
			socket.close(1008, "unauthenticated");
			return;
		}

		console.log(`[ws] connect user=${sid.value}`);
		socket.send(JSON.stringify({ t: "hello", discordId: sid.value }));

		socket.on("message", (raw) => {
			let msg: { t?: string; topic?: string };
			try {
				msg = JSON.parse(raw.toString());
			} catch {
				return;
			}
			if (msg.t === "join" && typeof msg.topic === "string") {
				joinRoom(msg.topic, socket);
				socket.send(JSON.stringify({ t: "joined", topic: msg.topic }));
			}
		});

		socket.on("close", (code, reason) => {
			console.log(`[ws] close user=${sid.value} code=${code} reason=${reason?.toString() ?? ""}`);
			leaveAllRooms(socket);
		});
	});
}
