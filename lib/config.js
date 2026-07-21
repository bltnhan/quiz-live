// Password required to log in as host (create a room). Override in
// production by setting the HOST_PASSWORD environment variable in your
// Vercel project settings, otherwise this default is used.
export const HOST_PASSWORD = process.env.HOST_PASSWORD || "12346789";
