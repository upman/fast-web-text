export class LayerHinting {
  applyHint(element: HTMLElement): void {
    element.style.transform = 'translate3d(0px, 0px, 0px)';
    element.style.willChange = 'transform';
  }

  removeHint(element: HTMLElement): void {
    element.style.transform = '';
    element.style.willChange = '';
  }
}
