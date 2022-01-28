import { Component, Output, EventEmitter, Input, OnInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';

import { Subject, Subscription } from 'rxjs';

@Component({
    selector: 'app-generic-file-upload',
    templateUrl: './generic-file-upload.component.html',
    styleUrls: ['./generic-file-upload.component.scss']
})
export class GenericFileUploadComponent implements OnInit, OnDestroy {
    @ViewChild('fileInput', {static: true}) fileInputRef: ElementRef;

    @Output() fileChanged: EventEmitter<File> = new EventEmitter();

    // string should be in the same format as the 'accept' attribute on file input html elements
    @Input() accept: string;
    @Input() resetFileInputSubject: Subject<boolean>;

    fileName: string;

    resetFileInputSub: Subscription;

    constructor() {
        this.fileName = '';
    }

    ngOnInit() {
        this.resetFileInputSub = this.resetFileInputSubject.subscribe(() => {
            this.fileInputRef.nativeElement.value = null;
            this.fileName = '';
        });
    }

    ngOnDestroy() {
        this.resetFileInputSub.unsubscribe();
    }

    onFileChange(event: any) {
        // It's possible -- if the user cancels file selection after having already selected a file -- for the change event to not include
        // any files. In such a case, we just don't emit a change (because the file _didn't_ actually change).
        if (event.target.files.length > 0) {
            this.fileName = event.target.files[0].name;
            this.fileChanged.emit(event.target.files[0]);
        }
    }
}
