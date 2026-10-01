import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { Home } from '@/pages/Home'
import { TablePage } from '@/pages/TablePage'
import { Toaster } from '@/components/ui/Toaster'
import { useSession } from '@/stores/session'

export default function App() {
  const init = useSession((s) => s.init)
  useEffect(() => {
    void init()
  }, [init])

  return (
    <BrowserRouter>
      <Toaster />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/masa/:code" element={<TablePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
