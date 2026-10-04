"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalIcon, ChartIcon, LogIcon } from "./Icons";

export default function Nav() {
  const path = usePathname();
  const items = [{ href: "/", label: "Log", icon: <LogIcon /> }, { href: "/history/", label: "History", icon: <CalIcon /> }, { href: "/progress/", label: "Progress", icon: <ChartIcon /> }];
  return (
    <nav className="nav" aria-label="Main">
      {items.map(i => {
        const on = i.href === "/" ? path === "/" : path?.startsWith(i.href.replace(/\/$/, ""));
        return <Link key={i.href} href={i.href} className={on ? "on" : ""} aria-current={on ? "page" : undefined}>{i.icon}{i.label}</Link>;
      })}
    </nav>
  );
}
