import express from "express"
import http from "http"
import { Server } from "socket.io"
import cors from "cors"

const app = express()
app.use(cors())
app.use(express.json())

const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: "*", // In production, restrict this to the web app URL
    methods: ["GET", "POST"]
  }
})

// Internal secret to prevent unauthorized broadcasts
const INTERNAL_SECRET = process.env.INTERNAL_SECRET || "pirate-secret-key-123"

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    connectedClients: io.engine.clientsCount,
    timestamp: new Date().toISOString()
  })
})

app.post("/broadcast", (req, res) => {
  const authHeader = req.headers.authorization
  if (authHeader !== `Bearer ${INTERNAL_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" })
  }

  const { room, event, payload } = req.body
  if (!room || !event) {
    return res.status(400).json({ error: "Missing room or event" })
  }

  const baseRoom = room.replace(/^competition_/, "")

  // Broadcast to all clients in both raw and prefixed room names
  io.to(room).emit(event, payload)
  io.to(`competition_${baseRoom}`).emit(event, payload)
  io.to(baseRoom).emit(event, payload)
  
  // Also emit to admin_feed and globally so admin live dashboards receive everything
  io.to("admin_feed").emit(event, { ...payload, _room: room })
  io.emit(event, { ...payload, _room: room })
  
  console.log(`[Broadcast] Event '${event}' sent to room '${room}' (and global admin feed)`)
  return res.json({ success: true })
})

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`)

  socket.on("join_competition", (competitionId: string) => {
    if (!competitionId) return
    const baseId = competitionId.replace(/^competition_/, "")
    socket.join(`competition_${baseId}`)
    socket.join(baseId)
    socket.join("admin_feed")
    console.log(`Client ${socket.id} joined rooms: competition_${baseId}, ${baseId}, admin_feed`)
  })

  socket.on("leave_competition", (competitionId: string) => {
    if (!competitionId) return
    const baseId = competitionId.replace(/^competition_/, "")
    socket.leave(`competition_${baseId}`)
    socket.leave(baseId)
    console.log(`Client ${socket.id} left room: competition_${baseId}`)
  })

  socket.on("join_admin", () => {
    socket.join("admin_feed")
    console.log(`Admin client ${socket.id} joined admin_feed`)
  })

  // Support round:stats relay
  socket.on("round:stats", (data: any) => {
    if (data?.roundId && data?.stats) {
      io.emit("round:stats", data.stats)
      io.emit("round_stats", data.stats)
    }
  })

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`)
  })
})

const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`Real-Time Service running on port ${PORT}`)
})
