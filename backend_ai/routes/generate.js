import { Router } from 'express'
import Groq from 'groq-sdk'
import { supabase } from '../supabaseClient.js'
import dotenv from 'dotenv'

dotenv.config()

export const generateRoute = Router()

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

generateRoute.post('/generate', async (req, res) => {
  const { prompt } = req.body

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' })
  }

  try {
    // We want a GridCell[][] of size roughly 8x12
    const systemPrompt = `
You are an expert urban planner and grid layout generator.
The user will describe a city layout. Output ONLY a valid JSON object with a single key "grid". The value of "grid" MUST result in a 2D array (8 rows by 12 columns).

Each element MUST be an object with the exact shape: {"x": number, "y": number, "type": string}
Where:
- x is the column index (0 to 11)
- y is the row index (0 to 7)
- type is ONE OF: "road", "residential", "commercial", "park", "industrial", "water", "empty"

Rules:
1. "road" should form connected networks.
2. "commercial" is usually central or along main roads.
3. "residential" is usually in clusters off main roads.
4. "park" and "water" should be grouped naturally.
5. "industrial" should be grouped and away from residential if possible.
6. The entire grid MUST be 8x12.
7. Return a JSON object with a "grid" array property ONLY. No markdown or explanation.`

    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1, // low temperature for structured layout output
      response_format: { type: 'json_object' }
    })

    const rawContent = completion.choices[0]?.message?.content || ''
    
    // Sometimes the model outputs { "grid": [...] } if forced to use json_object
    // Let's safely extract the array.
    let grid = null
    try {
      const parsed = JSON.parse(rawContent)
      // Attempt to find the array if wrapped
      if (Array.isArray(parsed)) {
        grid = parsed
      } else if (parsed && typeof parsed === 'object') {
        const values = Object.values(parsed)
        const possibleArray = values.find(Array.isArray)
        if (possibleArray) grid = possibleArray
      }
    } catch (e) {
      console.error('JSON Parse error', e)
    }

    if (!grid || !Array.isArray(grid)) {
        throw new Error('Failed to extract valid grid array from response')
    }

    // Insert into Supabase
    const { data, error } = await supabase
      .from('city_layouts')
      .insert({
        prompt,
        grid,
        ai_model: 'llama-3.3-70b-versatile'
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
    res.status(500).json({ error: 'Failed to generate layout' })
  }
})
