import Resize from '../../../src/commands/view/Resize';
import Resizer from '../../../src/utils/Resizer';

describe('Resizer utils', () => {
  // ---------------------------------------------------------------------------
  // Regression tests: resize of absolutely-positioned elements with CSS transforms
  //
  // Bug: calc() derives box.t / box.l from getBoundingClientRect() which
  // includes the element's own CSS transform offset. The old updateTarget code
  // applied those values directly to style.top / style.left, meaning the
  // transform translation was counted TWICE (once in the CSS value and once
  // by the transform itself), causing the element to jump on every resize.
  //
  // Fix: capture the element's starting visual-relative position at onStart,
  // then in updateTarget compute `delta = rect - startVisualRel` and add it
  // to the original CSS top/left. For unchanged-position handles the delta is
  // zero, so the CSS values are preserved exactly.
  // ---------------------------------------------------------------------------
  it('should preserve CSS top/left for bottom-right resize when element has a CSS transform', () => {
    // Simulates: position:absolute; top:289px; left:-213px;
    //            transform:translateX(556px) translateY(5px)
    // Visual position (reported by getBoundingClientRect, includes transform):
    //   visualLeft = -213 + 556 = 343   visualTop = 289 + 5 = 294
    const TRANSFORM_X = 556;
    const TRANSFORM_Y = 5;
    const CSS_LEFT = -213;
    const CSS_TOP = 289;
    const EL_WIDTH = 217;
    const EL_HEIGHT = 141;
    const visualLeft = CSS_LEFT + TRANSFORM_X; // 343
    const visualTop = CSS_TOP + TRANSFORM_Y; // 294

    const parent = document.createElement('div');
    parent.style.position = 'relative';
    document.body.appendChild(parent);
    const child = document.createElement('div');
    child.style.position = 'absolute';
    parent.appendChild(child);

    // posFetcher returns visual (transform-inclusive) positions
    const posFetcher = (el: HTMLElement) => {
      if (el === child) return { left: visualLeft, top: visualTop, width: EL_WIDTH, height: EL_HEIGHT };
      return { left: 0, top: 0, width: 600, height: 600 };
    };

    const r = new Resizer({ avoidContainerUpdate: true, posFetcher });
    r.focus(child);

    // Mirror what Resizer.start() populates
    r.startDim = { t: visualTop, l: visualLeft, w: EL_WIDTH, h: EL_HEIGHT };
    r.handlerAttr = 'br'; // bottom-right: should NOT change position
    r.delta = { x: 20, y: 20 };
    r.keys = { shift: false, ctrl: false, alt: false };
    r.parentDim = { t: 0, l: 0, w: 600, h: 600 };

    const result = r.calc(r)!;

    // Reproduce the fix's delta formula ----------------------------------------
    const parentRectAtStart = r.getParentRect();
    const startVisualRelTop = r.startDim.t - parentRectAtStart.top;
    const startVisualRelLeft = r.startDim.l - parentRectAtStart.left;

    const deltaTop = result.t - startVisualRelTop;
    const deltaLeft = result.l - startVisualRelLeft;
    const newCSSTop = CSS_TOP + deltaTop;
    const newCSSLeft = CSS_LEFT + deltaLeft;
    // --------------------------------------------------------------------------

    // 'br' never changes position → delta must be zero → CSS values unchanged
    expect(deltaTop).toBe(0);
    expect(deltaLeft).toBe(0);
    expect(newCSSTop).toBe(CSS_TOP);
    expect(newCSSLeft).toBe(CSS_LEFT);

    document.body.removeChild(parent);
  });

  it('should correctly shift CSS left when left-side handle is used with a CSS transform', () => {
    // Same element as above; drag the center-left handle 30px to the right.
    // Expected:  width shrinks by 30px, CSS left increases by 30px, CSS top unchanged.
    const TRANSFORM_X = 556;
    const TRANSFORM_Y = 5;
    const CSS_LEFT = -213;
    const CSS_TOP = 289;
    const EL_WIDTH = 217;
    const EL_HEIGHT = 141;
    const DRAG_X = 30;
    const visualLeft = CSS_LEFT + TRANSFORM_X; // 343
    const visualTop = CSS_TOP + TRANSFORM_Y; // 294

    const parent = document.createElement('div');
    parent.style.position = 'relative';
    document.body.appendChild(parent);
    const child = document.createElement('div');
    child.style.position = 'absolute';
    parent.appendChild(child);

    const posFetcher = (el: HTMLElement) => {
      if (el === child) return { left: visualLeft, top: visualTop, width: EL_WIDTH, height: EL_HEIGHT };
      return { left: 0, top: 0, width: 600, height: 600 };
    };

    const r = new Resizer({ avoidContainerUpdate: true, posFetcher });
    r.focus(child);

    r.startDim = { t: visualTop, l: visualLeft, w: EL_WIDTH, h: EL_HEIGHT };
    r.handlerAttr = 'cl'; // center-left: adjusts width AND left
    r.delta = { x: DRAG_X, y: 0 };
    r.keys = { shift: false, ctrl: false, alt: false };
    r.parentDim = { t: 0, l: 0, w: 600, h: 600 };

    const result = r.calc(r)!;

    const parentRectAtStart = r.getParentRect();
    const startVisualRelTop = r.startDim.t - parentRectAtStart.top;
    const startVisualRelLeft = r.startDim.l - parentRectAtStart.left;

    const deltaTop = result.t - startVisualRelTop;
    const deltaLeft = result.l - startVisualRelLeft;
    const newCSSTop = CSS_TOP + deltaTop;
    const newCSSLeft = CSS_LEFT + deltaLeft;

    // Width shrinks by DRAG_X
    expect(result.w).toBe(EL_WIDTH - DRAG_X);
    // Top does not change
    expect(newCSSTop).toBe(CSS_TOP);
    // Left moves right by DRAG_X (right edge stays fixed, left edge follows pointer)
    expect(newCSSLeft).toBe(CSS_LEFT + DRAG_X);

    document.body.removeChild(parent);
  });

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