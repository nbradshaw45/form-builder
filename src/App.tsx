import { Outlet } from "react-router";
import "./App.css";
import { Header } from "./shared/components/Header";

export function App() {
  return (
    <main className="flex min-h-screen w-full flex-col">
      <Header />
      <div className="flex-1">
        <Outlet />
      </div>
    </main>
  );
}
