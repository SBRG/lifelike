import { Component, OnInit, OnDestroy } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpClient } from '@angular/common/http';

import { Subscription } from 'rxjs';
import { ChartOptions, ChartDataSets } from 'chart.js';
import * as pluginDataLabels from 'chartjs-plugin-datalabels';

import { BackgroundTask } from 'app/shared/rxjs/background-task';

interface StatisticsDataResponse {
  [domain: string]: {
    [entity: string]: number
  };
}

const ENTITY_COLORS = [
  'rgba(30, 130, 76, 0.9)',
  'rgba(235, 149, 50, 0.9)',
  'rgba(226, 106, 106, 0.9)',
  'rgba(31, 58, 147, 0.9)',
  'rgba(242, 120, 75, 0.9)',
  'rgba(153, 0, 102, 0.9)',
  'rgba(144, 198, 149, 0.9)',
  'rgba(27, 163, 156, 0.9)',
  'rgba(153, 102, 0, 0.9)',
  'rgba(44, 130, 201, 0.9)',
  'rgba(150, 40, 27, 0.9)',
  'rgba(153, 204, 204, 0.9)',
  'rgba(78, 205, 196, 0.9)',
  'rgba(137, 196, 244, 0.9)',
  'rgba(51, 110, 123, 0.9)',
  'rgba(58, 83, 155, 0.9)',
  'rgba(51, 0, 102, 0.9)',
];

const DOMAIN_COLORS = [
  'rgba(34, 167, 240, 0.9)',
  'rgba(169, 109, 173, 0.9)',
  'rgba(38, 194, 129, 0.9)',
  'rgba(245, 230, 83, 0.9)',
  'rgba(242, 121, 53, 0.9)',
  'rgba(149, 165, 166, 0.9)',
  'rgba(129, 207, 224, 0.9)',
  'rgba(250, 190, 88, 0.9)',
  'rgba(0, 181, 204, 0.9)',
];

@Component({
  selector: 'app-kg-statistics',
  templateUrl: './kg-statistics.component.html',
  styleUrls: ['./kg-statistics.component.scss']
})
export class KgStatisticsComponent {
  loadTask: BackgroundTask<void, StatisticsDataResponse>;
  chartDataAllDomains: ChartDataSets[] = [];
  chartDataEntitiesByDomain: {
    [domain: string]: ChartDataSets[];
  } = {};
  chartLabelsDomains: string[] = [];
  chartLabelsEntitiesByDomain: {
    [domain: string]: string[];
  } = {};
  chartColorsEntitiesByDomain: {
    [domain: string]: {
      backgroundColor: string[]
    }[];
  } = {};
  chartColorsDomains: {
    backgroundColor: string[];
  }[] = [];
  chartOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      yAxes: [{
        ticks: {
          beginAtZero: true,
          callback: (value, index, values) => this.addThousandSeparator(value.toString())
        },
      }],
      xAxes: [{
        ticks: {
          beginAtZero: true,
          callback: (value, index, values) => this.addThousandSeparator(value.toString())
        }
      }]
    },
    plugins: {
      datalabels: {
        formatter: (value, context) => this.addThousandSeparator(value.toString()),
        anchor: 'end',
        offset: 0,
        align: 'end',
        font: {
          size: 14
        }
      }
    },
    layout: {
      padding: {
        top: 25,
        right: 50
      }
    },
    tooltips: {
      callbacks: {
        label: (tooltipItem, data) => this.addThousandSeparator(tooltipItem.value)
      }
    }
  };
  chartPlugins = [pluginDataLabels];
  totalCount: any = 0;

  constructor(private http: HttpClient, private snackBar: MatSnackBar) {
    this.loadTask = new BackgroundTask<void, StatisticsDataResponse>(() => {
      return this.http.get<StatisticsDataResponse>('/api/kg-statistics');
    });

    this.loadTask.results$.subscribe(({result, value}) => {
      this._getChartDataEntitiesByDomain(result);
      this._getChartDataAllDomains(result);
    });

    this.refresh();
  }

  refresh() {
    this.loadTask.update();
  }

  private _getChartDataEntitiesByDomain(statisticsData) {
    // assign color to each entity
    const entityToColor = {};
    let i = 0;
    for (const domainData of Object.values(statisticsData)) {
      Object.keys(domainData).forEach(entity => {
        if (!entityToColor.hasOwnProperty(entity)) {
          entityToColor[entity] = ENTITY_COLORS[i % ENTITY_COLORS.length];
          i += 1;
        }
      });
    }

    this.chartDataEntitiesByDomain = {};
    this.chartLabelsEntitiesByDomain = {};
    this.chartColorsEntitiesByDomain = {};
    for (const [domain, domainData] of Object.entries(statisticsData)) {
      this.chartLabelsEntitiesByDomain[domain] = [];
      const dataset = { data: [], maxBarThickness: 50 };
      const colors = { backgroundColor: [] };
      for (const [entity, count] of Object.entries(domainData)) {
        dataset.data.push(count);
        colors.backgroundColor.push(entityToColor[entity]);
        this.chartLabelsEntitiesByDomain[domain].push(entity);
      }
      this.chartColorsEntitiesByDomain[domain] = [ colors ];
      this.chartDataEntitiesByDomain[domain] = [ dataset ];
    }
  }

  private _getChartDataAllDomains(statisticsData) {
    this.chartColorsDomains = [{ backgroundColor: DOMAIN_COLORS }];
    const data = [];
    this.chartLabelsDomains = [];
    for (const [domain, domainData] of Object.entries(statisticsData)) {
      data.push(Object.values(domainData).reduce((a, b) => a + b, 0));
      this.chartLabelsDomains.push(domain);
    }
    this.chartDataAllDomains = [{ data }];
    this.totalCount = data.reduce((a, b) => a + b, 0);
  }

  addThousandSeparator(value) {
    return value.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

}
