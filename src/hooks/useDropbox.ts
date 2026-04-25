import { useState, useEffect } from "react"
import { supabase } from "@/integrations/supabase/client"

export function useDropbox() {
  const [connected, setConnected] = useState<boolean | null>(null)
  const [loading, setLoading]     = useState(false)

  const checkStatus = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dropbox-oauth/status`,
      { headers: { Authorization: `Bearer ${session.access_token}` } }
    )
    const data = await res.json()
    setConnected(data.connected)
  }

  useEffect(() => { checkStatus() }, [])

  const connect = async () => {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    // Redirige vers la fonction authorize
    window.location.href =
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dropbox-oauth/authorize`
  }

  const disconnect = async () => {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dropbox-oauth/disconnect`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` }
      }
    )
    setConnected(false)
    setLoading(false)
  }

  return { connected, loading, connect, disconnect }
}
