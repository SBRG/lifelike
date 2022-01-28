import { Component, Input, OnInit } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Subject } from 'rxjs';

import { FilesystemObjectData } from 'app/file-browser/schema';
import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { FlatNode, TreeNode } from 'app/shared/schemas/common';
import { FilesystemObject } from 'app/file-browser/models/filesystem-object';

import { ContentSearchOptions } from '../content-search';
import { SearchType } from '../shared';

@Component({
  selector: 'app-advanced-search-dialog',
  templateUrl: './advanced-search-dialog.component.html',
  styleUrls: ['./advanced-search-dialog.component.scss']
})
export class AdvancedSearchDialogComponent implements OnInit {
  @Input() set params(params: ContentSearchOptions) {
    this.form.setValue({
      ...this.form.value,
      q: params.q,
      // Advanced Params
      types: params.types ? params.types : [],
      folders: params.folders ? params.folders : [],
      // synonyms: params.synonyms ? params.synonyms : false,
      // phrase: params.phrase ? params.phrase : '',
      // wildcards: params.wildcards ? params.wildcards : '',
    });

    // Need to set initialCheckedNodes so we can toggle the corresponding checkboxes in the hierarchy tree
    this.initialCheckedNodes = this.form.get('folders').value;
  }
  @Input() typeChoices: SearchType[] = [];

  initialCheckedNodes: string[] = [];
  fileHierarchyTree: TreeNode<FilesystemObject>[] = [];
  hierarchyLoaded = false;

  resetHierarchyTreeSubject = new Subject<boolean>();

  // Removing `phrase` and `wildcard` for now, in favor of just putting them in `q`. See a related comment in the template.

  form = new FormGroup({
    q: new FormControl(''),
    types: new FormControl([]),
    folders: new FormControl([])
    // synonyms: new FormControl(true),
    // phrase: new FormControl(''),
    // wildcards: new FormControl(''),
  });

  constructor(
    private readonly modal: NgbActiveModal,
    protected readonly filesystemService: FilesystemService,
  ) {}

  ngOnInit() {
    this.filesystemService.getHierarchy(true).subscribe((resp) => {
      this.fileHierarchyTree = resp.results.map(fileNodeObjectData => this.convertFODNodetoFONode(fileNodeObjectData));
      this.hierarchyLoaded = true;
    });
  }

  convertFODNodetoFONode(node: TreeNode<FilesystemObjectData>) {
    return {
      data: new FilesystemObject().update(node.data),
      level: node.level,
      children: node.children.map(child => this.convertFODNodetoFONode(child))
    } as TreeNode<FilesystemObject>;
  }

  dismiss() {
    this.modal.dismiss(this.form.value);
  }

  close() {
    if (this.form.valid) {
      this.modal.close(this.form.value);
    } else {
      this.form.markAsDirty();
    }
  }

  resetForm() {
    this.form.setValue({
      q: '',
      // Advanced Params
      types: [],
      folders: [],
      // phrase: '',
      // wildcards: '',
    });

    // Also reset the hierarchy tree, collapsing all open nodes and unchecking all checkboxes
    this.resetHierarchyTreeSubject.next(true);
  }

  /**
   * Function used by the 'types' app-select component to choose what value is displayed in the dropdown list.
   * @param choice SearchType representing an option in the list
   */
  typeLabel(choice: SearchType) {
    return choice.name;
  }

  /**
   * Function used by the 'projects' app-select component to choose which value is displayed in the dropdown list. Creates and returns a
   * closure to allow the app-select component to use the value of 'this.projectsMap'.
   */
  projectLabel(choice: string) {
    return choice;
  }

  updateFolders(folders: string[]) {
    this.form.get('folders').patchValue(folders);
  }

  initiallyCheckedNodesFilterFn = (t: FlatNode<FilesystemObject>) => this.form.get('folders').value.includes(t.data.hashId);
}
