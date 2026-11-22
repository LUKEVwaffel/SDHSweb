export const REMINDER_TIMEZONE = "America/New_York";
/** Resolve a local calendar time without asking the model to guess UTC/DST offsets.
 * @param {string} local @param {string} [timezone] @param {string} [utcOffset]
 */
export function resolveReminderTime(
  local,
  timezone = REMINDER_TIMEZONE,
  utcOffset = undefined,
) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!match) {
    throw new Error("Use a local date and time in YYYY-MM-DDTHH:mm format");
  }
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute);
  if (year < 2000 || new Date(target).toISOString().slice(0, 16) !== local) {
    throw new Error("Use a valid calendar date and time");
  }
  let format;
  try {
    format = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
  } catch {
    throw new Error("Use a valid IANA timezone such as America/New_York");
  }
  const wall = (ms) => {
    const parts = Object.fromEntries(
      format.formatToParts(new Date(ms)).map((p) => [p.type, p.value]),
    );
    return Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
  };
  const offsets = new Set();
  for (let h = -36; h <= 36; h += 6) {
    const ms = target + h * 3600000;
    offsets.add(wall(ms) - ms);
  }
  const candidates = [...offsets].map((offset) => target - offset).filter(
    (ms) => wall(ms) === target,
  ).sort((a, b) => a - b);
  if (!candidates.length) {
    throw new Error(
      "That local time does not exist because of daylight saving time. Choose another time.",
    );
  }
  let choices = candidates;
  if (utcOffset) {
    if (!/^[+-]\d{2}:\d{2}$/.test(utcOffset)) {
      throw new Error("UTC offset must look like -04:00");
    }
    const sign = utcOffset[0] === "-" ? -1 : 1;
    const [h, m] = utcOffset.slice(1).split(":").map(Number);
    if (h > 23 || m > 59) throw new Error("Invalid UTC offset");
    const offset = sign * (h * 60 + m) * 60000;
    choices = candidates.filter((ms) => target - ms === offset);
  }
  if (!choices.length) {
    throw new Error(
      "The supplied UTC offset does not match this local time and timezone",
    );
  }
  if (choices.length > 1) {
    throw new Error(
      "That local time happens twice because of daylight saving time. Ask whether the earlier or later occurrence is intended, then supply its UTC offset.",
    );
  }
  return {
    due_at: new Date(choices[0]).toISOString(),
    timezone,
    local_time: local,
    display: new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      dateStyle: "full",
      timeStyle: "short",
    }).format(new Date(choices[0])),
  };
}
