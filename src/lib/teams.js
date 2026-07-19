// Specialty teams (fixed list, mirrors TopNav). `voting: true` means the team
// runs the 3-category photo poll (Raiders only for now). Flip a flag + build the
// team's poll UI to expand later — no schema change needed.
export const TEAMS = [
  { id: 'raiders',  label: 'Raiders',  accent: '#7EC87E', voting: true,  route: 'raiders', blurb: 'Cross-country rescue, rope bridge, obstacle events' },
  { id: 'rifle',    label: 'Rifle',    accent: '#C9A961', voting: false, route: 'rifle',    blurb: 'Precision air rifle marksmanship' },
  { id: 'academic', label: 'Academic', accent: '#B48FD4', voting: false, route: 'academic', blurb: 'JLAB academic bowl' },
  { id: 'drill',    label: 'Drill',    accent: '#D69B6B', voting: false, route: 'drill',    blurb: 'Armed & unarmed drill routines' },
];

export const TEAM_IDS = TEAMS.map((t) => t.id);
export const getTeam = (id) => TEAMS.find((t) => t.id === id) || null;
export const isVotingTeam = (id) => !!getTeam(id)?.voting;
