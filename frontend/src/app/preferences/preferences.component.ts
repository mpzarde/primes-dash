import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { PreferencesService } from '../services/preferences.service';
import { Preferences } from '../models/preferences.model';

@Component({
  selector: 'app-preferences',
  templateUrl: './preferences.component.html',
  styleUrls: ['./preferences.component.scss']
})
export class PreferencesComponent implements OnInit {
  preferencesForm!: FormGroup;
  timezones: string[] = [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Phoenix',
    'America/Anchorage',
    'America/Honolulu',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Australia/Sydney'
  ];

  constructor(
    private fb: FormBuilder,
    private preferencesService: PreferencesService,
    private dialogRef: MatDialogRef<PreferencesComponent>
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadPreferences();
  }

  private initForm(): void {
    this.preferencesForm = this.fb.group({
      timezone: ['America/Denver', Validators.required],
      logDirectory: ['', Validators.required]
    });
  }

  private loadPreferences(): void {
    const preferences = this.preferencesService.getPreferencesValue();
    this.preferencesForm.patchValue(preferences);
  }

  onSubmit(): void {
    if (this.preferencesForm.valid) {
      const preferences: Preferences = this.preferencesForm.value;
      this.preferencesService.savePreferences(preferences);
      this.dialogRef.close(preferences);
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onReset(): void {
    this.preferencesService.resetPreferences();
    this.loadPreferences();
  }
}
