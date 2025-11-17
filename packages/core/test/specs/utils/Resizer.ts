import Resize from '../../../src/commands/view/Resize';
import Resizer from '../../../src/utils/Resizer';

describe('Resizer utils', () => {
  it('should prefer offsetParent for positioned elements', () => {
    const parent = document.createElement('div');
    parent.style.position = 'relative';
    parent.style.width = '200px';
    parent.style.height = '200px';

    const child = document.createElement('div');
    child.style.position = 'absolute';
    child.style.width = '100px';
    child.style.height = '50px';
    parent.appendChild(child);
    document.body.appendChild(parent);

    const r = new Resizer({});
    r.focus(child);

    // getParentEl should return the positioned ancestor
    const p = r.getParentEl();
    expect(p).toBe(parent);

    document.body.removeChild(parent);
  });

  it('convertPxToUnit should convert px to % relative to offsetParent when element is absolute', () => {
    const parent = document.createElement('div');
    parent.style.position = 'relative';
    parent.style.width = '400px';
    document.body.appendChild(parent);

    const child = document.createElement('div');
    child.style.position = 'absolute';
    parent.appendChild(child);

    const elComputedStyle = getComputedStyle(child);
    const out = Resize.convertPxToUnit({ el: child, valuePx: 100, unit: '%', elComputedStyle });
    expect(out).toBe('25%');

    document.body.removeChild(parent);
  });
});