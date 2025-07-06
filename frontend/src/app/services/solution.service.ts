import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { Solution } from '../models';

@Injectable({
  providedIn: 'root'
})
export class SolutionService {
  private readonly API_URL = '/api/solutions';
  private solutionsCache = new BehaviorSubject<Solution[]>([]);

  constructor(private http: HttpClient) {}

  /**
   * Get all solutions from the API
   */
  getSolutions(): Observable<Solution[]> {
    return this.http.get<any>(this.API_URL).pipe(
      map(response => {
        if (response.success && response.data) {
          return response.data;
        }
        return [];
      }),
      tap(solutions => this.solutionsCache.next(solutions)),
      catchError(error => {
        console.error('Error fetching solutions:', error);
        return [];
      })
    );
  }

  /**
   * Get solutions by batch range
   */
  getSolutionsByBatchRange(batchRange: string): Observable<Solution[]> {
    const params = new HttpParams().set('batchRange', batchRange);
    return this.http.get<any>(this.API_URL, { params }).pipe(
      map(response => {
        if (response.success && response.data) {
          return response.data;
        }
        return [];
      }),
      catchError(error => {
        console.error('Error fetching solutions by batch range:', error);
        return [];
      })
    );
  }

  /**
   * Get a specific solution by ID
   */
  getSolution(id: string): Observable<Solution> {
    return this.http.get<Solution>(`${this.API_URL}/${id}`).pipe(
      catchError(error => {
        console.error('Error fetching solution:', error);
        throw error;
      })
    );
  }

  /**
   * Get cached solutions
   */
  getCachedSolutions(): Observable<Solution[]> {
    return this.solutionsCache.asObservable();
  }

  /**
   * Add a new solution
   */
  addSolution(solution: Solution): Observable<Solution> {
    return this.http.post<Solution>(this.API_URL, solution).pipe(
      tap(newSolution => {
        const currentSolutions = this.solutionsCache.value;
        this.solutionsCache.next([...currentSolutions, newSolution]);
      }),
      catchError(error => {
        console.error('Error adding solution:', error);
        throw error;
      })
    );
  }

  /**
   * Update an existing solution
   */
  updateSolution(id: string, solution: Partial<Solution>): Observable<Solution> {
    return this.http.put<Solution>(`${this.API_URL}/${id}`, solution).pipe(
      tap(updatedSolution => {
        const currentSolutions = this.solutionsCache.value;
        const index = currentSolutions.findIndex(s => s.a === updatedSolution.a && s.b === updatedSolution.b);
        if (index !== -1) {
          currentSolutions[index] = updatedSolution;
          this.solutionsCache.next([...currentSolutions]);
        }
      }),
      catchError(error => {
        console.error('Error updating solution:', error);
        throw error;
      })
    );
  }

  /**
   * Delete a solution
   */
  deleteSolution(id: string): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/${id}`).pipe(
      tap(() => {
        const currentSolutions = this.solutionsCache.value;
        const filteredSolutions = currentSolutions.filter(s => `${s.a}-${s.b}` !== id);
        this.solutionsCache.next(filteredSolutions);
      }),
      catchError(error => {
        console.error('Error deleting solution:', error);
        throw error;
      })
    );
  }

  /**
   * Clear the solutions cache
   */
  clearCache(): void {
    this.solutionsCache.next([]);
  }

  /**
   * Download solutions as CSV
   * @param batchRange Optional batch range to filter solutions
   */
  downloadSolutionsAsCsv(batchRange?: string): void {
    let url = `${this.API_URL}/csv`;

    // Add batchRange parameter if provided
    if (batchRange) {
      url += `?batchRange=${encodeURIComponent(batchRange)}`;
    }

    // Trigger download by opening the URL in a new window/tab
    window.open(url, '_blank');
  }
}
