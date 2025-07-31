import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, timer } from 'rxjs';
import { map, catchError, switchMap, tap } from 'rxjs/operators';

export interface JobState {
  isRunning: boolean;
  currentRange?: string;
  totalProcessed: number;
  totalFound: number;
  startTime?: string;
  estimatedTimeRemaining?: number;
  progress?: number;
}

export interface NextJobRequest {
  range: string;
  batchSize?: number;
}

export interface NextJobResponse {
  success: boolean;
  message: string;
  jobId?: string;
  range?: string;
}

@Injectable({
  providedIn: 'root'
})
export class JobService {
  private readonly STATE_API_URL = '/pdash/api/state';
  private readonly JOB_API_URL = '/pdash/api/job/next';
  private jobStateSubject = new BehaviorSubject<JobState>({
    isRunning: false,
    totalProcessed: 0,
    totalFound: 0
  });
  private pollingInterval = 2000; // 2 seconds for job state updates

  constructor(private http: HttpClient) {
    this.startStatePolling();
  }

  /**
   * Get current job state from the API
   */
  getJobState(): Observable<JobState> {
    return this.http.get<JobState>(this.STATE_API_URL).pipe(
      catchError(error => {
        console.error('Error fetching job state:', error);
        return [{
          isRunning: false,
          totalProcessed: 0,
          totalFound: 0
        }];
      })
    );
  }

  /**
   * Get real-time job state updates
   */
  getJobStateRealTime(): Observable<JobState> {
    return this.jobStateSubject.asObservable();
  }

  /**
   * Start a new job with the specified range
   */
  startNextJob(request: NextJobRequest): Observable<NextJobResponse> {
    return this.http.post<NextJobResponse>(this.JOB_API_URL, request).pipe(
      tap(response => {
        if (response.success) {
          // Update the job state to reflect the new job
          const currentState = this.jobStateSubject.value;
          this.jobStateSubject.next({
            ...currentState,
            isRunning: true,
            currentRange: response.range,
            startTime: new Date().toISOString()
          });
        }
      }),
      catchError(error => {
        console.error('Error starting next job:', error);
        throw error;
      })
    );
  }

  /**
   * Stop the current job
   */
  stopJob(): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.JOB_API_URL}/stop`, {}).pipe(
      tap(response => {
        if (response.success) {
          const currentState = this.jobStateSubject.value;
          this.jobStateSubject.next({
            ...currentState,
            isRunning: false,
            currentRange: undefined
          });
        }
      }),
      catchError(error => {
        console.error('Error stopping job:', error);
        throw error;
      })
    );
  }

  /**
   * Get job status (alternative endpoint)
   */
  getJobStatus(): Observable<{ status: string; details?: any }> {
    return this.http.get<{ status: string; details?: any }>(`${this.JOB_API_URL}/status`).pipe(
      catchError(error => {
        console.error('Error fetching job status:', error);
        return [{ status: 'unknown' }];
      })
    );
  }

  /**
   * Start polling for job state updates
   */
  private startStatePolling(): void {
    timer(0, this.pollingInterval).pipe(
      switchMap(() => this.getJobState())
    ).subscribe(state => {
      this.jobStateSubject.next(state);
    });
  }

  /**
   * Update polling interval for job state
   */
  setPollingInterval(interval: number): void {
    this.pollingInterval = interval;
  }

  /**
   * Get the current cached job state
   */
  getCurrentJobState(): JobState {
    return this.jobStateSubject.value;
  }

  /**
   * Check if a job is currently running
   */
  isJobRunning(): boolean {
    return this.jobStateSubject.value.isRunning;
  }

  /**
   * Reset job state (useful for cleanup)
   */
  resetJobState(): void {
    this.jobStateSubject.next({
      isRunning: false,
      totalProcessed: 0,
      totalFound: 0
    });
  }

  /**
   * Stop polling (useful for cleanup)
   */
  stopPolling(): void {
    this.jobStateSubject.complete();
  }
}
