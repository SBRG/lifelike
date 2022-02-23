import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';

import { EMPTY, Subject } from 'rxjs';
import { catchError, exhaust, map } from 'rxjs/operators';

import { CopyrightInfringementRequest } from 'app/interfaces/reports.interface';
import { COUNTRY_NAME_LIST } from 'app/shared/constants';

import { ReportsService } from '../services/reports.service';

@Component({
  selector: 'app-copyright-infringement-form',
  templateUrl: './copyright-infringement-form.component.html',
})
export class CopyrightInfringementFormComponent implements OnInit, OnDestroy {
  DESCRIPTION_MAX_LEN = 1000;
  COUNTRY_LIST = COUNTRY_NAME_LIST;

  form: FormGroup;
  submitEvent: Subject<boolean>;

  constructor(
    private reportsService: ReportsService,
    private router: Router,
    private readonly snackBar: MatSnackBar,
  ) { }

  ngOnInit(): void {
    this.form = new FormGroup({
      url: new FormControl('', Validators.required),
      description: new FormControl('', [Validators.required, Validators.maxLength(this.DESCRIPTION_MAX_LEN)]),
      name: new FormControl('', Validators.required),
      company: new FormControl('', Validators.required),
      address: new FormControl('', Validators.required),
      country: new FormControl('', Validators.required),
      city: new FormControl('', Validators.required),
      province: new FormControl('', Validators.required),
      zip: new FormControl('', Validators.required),
      phone: new FormControl('', Validators.required),
      fax: new FormControl(),
      email: new FormControl('', [Validators.required, Validators.email]),
      attestationCheck1: new FormControl('', Validators.required),
      attestationCheck2: new FormControl('', Validators.required),
      attestationCheck3: new FormControl('', Validators.required),
      attestationCheck4: new FormControl('', Validators.required),
      signature: new FormControl('', Validators.required),
    });

    this.submitEvent = new Subject();
    this.submitEvent.pipe(
      map(() =>
      this.reportsService.copyrightInfringementRequest({...this.form.value} as CopyrightInfringementRequest)
      .pipe(
        catchError(() => {
          this.snackBar.open(
            'An error occurred while submitting your request. Please review the form for invalid inputs and try again in a moment.',
            'close',
            {duration: 5000},
          );
          return EMPTY;
        }))
      )
    ).pipe(exhaust()).subscribe(() => {
      this.snackBar.open(
        'Your request has been submitted. The Lifelike team will review your claim and you will be contacted shortly.',
        'close'
      );
      this.router.navigateByUrl('/workspaces/local');
    });
  }

  ngOnDestroy(): void {
      this.submitEvent.complete();
  }

  markAllAsDirty() {
    for (const control of Object.keys(this.form.controls)) {
      this.form.get(control).markAsDirty();
    }
  }

  submit() {
    this.markAllAsDirty();

    if (this.form.valid) {
      this.submitEvent.next(true);
    }
  }
}
