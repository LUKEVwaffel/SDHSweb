export function requiresPinSetup(member, directory) {
  if (!member || member.is_s6 || !['co','xo','1sg'].includes(member.board_role)) return false;
  return directory.some((seat) => seat.company === member.company && seat.board_role === member.board_role && seat.needs_setup);
}
