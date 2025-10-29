import { Editor } from './core/Editor';

function detectLanguageFromFileName(fileName: string): string {
  if (!fileName) return 'javascript';

  // Extract file name from URL
  const urlMatch = fileName.match(/\/([^\/]+)$/);
  const baseName = urlMatch ? urlMatch[1] : fileName;

  // Get file extension
  const lastDotIndex = baseName.lastIndexOf('.');
  if (lastDotIndex === -1) return 'javascript';

  const extension = baseName.substring(lastDotIndex).toLowerCase();

  // Map extensions to languages
  switch (extension) {
    case '.js':
    case '.mjs':
    case '.cjs':
      return 'javascript';
    case '.ts':
    case '.tsx':
    case '.d.ts':
      return 'typescript';
    case '.py':
    case '.pyw':
    case '.pyi':
      return 'python';
    case '.json':
    case '.jsonc':
      return 'json';
    default:
      return 'javascript';
  }
}

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

  const sampleContent = await loadFile('https://raw.githubusercontent.com/BerriAI/litellm/refs/heads/main/model_prices_and_context_window.json');

  const editor = new Editor(container, canvas);
  await editor.initialize(sampleContent);

  // Detect language from the file URL
  const detectedLanguage = detectLanguageFromFileName('https://raw.githubusercontent.com/BerriAI/litellm/refs/heads/main/model_prices_and_context_window.json');
  editor.setLanguage(detectedLanguage);

  console.log('Fast-Web-Text editor initialized with WebGPU rendering');
}

main();
