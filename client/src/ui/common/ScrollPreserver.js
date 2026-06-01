export class ScrollPreserver {
  constructor(root, selector = '[data-scroll-key]') {
    this.root = root;
    this.selector = selector;
  }

  capture(extra = []) {
    const positions = new Map();
    if (!this.root) return positions;
    this.root.querySelectorAll(this.selector).forEach((node) => {
      const key = node.dataset.scrollKey || node.getAttribute('data-scroll-key') || '';
      if (key) positions.set(key, node.scrollTop || 0);
    });
    for (const item of extra) {
      const node = typeof item.selector === 'string' ? this.root.querySelector(item.selector) : item.node;
      const key = item.key || item.selector || '';
      if (node && key) positions.set(key, node.scrollTop || 0);
    }
    return positions;
  }

  restore(positions) {
    if (!this.root || !positions?.size) return;
    this.root.querySelectorAll(this.selector).forEach((node) => {
      const key = node.dataset.scrollKey || node.getAttribute('data-scroll-key') || '';
      if (key && positions.has(key)) node.scrollTop = positions.get(key) || 0;
    });
  }
}
