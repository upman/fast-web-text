import { Editor } from './core/Editor';

async function loadFile(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load file: ${response.statusText}`);
  }
  return response.text();
}

async function main() {
  const container = document.getElementById('editor-container');
  const canvas = document.getElementById('editor-canvas') as HTMLCanvasElement;

  if (!container || !canvas) {
    console.error('Container or canvas not found');
    return;
  }

  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;

  const sampleContent = await loadFile('https://raw.githubusercontent.com/microsoft/vscode/refs/heads/main/src/vs/loader.js');

  const editor = new Editor(container, canvas);
  await editor.initialize(sampleContent);

  console.log('Fast-Web-Text editor initialized with WebGPU rendering');
}

main();
