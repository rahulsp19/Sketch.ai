import { Router } from 'express'
import { supabase } from '../supabaseClient.js'

export const historyRoute = Router()

historyRoute.get('/history', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('city_layouts')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    // Map to frontend HistoryItem shape
    const history = data.map((row) => ({
      id: row.id,
      prompt: row.prompt,
      layoutData: row.grid, // frontend expects layoutData
      timestamp: new Date(row.created_at).getTime(),
    }))

    res.json(history)
  } catch (error) {
    console.error('Error fetching history:', error)
    res.status(500).json({ error: 'Failed to fetch history' })
  }
})

historyRoute.delete('/history/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { error } = await supabase.from('city_layouts').delete().eq('id', id)

    if (error) throw error

    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting history item:', error)
    res.status(500).json({ error: 'Failed to delete history item' })
  }
})
