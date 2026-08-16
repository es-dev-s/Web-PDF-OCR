export const TEAMS = [
  "Ace Performers",
  "Alpha Winners",
  "Conversion Queens",
  "Deal Avengers",
  "Elite Closers",
  "Fortune Finders",
  "Growth Gladiators",
  "KPI Krusher's",
  "Limit Breakers",
  "Magic Makers",
  "Mountain Movers",
  "Nitro Negotiators",
  "Orbit",
  "Peak Achievers",
  "Queen",
  "Success Sharks",
  "Summit Seekers",
  "Sydney",
  "Target Titans",
  "Trend Setters",
  "Victoria",
  "Victory Magnets",
] as const;

export type TeamName = (typeof TEAMS)[number];

const BY_NAME = new Map(TEAMS.map((name) => [name.toLowerCase(), name]));

export function findTeam(value: string | undefined): TeamName | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  return BY_NAME.get(raw.toLowerCase()) ?? null;
}

export function filterTeams(query: string): readonly string[] {
  const q = query.trim().toLowerCase();
  if (!q) return TEAMS;
  return TEAMS.filter((name) => name.toLowerCase().includes(q));
}
