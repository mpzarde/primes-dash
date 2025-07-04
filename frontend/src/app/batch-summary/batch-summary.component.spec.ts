import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BatchSummaryComponent } from './batch-summary.component';

describe('BatchSummaryComponent', () => {
  let component: BatchSummaryComponent;
  let fixture: ComponentFixture<BatchSummaryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ BatchSummaryComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BatchSummaryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
