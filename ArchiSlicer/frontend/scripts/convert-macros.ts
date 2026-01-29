#!/usr/bin/env npx ts-node
/**
 * Converts ArchiPlotter macros to a single JSON file for the simulator.
 *
 * Usage: npx ts-node scripts/convert-macros.ts
 *
 * This script reads all macro files from the ArchiPlotter macros directory,
 * flattens nested M98 calls, and outputs a single macros.json file.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Source directory for macros (relative to repo root)
const MACROS_SOURCE = path.resolve(__dirname, '../../../../archiplotterXL/Makros');
const OUTPUT_FILE = path.resolve(__dirname, '../public/macros.json');

interface MacroInstruction {
  type: 'move' | 'set_mode' | 'call_macro' | 'other';
  raw: string;
  x?: number;
  y?: number;
  z?: number;
  u?: number;
  feedrate?: number;
  isRelative?: boolean;
  macroPath?: string;
}

interface ParsedMacro {
  name: string;
  instructions: MacroInstruction[];
  flattened: MacroInstruction[]; // With nested macros resolved
}

interface MacrosJson {
  version: string;
  generated: string;
  macros: Record<string, {
    raw: string[];
    flattened: Array<{
      type: string;
      x?: number;
      y?: number;
      z?: number;
      u?: number;
      feedrate?: number;
      isRelative?: boolean;
    }>;
  }>;
}

function parseLine(line: string): MacroInstruction | null {
  const trimmed = line.split(';')[0].trim(); // Remove comments
  if (!trimmed) return null;

  const instruction: MacroInstruction = {
    type: 'other',
    raw: trimmed,
  };

  // Parse G0/G1 moves
  if (/^G[01]\s/i.test(trimmed) || /^G[01]$/i.test(trimmed)) {
    instruction.type = 'move';

    const xMatch = trimmed.match(/X(-?[\d.]+)/i);
    const yMatch = trimmed.match(/Y(-?[\d.]+)/i);
    const zMatch = trimmed.match(/Z(-?[\d.]+)/i);
    const uMatch = trimmed.match(/U(-?[\d.]+)/i);
    const fMatch = trimmed.match(/F(-?[\d.]+)/i);

    if (xMatch) instruction.x = parseFloat(xMatch[1]);
    if (yMatch) instruction.y = parseFloat(yMatch[1]);
    if (zMatch) instruction.z = parseFloat(zMatch[1]);
    if (uMatch) instruction.u = parseFloat(uMatch[1]);
    if (fMatch) instruction.feedrate = parseFloat(fMatch[1]);
  }
  // Parse G90/G91 mode changes
  else if (/^G90\b/i.test(trimmed)) {
    instruction.type = 'set_mode';
    instruction.isRelative = false;
  }
  else if (/^G91\b/i.test(trimmed)) {
    instruction.type = 'set_mode';
    instruction.isRelative = true;
  }
  // Parse M98 macro calls
  else if (/^M98\s+P/i.test(trimmed)) {
    instruction.type = 'call_macro';
    const pathMatch = trimmed.match(/P["']?([^"'\s]+)["']?/i);
    if (pathMatch) {
      // Extract just the macro name from the path
      instruction.macroPath = pathMatch[1].replace('/macros/', '');
    }
  }

  return instruction;
}

function readMacroFile(filePath: string): string[] {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content.split('\n');
  } catch (e) {
    console.warn(`Could not read ${filePath}: ${e}`);
    return [];
  }
}

function flattenMacro(
  macroName: string,
  allMacros: Map<string, string[]>,
  visited: Set<string> = new Set()
): MacroInstruction[] {
  if (visited.has(macroName)) {
    console.warn(`Circular macro reference detected: ${macroName}`);
    return [];
  }

  visited.add(macroName);
  const lines = allMacros.get(macroName);
  if (!lines) {
    console.warn(`Macro not found: ${macroName}`);
    return [];
  }

  const result: MacroInstruction[] = [];

  for (const line of lines) {
    const instruction = parseLine(line);
    if (!instruction) continue;

    if (instruction.type === 'call_macro' && instruction.macroPath) {
      // Recursively flatten nested macro
      const nested = flattenMacro(instruction.macroPath, allMacros, new Set(visited));
      result.push(...nested);
    } else {
      result.push(instruction);
    }
  }

  return result;
}

function main() {
  console.log(`Reading macros from: ${MACROS_SOURCE}`);

  if (!fs.existsSync(MACROS_SOURCE)) {
    console.error(`Macros directory not found: ${MACROS_SOURCE}`);
    process.exit(1);
  }

  // Read all macro files
  const files = fs.readdirSync(MACROS_SOURCE);
  const allMacros = new Map<string, string[]>();

  for (const file of files) {
    const filePath = path.join(MACROS_SOURCE, file);
    const stat = fs.statSync(filePath);
    if (stat.isFile() && !file.startsWith('.')) {
      const lines = readMacroFile(filePath);
      allMacros.set(file, lines);
      console.log(`  Read: ${file} (${lines.length} lines)`);
    }
  }

  // Build output JSON
  const output: MacrosJson = {
    version: '1.0',
    generated: new Date().toISOString(),
    macros: {},
  };

  for (const [name, lines] of allMacros) {
    const flattened = flattenMacro(name, allMacros);

    output.macros[name] = {
      raw: lines.filter(l => l.trim()),
      flattened: flattened.map(instr => {
        const result: MacrosJson['macros'][string]['flattened'][0] = {
          type: instr.type,
        };
        if (instr.x !== undefined) result.x = instr.x;
        if (instr.y !== undefined) result.y = instr.y;
        if (instr.z !== undefined) result.z = instr.z;
        if (instr.u !== undefined) result.u = instr.u;
        if (instr.feedrate !== undefined) result.feedrate = instr.feedrate;
        if (instr.isRelative !== undefined) result.isRelative = instr.isRelative;
        return result;
      }),
    };
  }

  // Ensure output directory exists
  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write output
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`\nWritten: ${OUTPUT_FILE}`);
  console.log(`Total macros: ${Object.keys(output.macros).length}`);
}

main();
