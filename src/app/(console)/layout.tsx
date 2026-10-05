import ConsoleShell from '@/components/ConsoleShell';

/**
 * Every authenticated screen shares this shell. Keeping it as a route
 * group layout means the sidebar and top bar are not re-mounted when the
 * operator moves between screens — navigation stays instant and the map
 * chunk stays warm.
 */
export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return <ConsoleShell>{children}</ConsoleShell>;
}
