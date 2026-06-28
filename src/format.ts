export function displayFrequency(value?: string) {
  if (!value) {
    return "manual";
  }

  const customMatch = value.match(/^custom:(\d+)h$/);
  if (customMatch) {
    return `every ${customMatch[1]}h`;
  }

  return value;
}
