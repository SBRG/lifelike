import { WordCloudAnnotationFilterEntity } from 'app/interfaces/annotation-filter.interface';

export interface D3CloudLayoutProperties {
  size: number;
  x: number;
  y: number;
  rotate: number;
}

export type WordCloudAnnotationFilterEntityWithLayout = WordCloudAnnotationFilterEntity & D3CloudLayoutProperties;
