import { Routes, Route, Navigate } from "react-router-dom";
import Shell from "./components/Shell";
import Overview from "./pages/Overview";
import Strategies from "./pages/Strategies";
import Runbook from "./pages/Runbook";
import EventDetail from "./pages/EventDetail";

export default function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Navigate to="/overview" replace />} />
        <Route path="/overview" element={<Overview />} />
        <Route path="/strategies" element={<Strategies />} />
        <Route path="/strategies/:id" element={<Strategies />} />
        <Route path="/runbook" element={<Runbook />} />
        <Route path="/history" element={<Navigate to="/runbook" replace />} />
        <Route path="/events" element={<Navigate to="/runbook" replace />} />
        <Route path="/events/:id" element={<EventDetail />} />
      </Routes>
    </Shell>
  );
}
