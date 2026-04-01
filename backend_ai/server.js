import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { generateRoute } from './routes/generate.js'
import { historyRoute } from './routes/history.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:4173'] }))
app.use(express.json())

// Routes
app.use('/api', generateRoute)
app.use('/api', historyRoute)

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() })
})

app.listen(PORT, () => {
  console.log(`⚡ CitySketch backend running on http://localhost:${PORT}`)
})
