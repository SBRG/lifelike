import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { map } from 'rxjs/operators';

import {
    NodeLegend,
} from 'app/interfaces';


@Injectable({providedIn: 'root'})
export class LegendService {
    readonly visApi = '/api/visualizer';

    constructor(private http: HttpClient) { }

    getAnnotationLegend() {
        return this.http.get<{result: NodeLegend}>(
            `${this.visApi}/get-annotation-legend`,
        ).pipe(map(resp => resp.result));
    }
}
