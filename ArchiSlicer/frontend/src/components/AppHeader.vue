<template>
    <header class="flex items-center justify-between h-14 px-6 bg-slate-900 text-white shrink-0">
        <div class="flex items-center space-x-3">
            <div class="text-xl font-bold tracking-wide">ArchiSlicer</div>
            <div class="text-xs text-slate-400">Multi-Layer SVG to G-Code</div>
        </div>
        <div class="flex items-center space-x-4">
            <span class="text-xs text-slate-500">v{{ version }}</span>
        </div>
    </header>
</template>

<script setup lang="ts">
import { version } from '../../package.json';
</script>
