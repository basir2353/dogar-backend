import http from "node:http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { app } from "./app";
import { env } from "./config/env";
import { isUserInConversation } from "./lib/conversation-access";
import { setSocketIO } from "./lib/realtime";
import { prisma } from "./config/prisma";

const frontendOrigin = env.FRONTEND_URL?.replace(/\/$/, "").trim();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: env.NODE_ENV === "production" && frontendOrigin ? frontendOrigin : true,
    credentials: true
  }
});
setSocketIO(io);

io.use((socket, next) => {
  const token = socket.handshake.auth?.token as string | undefined;
  if (!token) {
    return next(new Error("Unauthorized"));
  }

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as { userId: string };
    socket.data.userId = payload.userId;
    return next();
  } catch {
    return next(new Error("Unauthorized"));
  }
});

const CHAT_MESSAGE_MAX = 8_000;

io.on("connection", (socket) => {
  const userId: string = socket.data.userId;

  socket.on("join:conversation", async (conversationId: string) => {
    if (!conversationId) {
      return;
    }
    if (!(await isUserInConversation(userId, conversationId))) {
      socket.emit("error", { code: "FORBIDDEN", message: "Not a member of this conversation" });
      return;
    }
    socket.join(`conversation:${conversationId}`);
  });

  socket.on("typing:start", async (conversationId: string) => {
    if (!conversationId) {
      return;
    }
    if (!(await isUserInConversation(userId, conversationId))) {
      return;
    }
    socket.to(`conversation:${conversationId}`).emit("typing:start", { userId });
  });

  socket.on("typing:stop", async (conversationId: string) => {
    if (!conversationId) {
      return;
    }
    if (!(await isUserInConversation(userId, conversationId))) {
      return;
    }
    socket.to(`conversation:${conversationId}`).emit("typing:stop", { userId });
  });

  socket.on("message:send", async (payload: { conversationId: string; body?: string; imageUrl?: string | null }) => {
    const { conversationId, body, imageUrl } = payload ?? {};
    const text = typeof body === "string" ? body.trim() : "";
    const image = typeof imageUrl === "string" && imageUrl.trim().length > 0 ? imageUrl.trim() : null;
    if (!conversationId || (!text && !image)) {
      return;
    }
    if (text.length > CHAT_MESSAGE_MAX) {
      socket.emit("error", { code: "VALIDATION_ERROR", message: "Message is too long" });
      return;
    }
    if (!(await isUserInConversation(userId, conversationId))) {
      socket.emit("error", { code: "FORBIDDEN", message: "Not a member of this conversation" });
      return;
    }
    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId: userId,
        body: text,
        imageUrl: image
      }
    });

    io.to(`conversation:${conversationId}`).emit("message:new", message);
  });
});

if (env.NODE_ENV === "production" && !frontendOrigin) {
  // eslint-disable-next-line no-console
  console.warn(
    "[api] FRONTEND_URL is not set: CORS and Socket.IO allow all origins. Set FRONTEND_URL in production."
  );
}

server.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Dogar API listening on port ${env.PORT}`);
});
