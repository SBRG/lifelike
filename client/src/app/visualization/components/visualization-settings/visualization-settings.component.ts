import { Component, OnInit, Output, EventEmitter, Input } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

import { Subscription } from 'rxjs';

import { SettingsFormValues, SettingsFormControl } from 'app/interfaces';
import { DEFAULT_CLUSTER_ROWS } from 'app/shared/constants';
import { uuidv4 } from 'app/shared/utils';

@Component({
  selector: 'app-visualization-settings',
  templateUrl: './visualization-settings.component.html',
  styleUrls: ['./visualization-settings.component.scss']
})
export class VisualizationSettingsComponent implements OnInit {
    @Input() legendLabels: string[];

    @Output() settingsFormChanges: EventEmitter<SettingsFormValues>;
    @Output() fitClickEvent: EventEmitter<any> = new EventEmitter();

    settingsForm: FormGroup;
    settingsFormValueChangesSub: Subscription;

    navbarCollapsed: boolean;

    uniqueId: string;
    animationToggleInputId: string;
    maxClusterRowsInputId: string;
    maxClusterRowsInputClass: string;
    expandEntityInputIdPrefix: string;

    constructor() {
        this.navbarCollapsed = false;

        this.settingsForm = new FormGroup({
            animation: new FormControl(true),
            maxClusterShownRows: new FormControl(
                DEFAULT_CLUSTER_ROWS, [Validators.required, Validators.min(1), Validators.pattern(/^-?[0-9][^\.]*$/)]
            ),
        });

        this.settingsFormChanges = new EventEmitter<any>();

        this.uniqueId = uuidv4();
        this.maxClusterRowsInputClass = 'form-control w-50';
        this.animationToggleInputId = `animation-toggle-${this.uniqueId}`;
        this.maxClusterRowsInputId = `max-cluster-rows-input-${this.uniqueId}`;
        this.expandEntityInputIdPrefix = `legend-label-${this.uniqueId}-`;
    }

    ngOnInit() {
        // Add a checkbox control for each element in the canvas legend (can't do this in the constructor since
        // the legendLabels input might not be initialized yet)
        this.legendLabels.forEach(label => {
            this.settingsForm.addControl(label, new FormControl(true));
        });

        // Emit the newly created settings form to the parent, so it can have the starting values initialized
        this.settingsFormChanges.emit(this.getSettingsFormValuesObject());

        this.settingsFormValueChangesSub = this.settingsForm.valueChanges.subscribe(() => {
            this.setMaxClusterRowsStyle();
            this.settingsFormChanges.emit(this.getSettingsFormValuesObject());
        });
    }

    /**
     * Gets the settings form values/validity as a SettingsFormValues object.
     */
    getSettingsFormValuesObject() {
        const settingsFormValues = {
            animation: {
                value: this.settingsForm.get('animation').value,
                valid: this.settingsForm.get('animation').valid,
            },
            maxClusterShownRows: {
                value: this.settingsForm.get('maxClusterShownRows').value,
                valid: this.settingsForm.get('maxClusterShownRows').valid,
            } as SettingsFormControl
        } as SettingsFormValues;

        this.legendLabels.forEach(label => {
            settingsFormValues[label] = {
                value: this.settingsForm.get(label).value,
                valid: this.settingsForm.get(label).valid,
            } as SettingsFormControl;
        });

        return settingsFormValues;
    }

    setMaxClusterRowsStyle() {
      if (this.settingsForm.get('maxClusterShownRows').invalid) {
        this.maxClusterRowsInputClass = 'form-control w-50 invalid-input';
      } else if (this.settingsForm.get('maxClusterShownRows').value > 50) {
        this.maxClusterRowsInputClass = 'form-control w-50 input-warning';
      } else {
        this.maxClusterRowsInputClass = 'form-control w-50';
      }
    }

    fitToScreen() {
        this.fitClickEvent.emit();
    }
}
