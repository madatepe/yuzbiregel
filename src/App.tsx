import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { Home } from '@/pages/Home'
import { PistiHome } from '@/pages/PistiHome'
import { PistiSoloPage } from '@/pages/PistiSoloPage'
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
        <Route path="/pisti" element={<PistiHome />} />
        <Route path="/pisti/tekli" element={<PistiSoloPage />} />
        <Route path="/pisti/:code" element={<TablePage expectedGame="pisti" />} />
        <Route path="/masa/:code" element={<TablePage expectedGame="okey101" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
