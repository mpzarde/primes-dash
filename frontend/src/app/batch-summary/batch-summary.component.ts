import { Component, OnInit, OnDestroy, ViewChild, AfterViewInit } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatDialog } from '@angular/material/dialog';
import { Subscription, forkJoin } from 'rxjs';
import { Batch } from '../models/batch.model';
import { Solution } from '../models/solution.model';
import { BatchService } from '../services/batch.service';
import { SolutionService } from '../services/solution.service';
import { PreferencesService } from '../services/preferences.service';
import { PreferencesComponent } from '../preferences/preferences.component';
import { MatTooltip } from '@angular/material/tooltip';

@Component({
  selector: 'app-batch-summary',
  templateUrl: './batch-summary.component.html',
  styleUrls: ['./batch-summary.component.scss']
})
export class BatchSummaryComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild('solutionsPaginator') solutionsPaginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  displayedColumns: string[] = ['range', 'timestamp', 'found', 'uniqueCubes', 'elapsed', 'checked', 'rps', 'status'];
  dataSource = new MatTableDataSource<Batch>([]);

  // Solutions table
  solutionsDisplayedColumns: string[] = ['tuple'];
  solutionsDataSource = new MatTableDataSource<Solution>([]);
  selectedBatchRange: string | null = null;

  // Map to store computed cubes and uniqueness for each solution
  solutionCubesMap: Map<string, {
    primes: number[],
    isUnique: boolean,
    duplicates: number[]
  }> = new Map();

  // Map to store unique cubes count for each batch
  batchUniqueCubesMap: Map<string, number> = new Map();

  private subscriptions: Subscription[] = [];

  constructor(
    private batchService: BatchService,
    private solutionService: SolutionService,
    private dialog: MatDialog,
    private preferencesService: PreferencesService
  ) {}

  ngOnInit(): void {
    this.subscribeToRealTimeUpdates();
    this.loadInitialSolutions();
  }

  ngAfterViewInit(): void {
    // Initialize batch table
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;

    // Custom sorting for range column to sort by numeric value
    this.dataSource.sortingDataAccessor = (item: Batch, property: string) => {
      switch(property) {
        case 'range':
          // Extract the first number from the range (e.g., "901-950" -> 901)
          const firstNumber = parseInt(item.range.split('-')[0], 10);
          return isNaN(firstNumber) ? 0 : firstNumber;
        case 'uniqueCubes':
          // Get the unique cubes count for this batch
          return this.getUniqueCubesCount(item.range);
        case 'timestamp':
          return item.timestamp;
        case 'checked':
          return item.checked;
        case 'found':
          return item.found;
        case 'elapsed':
          return item.elapsed;
        case 'rps':
          return item.rps;
        case 'status':
          return item.status;
        default:
          return '';
      }
    };

    // Initialize solutions table
    this.solutionsDataSource.paginator = this.solutionsPaginator;
    this.solutionsDataSource.sort = this.sort;
  }

  ngOnDestroy(): void {
    // Clean up all subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private subscribeToRealTimeUpdates(): void {
    const batchSubscription = this.batchService.getBatchesRealTime().subscribe({
      next: (batches: Batch[]) => {
        this.dataSource.data = batches;
        // Calculate unique cubes count for each batch
        this.calculateUniqueCubesForAllBatches();
      },
      error: (error) => {
        console.error('Error receiving real-time batch updates:', error);
      }
    });

    this.subscriptions.push(batchSubscription);
  }

  // Calculate unique cubes count for all batches
  private calculateUniqueCubesForAllBatches(): void {
    // Get all batches
    const batches = this.dataSource.data;

    // For each batch, calculate the unique cubes count
    batches.forEach(batch => {
      this.calculateUniqueCubesForBatch(batch.range);
    });
  }

  // Calculate unique cubes count for a specific batch
  private calculateUniqueCubesForBatch(batchRange: string): void {
    // Check if we already have the count for this batch
    if (this.batchUniqueCubesMap.has(batchRange)) {
      return;
    }

    // Fetch solutions for this batch
    const solutionSubscription = this.solutionService.getSolutionsByBatchRange(batchRange).subscribe({
      next: (solutions: Solution[]) => {
        // Count solutions with unique primes in their cubes
        let uniqueCubesCount = 0;

        solutions.forEach(solution => {
          const cubeData = this.getSolutionCubeData(solution);
          if (cubeData.isUnique) {
            uniqueCubesCount++;
          }
        });

        // Store the count in the map
        this.batchUniqueCubesMap.set(batchRange, uniqueCubesCount);

        // Refresh the view to show the updated count
        this.dataSource.data = [...this.dataSource.data];
      },
      error: (error) => {
        console.error(`Error calculating unique cubes for batch range ${batchRange}:`, error);
        // Set count to 0 in case of error
        this.batchUniqueCubesMap.set(batchRange, 0);
      }
    });

    this.subscriptions.push(solutionSubscription);
  }

  // Get the unique cubes count for a batch
  getUniqueCubesCount(batchRange: string): number {
    // If we don't have the count yet, calculate it
    if (!this.batchUniqueCubesMap.has(batchRange)) {
      this.calculateUniqueCubesForBatch(batchRange);
      return 0; // Return 0 while calculating
    }

    return this.batchUniqueCubesMap.get(batchRange) || 0;
  }

  private loadInitialSolutions(): void {
    // Initialize with empty solutions data since we only want to show solutions
    // for selected rows
    this.solutionsDataSource.data = [];
  }

  loadSolutionsByBatchRange(batchRange: string): void {
    this.selectedBatchRange = batchRange;

    const solutionSubscription = this.solutionService.getSolutionsByBatchRange(batchRange).subscribe({
      next: (solutions: Solution[]) => {
        this.solutionsDataSource.data = solutions;
      },
      error: (error) => {
        console.error(`Error loading solutions for batch range ${batchRange}:`, error);
      }
    });

    this.subscriptions.push(solutionSubscription);
  }


  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);

    try {
      // Format without timezone information
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return date.toLocaleString();
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'completed':
        return 'primary';
      case 'in-progress':
        return 'accent';
      default:
        return 'warn';
    }
  }

  onBatchRowClick(batch: Batch): void {
    if (batch && batch.range) {
      // If clicking the same row that's already selected, deselect it
      if (this.selectedBatchRange === batch.range) {
        this.selectedBatchRange = null;
        this.solutionsDataSource.data = [];
      } else {
        // Otherwise, select the row and load its solutions
        this.loadSolutionsByBatchRange(batch.range);
      }
    }
  }

  clearSelectedBatch(): void {
    this.selectedBatchRange = null;
    this.solutionsDataSource.data = [];
  }

  formatSolutionValues(value: number): string {
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  formatCheckRate(value: number): string {
    if (value === 0) return '0.00/s';

    const absValue = Math.abs(value);
    let suffix = '';
    let formattedValue = value;

    if (absValue >= 1_000_000_000) {
      formattedValue = value / 1_000_000_000;
      suffix = 'B';
    } else if (absValue >= 1_000_000) {
      formattedValue = value / 1_000_000;
      suffix = 'M';
    } else if (absValue >= 1_000) {
      formattedValue = value / 1_000;
      suffix = 'K';
    }

    // Format to 2 decimal places
    return `${formattedValue.toFixed(2)}${suffix}/s`;
  }

  formatChecked(value: number): string {
    if (value === 0) return '0';

    const absValue = Math.abs(value);
    let suffix = '';
    let formattedValue = value;

    if (absValue >= 1_000_000_000_000) {
      formattedValue = value / 1_000_000_000_000;
      suffix = 'T';
    } else if (absValue >= 1_000_000_000) {
      formattedValue = value / 1_000_000_000;
      suffix = 'B';
    } else if (absValue >= 1_000_000) {
      formattedValue = value / 1_000_000;
      suffix = 'M';
    } else if (absValue >= 1_000) {
      formattedValue = value / 1_000;
      suffix = 'K';
    }

    // Format as integer (no decimal places)
    return `${Math.round(formattedValue)}${suffix}`;
  }

  formatElapsedTime(milliseconds: number): string {
    // Convert milliseconds to hours, minutes, and seconds
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    // Format as HH:MM:SS
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  // Check if a number is prime
  isPrime(num: number): boolean {
    if (num <= 1) return false;
    if (num <= 3) return true;
    if (num % 2 === 0 || num % 3 === 0) return false;

    let i = 5;
    while (i * i <= num) {
      if (num % i === 0 || num % (i + 2) === 0) return false;
      i += 6;
    }
    return true;
  }

  // Compute the value of a + b*i + c*j + d*k for given i, j, k
  computeValue(a: number, b: number, c: number, d: number, i: number, j: number, k: number): number {
    return a + b * i + c * j + d * k;
  }

  // Compute all 27 values in the 3x3x3 cube for a given solution
  computeCube(solution: Solution): { primes: number[], isUnique: boolean, duplicates: number[] } {
    // Extract parameters from parameterCombination or use defaults
    const a = solution.parameterCombination?.a || 0;
    const b = solution.parameterCombination?.b || 0;
    const c = solution.parameterCombination?.c || 0;
    const d = solution.parameterCombination?.d || 0;
    const primes: number[] = [];

    // Compute all 27 values in the cube
    for (let i = 0; i <= 2; i++) {
      for (let j = 0; j <= 2; j++) {
        for (let k = 0; k <= 2; k++) {
          const value = this.computeValue(a, b, c, d, i, j, k);
          // Verify that the value is prime (it should be, based on the problem description)
          if (this.isPrime(value)) {
            primes.push(value);
          } else {
            console.warn(`Non-prime value ${value} found in cube for solution (${a}, ${b}, ${c}, ${d}) at i=${i}, j=${j}, k=${k}`);
          }
        }
      }
    }

    // Check if all primes in the cube are unique
    const uniquePrimes = new Set(primes);
    const isUnique = uniquePrimes.size === primes.length;

    // Find duplicates if any
    const duplicates: number[] = [];
    if (!isUnique) {
      const counts = new Map<number, number>();
      primes.forEach(prime => {
        counts.set(prime, (counts.get(prime) || 0) + 1);
      });

      counts.forEach((count, prime) => {
        if (count > 1) {
          duplicates.push(prime);
        }
      });
    }

    return { primes, isUnique, duplicates };
  }

  // Get the cube data for a solution, computing it if not already cached
  getSolutionCubeData(solution: Solution): { primes: number[], isUnique: boolean, duplicates: number[] } {
    // Extract parameters from parameterCombination or use defaults
    const a = solution.parameterCombination?.a || 0;
    const b = solution.parameterCombination?.b || 0;
    const c = solution.parameterCombination?.c || 0;
    const d = solution.parameterCombination?.d || 0;
    const solutionKey = `${a},${b},${c},${d}`;

    if (!this.solutionCubesMap.has(solutionKey)) {
      const cubeData = this.computeCube(solution);
      this.solutionCubesMap.set(solutionKey, cubeData);
    }

    return this.solutionCubesMap.get(solutionKey)!;
  }

  // Get tooltip text for a solution showing duplicated primes
  getSolutionTooltip(solution: Solution): string {
    const cubeData = this.getSolutionCubeData(solution);

    if (cubeData.isUnique) {
      return 'All 27 primes in this cube are unique!';
    } else {
      return `Duplicated primes in this cube: ${cubeData.duplicates.join(', ')}`;
    }
  }

  /**
   * Download solutions as CSV
   * Uses the SolutionService to download solutions as CSV
   * If a batch is selected, only downloads solutions for that batch
   */
  downloadSolutionsAsCsv(): void {
    // If a batch is selected, download only solutions for that batch
    // Otherwise, download all solutions
    this.solutionService.downloadSolutionsAsCsv(this.selectedBatchRange || undefined);
  }


  openPreferences(): void {
    const dialogRef = this.dialog.open(PreferencesComponent, {
      width: '500px',
      disableClose: false
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // Refresh the view to apply new preferences
        this.dataSource.data = [...this.dataSource.data];
        this.solutionsDataSource.data = [...this.solutionsDataSource.data];
      }
    });
  }
}
