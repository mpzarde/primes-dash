import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, timer, of } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { Batch } from '../models';

@Injectable({
  providedIn: 'root'
})
export class BatchService {
  private readonly API_URL = '/pdash/api/batches';
  private batchesSubject = new BehaviorSubject<Batch[]>([]);
  private pollingInterval = 5000; // 5 seconds

  constructor(private http: HttpClient) {
    this.startPolling();
  }

  /**
   * Get all batches from the API
   */
  getBatches(): Observable<Batch[]> {
    return this.http.get<any>(this.API_URL).pipe(
      map(response => {
        if (response.success && response.data) {
          return response.data.map((item: any) => this.transformBatchData(item));
        }
        return [];
      }),
      catchError(error => {
        console.error('Error fetching batches:', error);
        return of([]);
      })
    );
  }

  /**
   * Transform backend data to frontend Batch model
   */
  private transformBatchData(backendData: any): Batch {
    return {
      range: backendData.parameters?.aRange || backendData.id.split('_')[1] || 'Unknown',
      timestamp: backendData.timestamp,
      checked: backendData.parameters?.checked || 0,
      found: backendData.parameters?.found || 0,
      elapsed: backendData.duration * 1000, // Convert seconds to milliseconds
      rps: backendData.parameters?.rps || 0,
      status: backendData.status === 'completed' ? 'completed' : 'in-progress'
    };
  }

  /**
   * Get a specific batch by ID
   */
  getBatch(id: string): Observable<Batch> {
    return this.http.get<Batch>(`${this.API_URL}/${id}`).pipe(
      catchError(error => {
        console.error('Error fetching batch:', error);
        throw error;
      })
    );
  }

  /**
   * Get real-time updates for batches
   */
  getBatchesRealTime(): Observable<Batch[]> {
    return this.batchesSubject.asObservable();
  }

  /**
   * Start polling for batch updates
   */
  private startPolling(): void {
    timer(0, this.pollingInterval).pipe(
      switchMap(() => this.getBatches())
    ).subscribe(batches => {
      this.batchesSubject.next(batches);
    });
  }

  /**
   * Update polling interval
   */
  setPollingInterval(interval: number): void {
    this.pollingInterval = interval;
  }

  /**
   * Stop polling (useful for cleanup)
   */
  stopPolling(): void {
    this.batchesSubject.complete();
  }
}
