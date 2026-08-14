export type AnzscoOccupation = {
  code: string
  title: string
};

export const ANZSCO_OCCUPATIONS: AnzscoOccupation[] = [
  { code: "233911", title: "Aeronautical Engineer" },
  { code: "233912", title: "Agricultural Engineer" },
  { code: "233913", title: "Biomedical Engineer" },
  { code: "233211", title: "Civil Engineer" },
  { code: "233111", title: "Chemical Engineer" },
  { code: "233411", title: "Electronics Engineer" },
  { code: "233311", title: "Electrical Engineer" },
  { code: "233915", title: "Environmental Engineer" },
  { code: "233212", title: "Geotechnical Engineer" },
  { code: "233511", title: "Industrial Engineer" },
  { code: "233112", title: "Materials Engineer" },
  { code: "233512", title: "Mechanical Engineer" },
  { code: "233611", title: "Mining Engineer" },
  { code: "233916", title: "Naval Architect" },
  { code: "233612", title: "Petroleum Engineer" },
  { code: "233513", title: "Production or Plant Engineer" },
  { code: "233214", title: "Structural Engineer" },
  { code: "263311", title: "Telecommunications Engineer" },
  { code: "263312", title: "Telecommunications Network Engineer" },
  { code: "233215", title: "Transport Engineer" },
  { code: "233999", title: "Engineering Professional nec" },
  { code: "233914", title: "Engineering Technologist" },
  { code: "312999", title: "Building and Engineering Technicians nec" },
  { code: "312211", title: "Civil Engineering Draftsperson" },
  { code: "312311", title: "Electrical Engineering Draftsperson" },
  { code: "312411", title: "Electronic Engineering Draftsperson" },
  { code: "312511", title: "Mechanical Engineering Draftsperson" },
  { code: "313212", title: "Telecommunication Field Engineer" },
  { code: "313213", title: "Telecommunications Network Planner" },
  { code: "313214", title: "Telecommunications Technical Officer or Technologist" },
  { code: "133211", title: "Engineering Manager" },
];

const BY_CODE = new Map(ANZSCO_OCCUPATIONS.map((item) => [item.code, item]));

export function findAnzsco(value: string | undefined) {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const direct = BY_CODE.get(raw);
  if (direct) return direct;
  const code = raw.match(/\b(\d{6})\b/)?.[1];
  if (code) return BY_CODE.get(code) ?? null;
  const lower = raw.toLowerCase();
  return (
    ANZSCO_OCCUPATIONS.find((item) => item.title.toLowerCase() === lower) ?? null
  );
}

export function formatAnzsco(value: string | undefined) {
  const match = findAnzsco(value);
  if (match) return `${match.title} · ${match.code}`;
  const raw = (value ?? "").trim();
  return raw.length > 0 ? raw : "";
}

export function anzscoMatches(value: string | undefined, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const match = findAnzsco(value);
  if (!match) return (value ?? "").toLowerCase().includes(q);
  return (
    match.code.includes(q) ||
    match.title.toLowerCase().includes(q) ||
    `${match.title} ${match.code}`.toLowerCase().includes(q)
  );
}
