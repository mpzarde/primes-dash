import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { HttpClient } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PreferencesService } from '../services/preferences.service';
import { Preferences } from '../models/preferences.model';

@Component({
  selector: 'app-preferences',
  templateUrl: './preferences.component.html',
  styleUrls: ['./preferences.component.scss']
})
export class PreferencesComponent implements OnInit {
  preferencesForm!: FormGroup;
  selectedFile: File | null = null;
  isUploading = false;
  uploadStatus: { success: boolean; message: string } | null = null;

  constructor(
    private fb: FormBuilder,
    private preferencesService: PreferencesService,
    private dialogRef: MatDialogRef<PreferencesComponent>,
    private http: HttpClient,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadPreferences();
  }

  private initForm(): void {
    this.preferencesForm = this.fb.group({
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

  /**
   * Handle file selection
   */
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
      this.uploadStatus = null;
    }
  }

  /**
   * Clear selected file
   */
  clearSelectedFile(): void {
    this.selectedFile = null;
    this.uploadStatus = null;
  }

  /**
   * Upload the selected file
   */
  uploadFile(): void {
    if (!this.selectedFile) {
      this.snackBar.open('Please select a file first', 'Close', { duration: 3000 });
      return;
    }

    this.isUploading = true;
    this.uploadStatus = null;

    // Read the file content
    const reader = new FileReader();
    reader.onload = (e) => {
      const fileContent = e.target?.result as string;

      // Send the file to the server
      this.http.post('/pdash/api/upload', {
        fileName: this.selectedFile?.name,
        fileContent
      }).subscribe({
        next: (response: any) => {
          this.isUploading = false;
          this.uploadStatus = {
            success: true,
            message: 'File uploaded successfully'
          };
          this.snackBar.open('File uploaded successfully', 'Close', { duration: 3000 });
          this.selectedFile = null;
        },
        error: (error) => {
          this.isUploading = false;
          console.error('Error uploading file:', error);

          let errorMessage = 'Failed to upload file';
          if (error.status === 409) {
            errorMessage = `A batch log with the same name already exists`;
          } else if (error.error && error.error.message) {
            errorMessage = error.error.message;
          }

          this.uploadStatus = {
            success: false,
            message: errorMessage
          };

          this.snackBar.open(errorMessage, 'Close', { duration: 5000 });
        }
      });
    };

    reader.readAsText(this.selectedFile);
  }
}
