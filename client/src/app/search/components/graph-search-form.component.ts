import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

import { OrganismAutocomplete } from 'app/interfaces';
import { KG_VIZ_DOMAINS, KG_VIZ_FILTER_TYPES } from 'app/shared/constants';
import { MessageArguments, MessageDialog } from 'app/shared/services/message-dialog.service';
import { MessageType } from 'app/interfaces/message-dialog.interface';

import { GraphSearchParameters } from '../graph-search';

@Component({
  selector: 'app-graph-search-form',
  templateUrl: './graph-search-form.component.html',
})
export class GraphSearchFormComponent {
  @Output() search = new EventEmitter<GraphSearchParameters>();

  domainChoices: string[] = KG_VIZ_DOMAINS;
  entityChoices: string[] = KG_VIZ_FILTER_TYPES;
  organismChoice: string;

  form = new FormGroup({
    query: new FormControl('', Validators.required),
    domains: new FormControl(''),
    entities: new FormControl(''),
    organism: new FormControl(null),
  });

  constructor(private readonly messageDialog: MessageDialog) {
    this.form.patchValue({
      query: '',
      domains: [],
      entities: [],
      organism: '',
    });
  }

  @Input()
  set params(params: GraphSearchParameters) {
    if (params) {
      this.organismChoice = params.organism;
      this.form.patchValue({
        query: params.query,
        domains: params.domains != null ? this.getValidValuesFromListParams(this.domainChoices, params.domains) : [],
        entities: params.entities != null ? this.getValidValuesFromListParams(this.entityChoices, params.entities) : [],
        organism: params.organism,
      });
    }
  }

  /**
   * Returns a filtered list of domains matching values in our hard-coded list.
   * @param paramList a list of domain strings; individual values may or may not match our hard-coded list
   */
  getValidValuesFromListParams(choices: string[], paramList: string[]): string[] {
    const normalizedParamList = paramList.map(val => val.toLowerCase());
    return choices.filter(choice => normalizedParamList.includes(choice.toLowerCase()));
  }

  submit() {
    if (!this.form.invalid) {
      this.search.emit({...this.form.value});
    } else {
      this.form.markAsDirty();

      let errorMsg = '';
      if (this.form.get('query').getError('required')) {
        errorMsg += 'Search term is required. ';
      }
      if (this.form.get('domains').getError('required')) {
        errorMsg += 'You must select at least one domain. ';
      }
      if (this.form.get('entityTypes').getError('required')) {
        errorMsg += 'You must select at least one entity type. ';
      }

      this.messageDialog.display({
        title: 'Invalid Input',
        message: errorMsg,
        type: MessageType.Error,
      } as MessageArguments);
    }
  }

  choiceLabel(choice) {
    if (choice === 'Taxonomy') {
      return 'Species/Taxonomy';
    } else if (choice === 'Chemical') {
      return 'Chemical/Compound';
    }
    return choice;
  }

  setOrganism(organism: OrganismAutocomplete | null) {
    this.form.get('organism').setValue(organism ? organism.tax_id : null);
  }
}
