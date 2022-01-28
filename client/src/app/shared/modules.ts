import { EventEmitter } from '@angular/core';

export interface ModuleProperties {
  title: string;
  fontAwesomeIcon: string;
  badge?: string;
  loading?: boolean;
}

export interface ModuleAwareComponent {
  modulePropertiesChange?: EventEmitter<ModuleProperties>;
  viewParams?: object;
}
