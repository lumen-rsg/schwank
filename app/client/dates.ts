export function dateKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function recentDates(count: number) {
  const dates: Date[] = [];
  const current = new Date();
  current.setHours(12, 0, 0, 0);
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = new Date(current);
    date.setDate(current.getDate() - offset);
    dates.push(date);
  }
  return dates;
}
