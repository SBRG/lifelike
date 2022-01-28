export function getDTCompatibleLabel(label: string) {
  const match = label.match(/^Literature([a-zA-Z]+)$/);
  if (match) {
    return match[1].toLowerCase();
  }
  return label.toLowerCase();
}
