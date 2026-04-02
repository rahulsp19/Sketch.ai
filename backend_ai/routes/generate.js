import { Router } from 'express'
import { OpenAI } from 'openai'
import Groq from 'groq-sdk'
import { supabase } from '../supabaseClient.js'
import { CityGenerator } from '../utils/CityGenerator.js'
import dotenv from 'dotenv'

// Force reload of env vars so server doesn't need to be restarted immediately
dotenv.config({ override: true })

function inferPromptOverrides(prompt) {
  const text = prompt.toLowerCase()
  const overrides = {}

  const hasVerticalRiver =
    /(vertical|north[-\s]?south).{0,30}river/.test(text) ||
    /river.{0,30}(vertical|north[-\s]?south)/.test(text)
  const hasHorizontalRiver =
    /(horizontal|east[-\s]?west).{0,30}river/.test(text) ||
    /river.{0,30}(horizontal|east[-\s]?west)/.test(text)

  if (hasVerticalRiver) {
    overrides.waterStyle = 'river_vertical'
  } else if (hasHorizontalRiver) {
    overrides.waterStyle = 'river_horizontal'
  } else if (/coastal.*left|left.*coastal|west coast|left shore/.test(text)) {
    overrides.waterStyle = 'coastal_left'
  } else if (/coastal.*right|right.*coastal|east coast|right shore/.test(text)) {
    overrides.waterStyle = 'coastal_right'
  } else if (/lake|reservoir|pond/.test(text)) {
    overrides.waterStyle = 'lake_center'
  }

  if (/winding|organic|curvy|curved|meandering|snaking/.test(text)) {
    overrides.roadStyle = 'organic'
  } else if (/grid|orthogonal|block pattern|straight roads/.test(text)) {
    overrides.roadStyle = 'grid'
  }

  if (/low[-\s]?density|sparse|quiet town|small town|village|hamlet/.test(text)) {
    overrides.density = 'low'
  } else if (/high[-\s]?density|dense urban|metropolitan|downtown|packed/.test(text)) {
    overrides.density = 'high'
  }

  const industrialHint = /logging|sawmill|lumber|mill town|industrial|factory|warehouse/.test(text)
  const residentialHint = /residential|housing|homes|suburb/.test(text)
  const commercialHint = /commercial|business district|offices|retail|mall/.test(text)

  if (industrialHint) {
    overrides.primaryZone = 'industrial'
  } else if (residentialHint) {
    overrides.primaryZone = 'residential'
  } else if (commercialHint) {
    overrides.primaryZone = 'commercial'
  }

  const noParkHint = /without parks|no parks|no green space/.test(text)
  const centralParkHint = /central park|single central park/.test(text)
  const borderingParkHint = /green belt|bordering forest|edge forest|forest border/.test(text)
  const forestHint = /forest|forests|woods|woodland|tree[-\s]?dense|pine/.test(text)

  if (noParkHint) {
    overrides.parkStyle = 'none'
  } else if (centralParkHint) {
    overrides.parkStyle = 'central'
  } else if (borderingParkHint) {
    overrides.parkStyle = 'bordering'
  } else if (forestHint) {
    overrides.parkStyle = 'scattered'
  }

  if (forestHint) {
    overrides.forestDensity = 'high'
  }

  if (
    /(massive|wide|huge|major|broad).{0,20}(river|waterway)/.test(text) ||
    /(river|waterway).{0,20}(massive|wide|huge|major|broad)/.test(text)
  ) {
    overrides.riverScale = 'wide'
  }

  return overrides
}

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
    const systemPrompt = `
You are an expert algorithmic urban planner. You must act as an extraction engine.
The user will provide a descriptive prompt for a city. You must read it and output ONLY a valid JSON object matching this strict schema:
{
  "waterStyle": "river_vertical" | "river_horizontal" | "coastal_left" | "coastal_right" | "lake_center" | "none",
  "primaryZone": "commercial" | "industrial" | "residential",
  "density": "high" | "medium" | "low",
  "parkStyle": "central" | "scattered" | "bordering" | "none",
  "roadStyle": "grid" | "organic"
}

Do NOT output an array. Just output the JSON configuration object.
Example: {"waterStyle":"coastal_left", "primaryZone":"commercial", "density":"high", "parkStyle":"bordering", "roadStyle":"organic"}
`

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
    let config = {}
    try {
      const cleanedContent = rawContent.replace(/```json/g, '').replace(/```/g, '').trim()
      config = JSON.parse(cleanedContent)
    } catch (e) {
      console.error('JSON Parse error', e)
      console.log('Raw output was:', rawContent)
      throw new Error('Failed to parse AI output into valid JSON')
    }

    // Apply deterministic keyword overrides so prompt-critical intent is preserved.
    const overrides = inferPromptOverrides(prompt)

    // Intercept LLM intent and generate perfect mathematical grid
    const engine = new CityGenerator({
      waterStyle: overrides.waterStyle || config.waterStyle || 'none',
      primaryZone: overrides.primaryZone || config.primaryZone || 'commercial',
      density: overrides.density || config.density || 'medium',
      parkStyle: overrides.parkStyle || config.parkStyle || 'scattered',
      roadStyle: overrides.roadStyle || config.roadStyle || 'grid',
      forestDensity: overrides.forestDensity || 'normal',
      riverScale: overrides.riverScale || 'normal',
    })

    const grid = engine.generate()

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
