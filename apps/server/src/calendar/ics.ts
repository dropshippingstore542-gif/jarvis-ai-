import type { CalendarEvent } from "@jarvis/core";

/**
 * Real RFC 5545 (iCalendar) generation — no external service, no OAuth.
 * The feed this produces (see routes/calendar.ts) is something a real
 * calendar app can subscribe to directly, which is genuine interoperability
 * without needing a Google/Outlook OAuth integration.
 */
function toIcsDate(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** RFC 5545 requires folding lines longer than 75 octets, continuation lines start with a space. */
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) {
    chunks.push(" " + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  if (rest.length > 0) chunks.push(" " + rest);
  return chunks.join("\r\n");
}

export function generateIcsCalendar(events: CalendarEvent[]): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Jarvis//Personal Assistant//EN",
    "CALSCALE:GREGORIAN",
  ];

  for (const event of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(foldLine(`UID:${event.id}@jarvis`));
    lines.push(foldLine(`DTSTAMP:${toIcsDate(event.updatedAt)}`));
    lines.push(foldLine(`DTSTART:${toIcsDate(event.startAt)}`));
    lines.push(foldLine(`DTEND:${toIcsDate(event.endAt)}`));
    lines.push(foldLine(`SUMMARY:${escapeIcsText(event.title)}`));
    if (event.description) lines.push(foldLine(`DESCRIPTION:${escapeIcsText(event.description)}`));
    if (event.location) lines.push(foldLine(`LOCATION:${escapeIcsText(event.location)}`));
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
