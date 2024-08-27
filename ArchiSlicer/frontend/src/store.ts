import { defineStore } from 'pinia'
import type { ShapeGeometry, Group } from 'three';

export const useMainStore = defineStore('main', {
  state: () => ({
    lineGeometry: null as ShapeGeometry | null,
  }),
  actions: {
    setLineGeometry(geometry: Group) {
      this.lineGeometry = geometry;
    }
  }
});