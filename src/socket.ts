import { Server } from "socket.io";

let io: Server | null = null;

export const initSocketServer = (port: number = 3001) => {
  io = new Server(port, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);
    
    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  console.log(`Socket.IO server running on port ${port}`);
  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized. Call initSocketServer first.");
  }
  return io;
};

export const emitScreeningComplete = (jobId: string) => {
  if (!io) {
    console.error("Socket.io not initialized. Call initSocketServer first.");
    return;
  }
  
  io.emit("screening:complete", { jobId });
  console.log(`Emitted screening:complete event for job: ${jobId}`);
}; 