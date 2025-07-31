import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Preferences, DEFAULT_PREFERENCES } from '../models/preferences.model';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class PreferencesService {
  private readonly STORAGE_KEY = 'primes-dash-preferences';
  private preferencesSubject = new BehaviorSubject<Preferences>(DEFAULT_PREFERENCES);

  constructor(private http: HttpClient) {
    this.loadPreferences();
  }

  /**
   * Get the current preferences
   */
  getPreferences(): Observable<Preferences> {
    return this.preferencesSubject.asObservable();
  }

  /**
   * Get the current preferences value
   */
  getPreferencesValue(): Preferences {
    return this.preferencesSubject.value;
  }

  /**
   * Save preferences
   */
  savePreferences(preferences: Preferences): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(preferences));
    this.preferencesSubject.next(preferences);

    // If log directory has changed, notify the backend
    if (preferences.logDirectory !== DEFAULT_PREFERENCES.logDirectory) {
      this.updateBackendLogDirectory(preferences.logDirectory);
    }
  }

  /**
   * Load preferences from localStorage
   */
  private loadPreferences(): void {
    const storedPreferences = localStorage.getItem(this.STORAGE_KEY);
    if (storedPreferences) {
      try {
        const preferences = JSON.parse(storedPreferences);
        this.preferencesSubject.next({
          ...DEFAULT_PREFERENCES,
          ...preferences
        });
      } catch (error) {
        console.error('Error parsing stored preferences:', error);
        this.preferencesSubject.next(DEFAULT_PREFERENCES);
      }
    }
  }

  /**
   * Update the backend log directory
   */
  private updateBackendLogDirectory(logDirectory: string): void {
    this.http.post('/pdash/api/config', { logsPath: logDirectory }).subscribe({
      next: () => console.log('Backend log directory updated successfully'),
      error: (error) => console.error('Error updating backend log directory:', error)
    });
  }

  /**
   * Reset preferences to defaults
   */
  resetPreferences(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    this.preferencesSubject.next(DEFAULT_PREFERENCES);
  }
}
