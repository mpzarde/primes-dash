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

@Component({
  selector: 'app-batch-summary',
  templateUrl: './batch-summary.component.html',
  styleUrls: ['./batch-summary.component.scss']
})
export class BatchSummaryComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild('solutionsPaginator') solutionsPaginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  displayedColumns: string[] = ['range', 'timestamp', 'checked', 'found', 'elapsed', 'rps', 'status'];
  dataSource = new MatTableDataSource<Batch>([]);

  // Solutions table
  solutionsDisplayedColumns: string[] = ['tuple'];
  solutionsDataSource = new MatTableDataSource<Solution>([]);
  selectedBatchRange: string | null = null;

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
      },
      error: (error) => {
        console.error('Error receiving real-time batch updates:', error);
      }
    });

    this.subscriptions.push(batchSubscription);
  }

  private loadInitialSolutions(): void {
    const solutionSubscription = this.solutionService.getSolutions().subscribe({
      next: (solutions: Solution[]) => {
        this.solutionsDataSource.data = solutions;
      },
      error: (error) => {
        console.error('Error loading solutions:', error);
      }
    });

    this.subscriptions.push(solutionSubscription);
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
    const preferences = this.preferencesService.getPreferencesValue();

    try {
      return date.toLocaleString('en-US', {
        timeZone: preferences.timezone,
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
    } catch (error) {
      console.error('Error formatting timestamp with timezone:', error);
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
      this.loadSolutionsByBatchRange(batch.range);
    }
  }

  clearSelectedBatch(): void {
    this.selectedBatchRange = null;
    this.loadInitialSolutions();
  }

  formatSolutionValues(value: number): string {
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
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
