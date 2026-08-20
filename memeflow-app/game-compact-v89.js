(() => {
'use strict';

/* MF_V89_FINAL_DENSITY */

const mq = window.matchMedia(
  '(max-width:620px) and (orientation:portrait)'
);

function norm(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function set(el, prop, value) {
  if (!el) return;

  if (
    el.style.getPropertyValue(prop) === value &&
    el.style.getPropertyPriority(prop) === 'important'
  ) {
    return;
  }

  el.style.setProperty(
    prop,
    value,
    'important'
  );
}

function rect(el) {
  try {
    return el.getBoundingClientRect();
  } catch {
    return {
      width: 0,
      height: 0,
      top: 0,
      bottom: 0,
      left: 0,
      right: 0
    };
  }
}

function exactNodes(root, value) {
  if (!root) return [];

  return [...root.querySelectorAll('*')]
    .filter(el => norm(el.textContent) === value)
    .sort(
      (a, b) =>
        a.children.length - b.children.length
    );
}

function nearestVisualBox(
  leaf,
  root,
  options = {}
) {
  if (!leaf || !root) return null;

  const rootRect = rect(root);

  const minWidth =
    options.minWidth ?? 60;

  const maxWidth =
    options.maxWidth ??
    rootRect.width * 0.60;

  const minHeight =
    options.minHeight ?? 34;

  const maxHeight =
    options.maxHeight ?? 150;

  let node = leaf;

  while (
    node &&
    node !== root &&
    node.parentElement
  ) {
    const r = rect(node);

    if (
      r.width >= minWidth &&
      r.width <= maxWidth &&
      r.height >= minHeight &&
      r.height <= maxHeight
    ) {
      return node;
    }

    node = node.parentElement;
  }

  return null;
}

function compactBox(
  box,
  height,
  radius = '12px'
) {
  if (!box) return;

  set(box, 'height', `${height}px`);
  set(box, 'min-height', `${height}px`);
  set(box, 'max-height', `${height}px`);

  set(box, 'padding-top', '0px');
  set(box, 'padding-bottom', '0px');

  set(box, 'margin-top', '0px');
  set(box, 'margin-bottom', '0px');

  set(box, 'box-sizing', 'border-box');
  set(box, 'border-radius', radius);

  const display =
    getComputedStyle(box).display;

  if (
    display !== 'grid' &&
    display !== 'flex'
  ) {
    set(box, 'display', 'flex');
  }

  set(box, 'align-items', 'center');
}

function findPaperStakeField(panel) {
  const labels =
    exactNodes(
      panel,
      'Paper stake'
    );

  if (!labels.length) return null;

  const labelRect =
    rect(labels[0]);

  const panelRect =
    rect(panel);

  const candidates =
    [...panel.querySelectorAll('*')]
      .map(el => ({
        el,
        r: rect(el),
        t: norm(el.textContent)
      }))
      .filter(({ r, t }) => {
        return (
          r.top >= labelRect.bottom - 2 &&
          r.top <= labelRect.bottom + 100 &&
          r.width >= panelRect.width * 0.72 &&
          r.width <= panelRect.width &&
          r.height >= 50 &&
          r.height <= 150 &&
          /[$€£¥]?\s*[\d,.]+/.test(t)
        );
      })
      .sort((a, b) => {
        if (a.r.top !== b.r.top) {
          return a.r.top - b.r.top;
        }

        return b.r.width - a.r.width;
      });

  return candidates[0]?.el || null;
}

function compactStake(panel) {
  const box =
    findPaperStakeField(panel);

  if (!box) return;

  compactBox(
    box,
    58,
    '14px'
  );

  set(box, 'padding-left', '14px');
  set(box, 'padding-right', '14px');

  box
    .querySelectorAll(
      'input,[contenteditable="true"]'
    )
    .forEach(el => {
      set(el, 'height', '54px');
      set(el, 'min-height', '54px');
      set(el, 'max-height', '54px');
      set(el, 'font-size', '18px');
      set(el, 'padding-top', '0px');
      set(el, 'padding-bottom', '0px');
    });
}

function compactQuickBets(panel) {
  const values = [
    '25%',
    '50%',
    '75%',
    'MAX'
  ];

  const boxes = [];

  values.forEach(value => {
    const leaf =
      exactNodes(panel, value)[0];

    if (!leaf) return;

    const box =
      nearestVisualBox(
        leaf,
        panel,
        {
          minWidth: 60,
          maxWidth:
            rect(panel).width * 0.32,
          minHeight: 34,
          maxHeight: 100
        }
      );

    if (!box) return;

    compactBox(
      box,
      42,
      '12px'
    );

    set(box, 'font-size', '15px');

    boxes.push(box);
  });

  if (boxes.length >= 2) {
    const parent =
      boxes[0].parentElement;

    if (
      parent &&
      boxes.every(
        box =>
          box.parentElement === parent
      )
    ) {
      set(parent, 'gap', '6px');
      set(parent, 'row-gap', '6px');
      set(parent, 'margin-top', '6px');
      set(parent, 'margin-bottom', '6px');
      set(parent, 'min-height', '0px');
      set(parent, 'height', 'auto');
    }
  }
}

function multiplierLeaves(panel) {
  return [...panel.querySelectorAll('*')]
    .filter(el => {
      if (el.children.length > 2) {
        return false;
      }

      const value =
        norm(el.textContent)
          .replace(/\s+/g, '');

      return (
        /^\d+(?:\.\d+)?[x×]$/i
          .test(value)
      );
    });
}

function compactMultipliers(panel) {
  const seen = new Set();

  multiplierLeaves(panel)
    .forEach(leaf => {
      const box =
        nearestVisualBox(
          leaf,
          panel,
          {
            minWidth: 100,
            maxWidth:
              rect(panel).width * 0.58,
            minHeight: 40,
            maxHeight: 120
          }
        );

      if (!box || seen.has(box)) {
        return;
      }

      seen.add(box);

      compactBox(
        box,
        48,
        '12px'
      );

      set(box, 'font-size', '16px');
      set(box, 'padding-left', '11px');
      set(box, 'padding-right', '11px');
    });

  panel
    .querySelectorAll(
      'select,[role="combobox"]'
    )
    .forEach(el => {
      const r = rect(el);

      if (
        r.width > 90 &&
        r.width <
          rect(panel).width * 0.60
      ) {
        compactBox(
          el,
          48,
          '12px'
        );

        set(el, 'font-size', '16px');
      }
    });
}

function compactFlightPlan(panel) {
  const title =
    exactNodes(
      panel,
      'FLIGHT PLAN'
    )[0];

  if (!title) return;

  let node = title.parentElement;

  for (let i = 0; i < 3; i += 1) {
    if (!node || node === panel) {
      break;
    }

    const r = rect(node);

    if (
      r.width >
        rect(panel).width * 0.75 &&
      r.height > 80
    ) {
      set(node, 'margin-top', '7px');
      set(node, 'padding-top', '8px');
      break;
    }

    node = node.parentElement;
  }
}

function compactLaunch() {
  if (!mq.matches) return;

  const panel =
    document.querySelector(
      '.launch-panel'
    );

  if (!panel) return;

  set(panel, 'height', 'auto');
  set(panel, 'min-height', '0px');
  set(panel, 'max-height', 'none');

  compactStake(panel);
  compactQuickBets(panel);
  compactMultipliers(panel);
  compactFlightPlan(panel);
}

function compactHistory() {
  if (!mq.matches) return;

  const title =
    [...document.querySelectorAll('*')]
      .filter(
        el =>
          norm(el.textContent) ===
          'RECENT ROUNDS'
      )
      .sort(
        (a, b) =>
          a.children.length -
          b.children.length
      )[0];

  if (!title) return;

  let panel = title;

  while (
    panel &&
    panel.parentElement &&
    !(
      panel.classList &&
      panel.classList.contains(
        'history-panel'
      )
    )
  ) {
    panel = panel.parentElement;
  }

  if (
    !panel ||
    !panel.classList?.contains(
      'history-panel'
    )
  ) {
    panel =
      title.closest(
        'details,section,article'
      );
  }

  if (!panel) return;

  const panelRect =
    rect(panel);

  let header = title;

  while (
    header.parentElement &&
    header.parentElement !== panel
  ) {
    const next =
      header.parentElement;

    const r = rect(next);

    if (
      r.width >
        panelRect.width * 0.85 &&
      r.height >= 45 &&
      r.height <= 130
    ) {
      header = next;
      break;
    }

    header = next;
  }

  if (header && header !== panel) {
    compactBox(
      header,
      44,
      '0px'
    );

    set(header, 'padding-left', '14px');
    set(header, 'padding-right', '14px');
  }

  const toolbarText =
    [...panel.querySelectorAll('*')]
      .filter(
        el =>
          norm(el.textContent) ===
          'Server-settled paper rounds'
      )
      .sort(
        (a, b) =>
          a.children.length -
          b.children.length
      )[0];

  if (toolbarText) {
    let toolbar =
      toolbarText.parentElement;

    while (
      toolbar &&
      toolbar !== panel
    ) {
      const r = rect(toolbar);

      if (
        r.width >
          panelRect.width * 0.80 &&
        r.height >= 30 &&
        r.height <= 90
      ) {
        break;
      }

      toolbar =
        toolbar.parentElement;
    }

    if (
      toolbar &&
      toolbar !== panel
    ) {
      compactBox(
        toolbar,
        32,
        '0px'
      );

      set(
        toolbar,
        'padding-left',
        '14px'
      );

      set(
        toolbar,
        'padding-right',
        '14px'
      );
    }
  }

  set(panel, 'height', 'auto');
  set(panel, 'min-height', '0px');
}



function hideQuickBetRow() {

  if (!mq.matches) return;

  const panel =
    document.querySelector('.launch-panel');

  if (!panel) return;

  const wanted =
    new Set([
      '25%',
      '50%',
      '75%',
      'MAX'
    ]);

  const buttons =
    [...panel.querySelectorAll('button')]
      .filter(button =>
        wanted.has(
          norm(button.textContent).toUpperCase()
        )
      );

  if (buttons.length !== 4) {
    return;
  }

  const parent =
    buttons[0].parentElement;

  if (
    parent &&
    buttons.every(
      button =>
        button.parentElement === parent
    )
  ) {
    set(parent, 'display', 'none');
    set(parent, 'height', '0px');
    set(parent, 'min-height', '0px');
    set(parent, 'max-height', '0px');
    set(parent, 'margin', '0px');
    set(parent, 'padding', '0px');
    set(parent, 'gap', '0px');

    parent.setAttribute(
      'aria-hidden',
      'true'
    );

    return;
  }

  buttons.forEach(button => {
    set(button, 'display', 'none');
  });
}



function finalV89Adjustments() {

  if (!mq.matches) return;


  /* Launch Control */

  const launch =
    document.querySelector(
      '.launch-panel'
    );

  if (launch) {

    const selectGrid =
      launch.querySelector(
        '.select-grid'
      );

    if (selectGrid) {

      set(
        selectGrid,
        'margin-top',
        '2px'
      );
    }


    [...launch.querySelectorAll('*')]
      .filter(el => {

        const value =
          norm(el.textContent);

        return (
          value === 'Auto cash out' ||
          value === 'Stop loss'
        );

      })
      .forEach(el => {

        set(
          el,
          'margin-bottom',
          '2px'
        );

        set(
          el,
          'line-height',
          '1'
        );
      });
  }


  /* Recent Rounds */

  const historyPanel =
    document.querySelector(
      'details.history-panel, .history-panel'
    );

  if (!historyPanel) return;


  set(
    historyPanel,
    'padding-top',
    '8px'
  );

  set(
    historyPanel,
    'padding-block-start',
    '8px'
  );

  set(
    historyPanel,
    'padding-bottom',
    '0px'
  );

  set(
    historyPanel,
    'row-gap',
    '0px'
  );

  set(
    historyPanel,
    'gap',
    '0px'
  );

  set(
    historyPanel,
    'height',
    'auto'
  );

  set(
    historyPanel,
    'min-height',
    '0px'
  );


  const summary =
    historyPanel.querySelector(
      'summary'
    );

  if (summary) {

    set(summary, 'height', '38px');
    set(summary, 'min-height', '38px');
    set(summary, 'max-height', '38px');

    set(summary, 'margin-top', '0px');
    set(summary, 'margin-bottom', '0px');
    set(summary, 'margin-block', '0px');

    set(summary, 'padding-top', '0px');
    set(summary, 'padding-bottom', '0px');

    set(summary, 'display', 'flex');
    set(summary, 'align-items', 'center');


    [...summary.querySelectorAll('*')]
      .filter(el =>
        norm(el.textContent) ===
        'RECENT ROUNDS'
      )
      .forEach(el => {

        set(el, 'margin-top', '0px');
        set(el, 'margin-bottom', '0px');
        set(el, 'line-height', '1');
      });
  }


  const toolbar =
    historyPanel.querySelector(
      '.history-toolbar'
    );

  if (toolbar) {

    set(toolbar, 'height', '28px');
    set(toolbar, 'min-height', '28px');
    set(toolbar, 'max-height', '28px');

    set(toolbar, 'margin-top', '0px');
    set(toolbar, 'margin-bottom', '0px');
    set(toolbar, 'margin-block', '0px');

    set(toolbar, 'padding-top', '0px');
    set(toolbar, 'padding-bottom', '0px');

    set(toolbar, 'display', 'flex');
    set(toolbar, 'align-items', 'center');
  }


  const history =
    historyPanel.querySelector(
      '.history'
    );

  if (history) {

    set(history, 'margin-top', '0px');
    set(history, 'padding-top', '0px');
  }
}

function repair() {
  
  
  finalV89Adjustments();
hideQuickBetRow();
compactLaunch();
  compactHistory();
}

let queued = false;

function queueRepair() {
  if (queued) return;

  queued = true;

  requestAnimationFrame(() => {
    queued = false;
    repair();
  });
}

function start() {
  repair();

  const observer =
    new MutationObserver(
      queueRepair
    );

  observer.observe(
    document.body,
    {
      subtree: true,
      childList: true
    }
  );

  setTimeout(repair, 250);
  setTimeout(repair, 800);
  setTimeout(repair, 1800);
}

if (
  document.readyState ===
  'loading'
) {
  document.addEventListener(
    'DOMContentLoaded',
    start,
    { once: true }
  );
} else {
  start();
}

window.addEventListener(
  'pageshow',
  queueRepair
);

window.addEventListener(
  'resize',
  queueRepair,
  { passive: true }
);

document.addEventListener(
  'visibilitychange',
  () => {
    if (!document.hidden) {
      queueRepair();
    }
  }
);

mq.addEventListener?.(
  'change',
  queueRepair
);

})();