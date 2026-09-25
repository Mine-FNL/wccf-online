import { Routes, Route } from 'react-router'
import Layout from './components/Layout'
import Home from './pages/Home'
import MyClub from './pages/MyClub'
import Scouting from './pages/Scouting'
import Clubs from './pages/Clubs'
import HallOfFame from './pages/HallOfFame'
import Events from './pages/Events'
import Theatre from './pages/Theatre'
import Circle from './pages/Circle'
import Login from './pages/Login'
import NotFound from './pages/NotFound'

/* Children pattern: Layout renders {children} wrapping <Routes>. */
export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/club" element={<MyClub />} />
        <Route path="/scouting" element={<Scouting />} />
        <Route path="/clubs" element={<Clubs />} />
        <Route path="/hall-of-fame" element={<HallOfFame />} />
        <Route path="/events" element={<Events />} />
        <Route path="/theatre" element={<Theatre />} />
        <Route path="/circle" element={<Circle />} />
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  )
}
