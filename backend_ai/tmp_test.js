import fs from 'fs'

const prompts = [
  "A perfect grid city with a central park surrounded by commercial, and residential on edges.",
  "An industrial logging town surrounded by tight forests (parks).",
  "A single continuous massive residential block with one road looping it.",
  "Only water. The entire grid is water.",
  "gibberish asfkjanfjknsa"
]

async function runTests() {
  console.log("Starting Spatial Logic Tests...")
  
  for (const prompt of prompts) {
    console.log(`\n\n=== Prompt: "${prompt}" ===`)
    try {
      const start = Date.now()
      const res = await fetch('http://localhost:5000/api/layout/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      })
      
      const time = Date.now() - start
      
      if (!res.ok) {
        console.log(`❌ Failed: HTTP ${res.status}`)
        const text = await res.text()
        console.log(`Error Response: ${text}`)
        continue
      }
      
      const data = await res.json()
      const grid = data.layoutData
      
      console.log(`✅ Success in ${time}ms (Generated ID: ${data.id})`)
      
      // Analyze logical correctness
      let rows = grid.length
      let cols = grid[0] ? grid[0].length : 0
      
      console.log(`Grid Dimensions: ${rows}x${cols} (Expected: 8x12)`)
      
      if (rows !== 8 || cols !== 12) {
        console.log("❌ DIMENSION FAILURE")
      }
      
      // Count types
      const counts = {}
      for (const row of grid) {
        for (const cell of row) {
          counts[cell.type] = (counts[cell.type] || 0) + 1
        }
      }
      console.log("Zone Distribution:", counts)
      
    } catch (e) {
      console.error("❌ Exception during test:", e.message)
    }
  }
}

runTests()
