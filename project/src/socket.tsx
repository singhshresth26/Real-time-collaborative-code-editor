import { io, Socket } from "socket.io-client";

export const getBackendUrl = (): string => {
  const envUrl = import.meta.env.VITE_BACKEND_URL;

  // If a custom non-localhost URL is specified in env, use it
  if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
    return envUrl;
  }

  // Dynamically resolve URL using browser window location
  if (typeof window !== "undefined") {
    const { protocol, hostname, port, origin } = window.location;

    // If the frontend is running on a dev server (e.g. Vite on port 5173),
    // target port 5000 on the same machine IP / hostname
    if (port && port !== "5000") {
      return `${protocol}//${hostname}:5000`;
    }

    // If served by the production backend (port 5000) or reverse proxy, use current origin
    return origin || "/";
  }

  return "http://localhost:5000";
};

export const initSocket = async (): Promise<Socket> => {
  const backendUrl = getBackendUrl();
  console.log("Connecting socket to:", backendUrl);

  const socket = io(backendUrl, {
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    timeout: 10000,
  });

  socket.on("connect", () => {
    console.log("Connected to socket:", socket.id);
  });

  socket.on("connect_error", (err) => {
    console.error(`Socket connection error to ${backendUrl}:`, err);
  });

  return socket;
};
