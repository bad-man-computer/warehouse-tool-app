import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserProfile } from '@/types'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

const FAKE_USER: UserProfile = {
  id: 'demo-user-id',
  username: 'demo',
  role: 'admin',
  warehouse_ids: null,
  language: 'zh',
  display_name_zh: '演示用户',
  display_name_en: 'Demo User',
}

interface AuthState {
  user: UserProfile | null
  token: string | null
  loading: boolean
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => Promise<void>
  loadProfile: () => Promise<void>
  setLanguage: (lang: 'zh' | 'en') => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      loading: false,

      async login(username: string, password: string) {
        set({ loading: true })
        try {
          if (!isSupabaseConfigured() || !supabase) {
            if (username === 'demo' && password === 'demo') {
              set({ user: FAKE_USER, token: 'mock-token', loading: false })
              return { ok: true }
            }
            set({ loading: false })
            return { ok: false, error: 'Supabase not configured' }
          }
          const raw = username.trim()
          const email = raw.includes('@') ? raw : `${raw}@warehouse.local`
          const { data, error } = await supabase.auth.signInWithPassword({ email, password })
          if (error) {
            set({ loading: false })
            return { ok: false, error: error.message }
          }
          const token = data.session?.access_token ?? null
          set({ token, loading: false })
          await get().loadProfile()
          return { ok: true }
        } catch (e) {
          set({ loading: false })
          return { ok: false, error: String(e) }
        }
      },

      async logout() {
        if (supabase) await supabase.auth.signOut()
        set({ user: null, token: null })
      },

      async loadProfile() {
        if (!isSupabaseConfigured() || !supabase) {
          if (get().token) set({ user: FAKE_USER })
          return
        }
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (!authUser) return
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .single()
        if (profile) {
          set({
            user: {
              id: profile.id,
              username: profile.username,
              role: profile.role,
              warehouse_ids: profile.warehouse_ids,
              language: profile.language ?? 'zh',
              display_name_zh: profile.display_name_zh,
              display_name_en: profile.display_name_en,
            },
          })
        }
      },

      async setLanguage(lang: 'zh' | 'en') {
        const u = get().user
        if (!u) return
        if (supabase && u.id !== FAKE_USER.id) {
          await supabase.from('profiles').update({ language: lang }).eq('id', u.id)
        }
        set({ user: { ...u, language: lang } })
      },
    }),
    { name: 'warehouse-auth', partialize: (s) => ({ token: s.token, user: s.user }) }
  )
)
