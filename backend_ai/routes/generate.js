import { Router } from 'express'
import { OpenAI } from 'openai'
import Groq from 'groq-sdk'
import { supabase } from '../supabaseClient.js'
import dotenv from 'dotenv'

// Force reload of env vars so server doesn't need to be restarted immediately
dotenv.config({ override: true })

export const generateRoute = Router()

generateRoute.post('/generate', async (req, res) => {
  const { prompt } = req.body

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' })
  }

  // Pick the best available API Key
  const openRouterKey = process.env.OPENROUTER_API_KEY
  const geminiKey = process.env.GEMINI_API_KEY
  const groqKey = process.env.GROQ_API_KEY
  
  if (!openRouterKey && !geminiKey && !groqKey) {
    return res.status(500).json({ error: 'No API keys configured in .env' })
  }

  try {
    // We want a GridCell[][] of size exactly 8x12
    const systemPrompt = `
You are an expert algorithmic urban planner. You are designing a city grid.
The user will provide a descriptive prompt. You must output ONLY a valid JSON object containing a "grid" array.
The grid MUST be exactly 8 rows and 12 columns (96 cells total).

RULES FOR SPATIAL REASONING:
1. "road" cells MUST form contiguous, connected networks (a continuous line or branching tree). Never place an isolated road.
2. "commercial" cells should be clustered together (e.g. 3x3 or 4x2 blocks) to form a dense downtown core.
3. "residential" cells should surround commercial areas and parks.
4. "industrial" cells MUST be placed on the far edges of the map, away from residential.
5. "park" and "water" should form natural shapes (a continuous river line or a large central square). 

JSON SCHEMA:
{
  "grid": [
    { "x": 0, "y": 0, "type": "water" },
    ...
  ]
}
Where:
- x is column index (0 to 11)
- y is row index (0 to 7)
- type is EXACTLY ONE OF: "road", "residential", "commercial", "park", "industrial", "water", "empty"

Do NOT wrap the JSON in Markdown formatting like \`\`\`json. Output raw JSON only.`

    let rawContent = null
    let modelUsed = ''

    // 1. Try OpenRouter (Gemini 2.0 Flash/Pro) - BEST AT LOGIC
    if (!rawContent && openRouterKey) {
      try {
        console.log('Attempting OpenRouter (Gemini 2.0 Flash)')
        const openai = new OpenAI({ baseURL: "https://openrouter.ai/api/v1", apiKey: openRouterKey })
        const completion = await openai.chat.completions.create({
          model: "google/gemini-2.0-flash-exp:free",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt }
          ],
          temperature: 0.1,
        })
        rawContent = completion.choices[0].message.content
        modelUsed = 'openrouter/gemini-2.0'
      } catch (err) {
        console.error('OpenRouter Failed:', err.message)
      }
    }

    // 2. Try Native Gemini
    if (!rawContent && geminiKey) {
      try {
        console.log('Attempting Native Google Gemini API')
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${geminiKey}`
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: systemPrompt + "\n\nUser Prompt: " + prompt }] }],
            generationConfig: { temperature: 0.1 }
          })
        })
        const jsonResponse = await response.json()
        if (jsonResponse.error) throw new Error(jsonResponse.error.message)
        rawContent = jsonResponse.candidates?.[0]?.content?.parts?.[0]?.text
        modelUsed = 'gemini-1.5-pro'
      } catch (err) {
        console.error('Native Gemini Failed:', err.message)
      }
    }

    // 3. Try Groq (Llama 3) - FASTEST BUT WEAKER SPATIAL LOGIC
    if (!rawContent && groqKey) {
      try {
        console.log('Attempting Groq Fallback (Llama 3)')
        const groq = new Groq({ apiKey: groqKey })
        const completion = await groq.chat.completions.create({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
          model: 'llama-3.3-70b-versatile',
          temperature: 0.1,
          response_format: { type: 'json_object' }
        })
        rawContent = completion.choices[0]?.message?.content
        modelUsed = 'groq/llama-3.3-70b'
      } catch (err) {
        console.error('Groq Failed:', err.message)
      }
    }

    if (!rawContent) {
      throw new Error('All AI providers (OpenRouter, Gemini, Groq) failed.')
    }

    // Safely parse JSON
    let grid = null
    try {
      const cleanedContent = rawContent.replace(/```json/g, '').replace(/```/g, '').trim()
      const parsed = JSON.parse(cleanedContent)
      
      if (Array.isArray(parsed)) grid = parsed
      else if (parsed.grid && Array.isArray(parsed.grid)) grid = parsed.grid
      else {
        const values = Object.values(parsed)
        const possibleArray = values.find(Array.isArray)
        if (possibleArray) grid = possibleArray
      }
    } catch (e) {
      console.error('JSON Parse error', e)
      console.log('Raw output was:', rawContent)
      throw new Error('Failed to parse AI output into valid JSON')
    }

    if (!grid || grid.length === 0) {
        throw new Error('Failed to extract valid grid array from response')
    }

    // Convert flat 1D array to 2D 8x12 grid if necessary to prevent frontend crashes
    if (grid.length > 0 && !Array.isArray(grid[0])) {
      const grid2D = []
      for (let y = 0; y < 8; y++) {
        const row = []
        for (let x = 0; x < 12; x++) {
          const cell = grid.find(c => c.x === x && c.y === y) || { x, y, type: 'empty' }
          row.push(cell)
        }
        grid2D.push(row)
      }
      grid = grid2D
    }

    // Insert into Supabase
    const { data, error } = await supabase
      .from('city_layouts')
      .insert({
        prompt: prompt,
        grid: grid,
        ai_model: modelUsed
      })
      .select()
      .single()

    if (error) throw error

    // Return the generated grid and db row info to frontend
    res.json({
      id: data.id,
      prompt: data.prompt,
      layoutData: data.grid,
      timestamp: new Date(data.created_at).getTime(),
    })
  } catch (error) {
    console.error('Generation Error:', error)
    res.status(500).json({ error: error.message || 'Failed to generate layout' })
  }
})
