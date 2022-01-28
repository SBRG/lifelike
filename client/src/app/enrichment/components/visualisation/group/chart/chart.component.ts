import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';

import { ChartOptions, ChartType, ChartPoint } from 'chart.js';

import { EnrichWithGOTermsResult } from 'app/enrichment/services/enrichment-visualisation.service';

const mapTootipItem = func =>
  ({datasetIndex, index}, {datasets}) => {
    return func(datasets[datasetIndex].data[index]);
  };

const mapSingularOfTootipItems = func => {
  const wrappedFunc = mapTootipItem(func);
  return ([tootipItem], object) =>
    wrappedFunc(tootipItem, object);
};

@Component({
  selector: 'app-chart',
  templateUrl: './chart.component.html',
  styleUrls: ['./chart.component.scss'],
})
export class ChartComponent implements OnChanges {
  public options: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      xAxes: [
        {
          ticks: {
            suggestedMin: 0,
            stepSize: 1,
            // callback: value => value
          },
          gridLines: {
            drawOnChartArea: false
          },
          offset: true,
          type: 'logarithmic',
          scaleLabel: {
            display: true,
            labelString: '-log(q-value)'
          }
        }
      ],
    },
    plugins: {
      // Change options for ALL labels of THIS CHART
      datalabels: {
        display: false
      }
    },
    tooltips: {
      enabled: true,
      mode: 'y',
      intersect: false,
      callbacks: {
        title: mapSingularOfTootipItems(({gene}) => gene),
        label: mapTootipItem(d => `q-value: ${d['q-value'].toExponential(2)}`)
      }
    }
  };
  public chartType: ChartType = 'horizontalBar';
  legend = false;

  @Input() showMore: boolean;
  @Input() data: EnrichWithGOTermsResult[];
  @Input() show: boolean;

  slicedData: (EnrichWithGOTermsResult & ChartPoint)[];
  labels: string[];

  ngOnChanges({show, data, showMore}: SimpleChanges) {
    if (this.show && (show || data || showMore)) {
      const slicedNotFormatedData = this.showMore ? this.data.slice(0, 50) : this.data.slice(0, 10);
      this.slicedData = slicedNotFormatedData.map((d: any, i) => ({
        ...d,
        x: -Math.log(d['q-value'])
      }));
      this.labels = slicedNotFormatedData.map(({gene}) => gene);
    }
  }
}
