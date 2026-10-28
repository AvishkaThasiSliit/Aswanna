/**
 * Formatting utilities for currency, percentages, dates, and feature labels.
 */

export function formatLKR(n: number): string {
  if (n === null || n === undefined || isNaN(n)) return 'Rs 0';
  return `Rs ${Math.round(n).toLocaleString('en-US')}`;
}

export function formatPct(n: number): string {
  if (n === null || n === undefined || isNaN(n)) return '0.0%';
  return `${n.toFixed(1)}%`;
}

export function humanizeFeature(name: string): string {
  switch (name) {
    case 'Prev_Season_Total_Cost_Incl_Imputed':
    case 'Prev_Season_Cost':
      return 'Prior season cost';
    case 'USD_LKR_Rate':
      return 'LKR/USD rate';
    case 'Year_Start':
      return 'Calendar year';
    case 'Crop':
      return 'Crop type';
    case 'District':
      return 'District / Region';
    case 'Irrigation_Type':
      return 'Water regime';
    case 'Season':
      return 'Cultivation season';
    default:
      return name.replace(/_/g, ' ');
  }
}

export function formatUptime(seconds: number): string {
  if (!seconds || seconds <= 0) return '0s';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

export function formatDateTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch {
    return isoString;
  }
}

export function getNextSeasonLabel(): string {
  try {
    const now = new Date();
    const month = now.getMonth(); // 0 = Jan, 3 = Apr, 8 = Sept
    const year = now.getFullYear();
    if (month < 3) {
      return `Yala ${year}`;
    } else if (month >= 8) {
      return `Maha ${year}/${(year + 1).toString().slice(2)}`;
    } else {
      return `Yala ${year}`;
    }
  } catch {
    return 'Next available season';
  }
}

