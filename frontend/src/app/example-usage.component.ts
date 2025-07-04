import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { BatchService, SolutionService, JobService, JobState } from './services';
import { Batch, Solution } from './models';

@Component({
  selector: 'app-example-usage',
  template: `
    <div class="container">
      <h2>Example Usage of Services</h2>
      
      <!-- Job State -->
      <div class="section">
        <h3>Job State</h3>
        <p>Running: {{ jobState.isRunning ? 'Yes' : 'No' }}</p>
        <p>Current Range: {{ jobState.currentRange || 'None' }}</p>
        <p>Total Processed: {{ jobState.totalProcessed }}</p>
        <p>Total Found: {{ jobState.totalFound }}</p>
        <button (click)="startJob()">Start Job</button>
        <button (click)="stopJob()">Stop Job</button>
      </div>
      
      <!-- Batches -->
      <div class="section">
        <h3>Batches ({{ batches.length }})</h3>
        <ul>
          <li *ngFor="let batch of batches">
            Range: {{ batch.range }}, Status: {{ batch.status }}, Found: {{ batch.found }}
          </li>
        </ul>
      </div>
      
      <!-- Solutions -->
      <div class="section">
        <h3>Solutions ({{ solutions.length }})</h3>
        <ul>
          <li *ngFor="let solution of solutions">
            a={{ solution.a }}, b={{ solution.b }}, c={{ solution.c }}, d={{ solution.d }}
          </li>
        </ul>
      </div>
    </div>
  `,
  styles: [`
    .container { padding: 20px; }
    .section { margin-bottom: 30px; }
    button { margin-right: 10px; }
  `]
})
export class ExampleUsageComponent implements OnInit, OnDestroy {
  batches: Batch[] = [];
  solutions: Solution[] = [];
  jobState: JobState = {
    isRunning: false,
    totalProcessed: 0,
    totalFound: 0
  };
  
  private subscriptions: Subscription[] = [];

  constructor(
    private batchService: BatchService,
    private solutionService: SolutionService,
    private jobService: JobService
  ) {}

  ngOnInit() {
    // Subscribe to real-time batch updates
    this.subscriptions.push(
      this.batchService.getBatchesRealTime().subscribe(batches => {
        this.batches = batches;
      })
    );

    // Subscribe to real-time job state updates
    this.subscriptions.push(
      this.jobService.getJobStateRealTime().subscribe(state => {
        this.jobState = state;
      })
    );

    // Load initial solutions
    this.subscriptions.push(
      this.solutionService.getSolutions().subscribe(solutions => {
        this.solutions = solutions;
      })
    );
  }

  ngOnDestroy() {
    // Clean up subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  startJob() {
    this.jobService.startNextJob({ range: '1000000-2000000' }).subscribe(
      response => {
        console.log('Job started:', response);
      },
      error => {
        console.error('Error starting job:', error);
      }
    );
  }

  stopJob() {
    this.jobService.stopJob().subscribe(
      response => {
        console.log('Job stopped:', response);
      },
      error => {
        console.error('Error stopping job:', error);
      }
    );
  }
}
