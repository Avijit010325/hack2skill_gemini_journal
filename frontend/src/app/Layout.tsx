// Layout — glass navigation bar + responsive app shell

import React, { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { PenLine, Lightbulb, LogOut, Menu, X, Moon, Sun } from "lucide-react";
import { useAuth } from "@/features/auth/AuthProvider";
import { GlassButton } from "@/components/ui/GlassButton";

export function Layout() {
  const { user, signOut } = useAuth();
  const navigate          = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme,      setTheme]      = useState<"dark" | "light">("dark");

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
  }

  async function handleSignOut() {
    await signOut();
    navigate("/login");
  }

  const navItems = [
    { to: "/",         label: "Journal",  icon: <PenLine size={18} /> },
    { to: "/insights", label: "Insights", icon: <Lightbulb size={18} /> },
  ];

  const NavContent = () => (
    <>
      {/* Logo */}
      <NavLink
        to="/"
        style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", textDecoration: "none" }}
        onClick={() => setMobileOpen(false)}
      >
        <div
          style={{
            width:          "42px",
            height:         "42px",
            borderRadius:   "50%",
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            flexShrink:     0,
            overflow:       "hidden",
            border:         "2px solid rgba(255,255,255,0.25)",
            boxShadow:      "0 0 12px rgba(200, 100, 80, 0.4)",
            background:     "rgba(255,255,255,0.1)",
          }}
        >
          <img src="/logo.png" alt="Journal Logo" style={{ width: "115%", height: "115%", objectFit: "cover", objectPosition: "center 20%" }} />
        </div>
        <span style={{ fontWeight: 700, fontSize: "var(--text-base)", color: "var(--text-primary)" }}>
          Journal
        </span>
      </NavLink>

      {/* Nav items */}
      <nav aria-label="Main navigation">
        <ul style={{ listStyle: "none", display: "flex", gap: "var(--space-1)" }}>
          {navItems.map(({ to, label, icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === "/"}
                onClick={() => setMobileOpen(false)}
                style={({ isActive }) => ({
                  display:        "flex",
                  alignItems:     "center",
                  gap:            "var(--space-2)",
                  padding:        "var(--space-2) var(--space-3)",
                  borderRadius:   "var(--radius-md)",
                  textDecoration: "none",
                  fontWeight:     isActive ? 600 : 400,
                  fontSize:       "var(--text-sm)",
                  color:          isActive ? "var(--accent)" : "var(--text-secondary)",
                  background:     isActive ? "var(--accent-subtle)" : "transparent",
                  transition:     "all var(--duration-fast) var(--ease-out)",
                })}
              >
                {icon}
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Right side: theme + user + sign out */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginLeft: "auto" }}>
        <GlassButton
          variant="ghost"
          size="sm"
          icon={theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        />

        <div
          title={user?.displayName ?? user?.email ?? "Profile"}
          style={{
            width:        "32px",
            height:       "32px",
            borderRadius: "50%",
            objectFit:    "cover",
            border:       "2px solid var(--glass-border)",
            overflow:     "hidden",
            flexShrink:   0,
            display:      "flex",
            alignItems:   "center",
            justifyContent: "center",
            background:   user?.photoURL ? "transparent" : "var(--accent)",
            color:        "white",
            fontWeight:   700,
            fontSize:     "14px",
          }}
        >
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName ?? "Your avatar"}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <span>{(user?.displayName ?? user?.email ?? "U")[0].toUpperCase()}</span>
          )}
        </div>

        <GlassButton
          variant="ghost"
          size="sm"
          icon={<LogOut size={16} />}
          onClick={handleSignOut}
          aria-label="Sign out"
        />
      </div>
    </>
  );

  return (
    <>
      {/* Desktop nav bar */}
      <header
        className="glass"
        style={{
          position:      "sticky",
          top:           0,
          zIndex:        "var(--z-elevated)",
          display:       "flex",
          alignItems:    "center",
          gap:           "var(--space-4)",
          padding:       "0 var(--space-6)",
          height:        "64px",
          borderRadius:  0,
          borderTop:     "none",
          borderInline:  "none",
        }}
      >
        <NavContent />

        {/* Mobile menu toggle */}
        <GlassButton
          variant="ghost"
          size="sm"
          icon={mobileOpen ? <X size={18} /> : <Menu size={18} />}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
          style={{ display: "none" }}
          className="mobile-menu-btn"
        />
      </header>

      {/* Page content */}
      <main style={{ minHeight: "calc(100dvh - 64px)" }}>
        <Outlet />
      </main>

      {/* Mobile nav overlay */}
      {mobileOpen && (
        <div
          style={{
            position:  "fixed",
            inset:     "64px 0 0",
            zIndex:    "var(--z-overlay)",
            background: "var(--bg-base)",
            padding:   "var(--space-4)",
          }}
        >
          <nav aria-label="Mobile navigation">
            {navItems.map(({ to, label, icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                onClick={() => setMobileOpen(false)}
                style={({ isActive }) => ({
                  display:        "flex",
                  alignItems:     "center",
                  gap:            "var(--space-3)",
                  padding:        "var(--space-4)",
                  borderRadius:   "var(--radius-md)",
                  textDecoration: "none",
                  fontWeight:     isActive ? 600 : 400,
                  color:          isActive ? "var(--accent)" : "var(--text-primary)",
                  background:     isActive ? "var(--accent-subtle)" : "transparent",
                  fontSize:       "var(--text-lg)",
                  marginBottom:   "var(--space-2)",
                })}
              >
                {icon}
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      )}

      <style>{`
        @media (max-width: 640px) {
          .mobile-menu-btn { display: flex !important; }
          header nav, header img { display: none; }
        }
      `}</style>
    </>
  );
}
