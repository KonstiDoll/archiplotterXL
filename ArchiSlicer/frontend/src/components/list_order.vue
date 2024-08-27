<template>
  <div>
    <h1>Drag and Drop List with Smooth Squeezing Animations</h1>

    <ul id="draggable-list">
      <li
        v-for="(item, index) in items"
        :key="item"
        draggable="true"
        @dragstart="onDragStart(index, $event)"
        @dragend="onDragEnd"
        @dragover.prevent="onDragOver(index, $event)"
        @drop="onDrop(index)"
        :style="{ backgroundColor: colors[index] }"
        :class="{ dragging: draggingIndex === index }"
        ref="listItems"
      >
        {{ item }}
      </li>
    </ul>

    <div id="output">
      <strong>Current Order:</strong>
      <p>{{ currentOrder }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue';
import { gsap } from 'gsap';

// State variables
const items = ref<string[]>(['Item 1', 'Item 2', 'Item 3', 'Item 4', 'Item 5']);
const draggingIndex = ref<number | null>(null);
const dragOverIndex = ref<number | null>(null);
const listItems = ref<HTMLLIElement[]>([]); // Refs to list items
const previousPositions = ref<number[]>([]); // To store the previous positions of items

// Array of colors
const colors = ref<string[]>([
  '#ff9999', // Light Red
  '#99ccff', // Light Blue
  '#99ff99', // Light Green
  '#ffcc99', // Light Orange
  '#cc99ff', // Light Purple
]);

// Method to handle the start of dragging
const onDragStart = (index: number, event: DragEvent) => {
  draggingIndex.value = index;
  const item = event.target as HTMLElement;
  gsap.to(item, { scale: 1.1, boxShadow: '0px 10px 20px rgba(0,0,0,0.2)', duration: 0.2 });

  // Store the initial positions of the items
  previousPositions.value = listItems.value.map(el => el.getBoundingClientRect().top);
};

// Method to handle drag over
const onDragOver = (index: number, event: DragEvent) => {
  event.preventDefault();
  if (draggingIndex.value !== null && dragOverIndex.value !== index) {
    dragOverIndex.value = index;
    animateList(draggingIndex.value, index);
  }
};

// Method to handle the end of dragging
const onDragEnd = () => {
  draggingIndex.value = null;
  dragOverIndex.value = null;
  gsap.to(listItems.value, { y: 0, scale: 1, boxShadow: 'none', duration: 0.2 });
};

// Method to handle the drop event
const onDrop = async (index: number) => {
  if (draggingIndex.value !== null) {
    const draggedItem = items.value[draggingIndex.value];
    const draggedColor = colors.value[draggingIndex.value];

    // Remove the dragged item from its old position
    items.value.splice(draggingIndex.value, 1);
    colors.value.splice(draggingIndex.value, 1);

    // Insert the dragged item into its new position
    items.value.splice(index, 0, draggedItem);
    colors.value.splice(index, 0, draggedColor);

    // Reset dragging index
    draggingIndex.value = null;
    dragOverIndex.value = null;

    await nextTick(); // Wait for DOM update

    // Reset positions after dropping
    gsap.to(listItems.value, { y: 0, duration: 0.3 });
  }
};

// Computed property to get the current order of items
const currentOrder = computed(() => items.value.join(', '));

// GSAP Animation for list reordering
const animateList = (draggingIdx: number, dragOverIdx: number) => {
  listItems.value.forEach((el, i) => {
    const currentTop = el.getBoundingClientRect().top;
    const previousTop = previousPositions.value[i];
    const delta = previousTop - currentTop;

    gsap.to(el, { y: delta, duration: 0.3 });

    if (i === draggingIdx) {
      gsap.to(el, { y: delta, duration: 0.3 });
    }
  });

  // Update previous positions after animation
  previousPositions.value = listItems.value.map(el => el.getBoundingClientRect().top);
};

// Store list items in ref array on mount
onMounted(() => {
  listItems.value = Array.from(document.querySelectorAll('#draggable-list li'));
});
</script>

<style scoped>
ul {
  list-style-type: none;
  padding: 0;
  margin: 0;
}

li {
  padding: 10px;
  margin: 5px 0;
  color: #ffffff;
  border-radius: 5px;
  cursor: move;
  user-select: none;
  position: relative;
}

.dragging {
  opacity: 0.8;
}

#output {
  margin-top: 20px;
  padding: 10px;
  border: 1px solid #ccc;
  background-color: #f9f9f9;
}
</style>
