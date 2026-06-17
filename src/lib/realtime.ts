import type { Server } from "socket.io";

let io: Server | null = null;

export const setSocketIO = (server: Server) => {
  io = server;
};

export const getSocketIO = () => io;
