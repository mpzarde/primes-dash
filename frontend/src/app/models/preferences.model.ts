export interface Preferences {
  timezone: string;
  logDirectory: string;
}

export const DEFAULT_PREFERENCES: Preferences = {
  timezone: 'America/Denver',
  logDirectory: '/Users/mpzarde/projects/prime-cubes/logs'
};
