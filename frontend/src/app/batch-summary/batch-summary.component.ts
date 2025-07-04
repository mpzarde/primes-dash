import { Component, OnInit, OnDestroy, ViewChild, AfterViewInit, ElementRef } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { Subscription } from 'rxjs';
import { Chart, ChartConfiguration, ChartType, registerables } from 'chart.js';
import { Batch } from '../models/batch.model';
import { BatchService } from '../services/batch.service';

@Component({
  selector: 'app-batch-summary',
  templateUrl: './batch-summary.component.html',
  styleUrls: ['./batch-summary.component.scss']
})
export class BatchSummaryComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild('chartCanvas', { static: false }) chartCanvas!: ElementRef<HTMLCanvasElement>;
  
  displayedColumns: string[] = ['range', 'timestamp', 'checked', 'found', 'elapsed', 'rps', 'status'];
  dataSource = new MatTableDataSource<Batch>([]);
  
  private subscription?: Subscription;
  private chart?: Chart;
  
  constructor(private batchService: BatchService) {
    Chart.register(...registerables);
  }
  
  ngOnInit(): void {
    this.subscribeToRealTimeUpdates();
  }
  
  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    
    // Initialize chart after view is ready
    setTimeout(() => {
      this.initializeChart();
    });
  }
  
  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    if (this.chart) {
      this.chart.destroy();
    }
  }
  
  private subscribeToRealTimeUpdates(): void {
    this.subscription = this.batchService.getBatchesRealTime().subscribe({
      next: (batches: Batch[]) => {
        this.dataSource.data = batches;
        this.updateChart(batches);
      },
      error: (error) => {
        console.error('Error receiving real-time batch updates:', error);
      }
    });
  }
  
  private initializeChart(): void {
    if (!this.chartCanvas) {
      return;
    }
    
    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) {
      return;
    }
    
    const config: ChartConfiguration = {
      type: 'line' as ChartType,
      data: {
        labels: [],
        datasets: [
          {
            label: 'Throughput (RPS)',
            data: [],
            borderColor: '#1976d2',
            backgroundColor: 'rgba(25, 118, 210, 0.1)',
            tension: 0.4,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Throughput Over Time'
          },
          legend: {
            display: true,
            position: 'top'
          }
        },
        scales: {
          x: {
            display: true,
            title: {
              display: true,
              text: 'Time'
            }
          },
          y: {
            display: true,
            title: {
              display: true,
              text: 'Requests per Second (RPS)'
            },
            beginAtZero: true
          }
        },
        elements: {
          point: {
            radius: 4,
            hoverRadius: 6
          }
        }
      }
    };
    
    this.chart = new Chart(ctx, config);
  }
  
  private updateChart(batches: Batch[]): void {
    if (!this.chart || !batches.length) {
      return;
    }
    
    // Sort batches by timestamp to ensure proper order
    const sortedBatches = [...batches].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    // Limit to last 20 batches for better visualization
    const recentBatches = sortedBatches.slice(-20);
    
    const labels = recentBatches.map(batch => {
      const date = new Date(batch.timestamp);
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
      });
    });
    
    const rpsData = recentBatches.map(batch => batch.rps);
    
    this.chart.data.labels = labels;
    this.chart.data.datasets[0].data = rpsData;
    this.chart.update('none'); // Use 'none' for better performance
  }
  
  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();
    
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }
  
  formatTimestamp(timestamp: string): string {
    return new Date(timestamp).toLocaleString();
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
}
