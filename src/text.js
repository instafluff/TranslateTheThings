// Translation chunking preserves paragraph boundaries where possible.
// Each part is translated independently to avoid overflowing model context on long input.
export const MAX_CHARACTERS = 4000;
export const CHUNK_TARGET = 1050;

export function chunkText(text, limit = CHUNK_TARGET) {
  if (!text.trim()) return [];
  if (text.length <= limit) return [text.trim()];
  const paragraphs = text.trim().split(/\n\s*\n/);
  const parts = [];
  for (const paragraph of paragraphs) {
    const lines = paragraph.split(/(?<=[.!?。！？])\s+(?=\S)/u);
    let section = '';
    for (const line of lines) {
      if (line.length > limit) {
        if (section) { parts.push(section); section = ''; }
        for (let i = 0; i < line.length; i += limit) parts.push(line.slice(i, i + limit));
      } else if (!section) {
        section = line;
      } else if (section.length + 1 + line.length <= limit) {
        section += ' ' + line;
      } else {
        parts.push(section);
        section = line;
      }
    }
    if (section) parts.push(section);
  }
  return parts.filter(Boolean);
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1000) return Math.round(bytes) + ' B';
  const units = ['KB', 'MB', 'GB', 'TB'];
  let num = bytes;
  let index = -1;
  do { num /= 1000; index += 1; } while (num >= 1000 && index < units.length - 1);
  return (num >= 10 ? num.toFixed(1) : num.toFixed(2)) + ' ' + units[index];
}
