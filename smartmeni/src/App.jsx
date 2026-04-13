import { Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing.jsx'
import Menu from './pages/Menu.jsx'
import Register from './pages/Register.jsx'
import Login from './pages/Login.jsx'
import Admin from './pages/Admin.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/registracija" element={<Register />} />
      <Route path="/login" element={<Login />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/:slug" element={<Menu />} />
    </Routes>
  )
}
