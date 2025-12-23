(() => {
  const wishes = [
    'Chúc bạn một mùa Giáng Sinh an lành, ấm áp và tràn ngập yêu thương.',
    'Chúc Giáng Sinh này mang đến cho bạn nhiều niềm vui, may mắn và bình yên.',
    'Mong mọi điều tốt đẹp nhất sẽ đến với bạn trong mùa lễ hội và cả năm mới.',
    'Chúc bạn luôn rực rỡ như ánh đèn Noel và hạnh phúc bên những người thân yêu.',
    'Chúc bạn sức khoẻ dồi dào, công việc thuận lợi và một trái tim luôn an yên.',
    'Chúc bạn có một Giáng Sinh ngọt ngào và những ngày cuối năm thật đáng nhớ.',
    'Mong mọi nỗi buồn sẽ tan đi, chỉ còn lại tiếng cười và những điều ấm áp.',
    'Chúc gia đình bạn đầm ấm, sum vầy, đầy ắp tiếng cười trong mùa Noel.',
    'Chúc bạn gặp nhiều điều kỳ diệu, nhẹ nhàng như tuyết rơi và ấm như lửa hồng.',
    'Chúc bạn luôn được che chở, yêu thương và vững vàng trước mọi thử thách.',
    'Giáng Sinh vui vẻ! Chúc bạn đủ đầy: sức khoẻ, niềm vui và những ước mơ.',
    'Chúc bạn một mùa Noel thật chill: ít lo âu, nhiều hạnh phúc, nhiều bình yên.',
  ];

  const elTo = document.getElementById('card-to');
  const elFrom = document.getElementById('card-from');
  const elMsg = document.getElementById('card-msg');
  const elCustom = document.getElementById('card-custom');
  const elStyle = document.getElementById('card-style');
  const elAlign = document.getElementById('card-align');
  const elBadge = document.getElementById('card-badge');
  const elAlpha = document.getElementById('card-alpha');
  const elBlur = document.getElementById('card-blur');
  const elAlphaVal = document.getElementById('card-alpha-val');
  const elBlurVal = document.getElementById('card-blur-val');
  const elCopy = document.getElementById('card-copy');
  const elStatus = document.getElementById('card-status');

  const elToPreview = document.getElementById('card-to-preview');
  const elMsgPreview = document.getElementById('card-msg-preview');
  const elPreview = document.getElementById('card-preview');
  const elBadgePreview = document.getElementById('card-badge-preview');
  const elFromPreview = document.getElementById('card-from-preview');

  const panel = document.querySelector('.card-ui__panel');

  function clampStr(s, maxLen) {
    const v = String(s || '').trim();
    if (!v) return '';
    return v.length > maxLen ? v.slice(0, maxLen) : v;
  }

  function applyPreview({ to, from, msg, style, align, badge, alpha, blur, customMode }) {
    const name = to ? to : 'bạn';
    elToPreview.textContent = name;
    elMsgPreview.textContent = msg || wishes[0];

    const footer = from ? `— from ${from} —` : '— from ChristmasDecoration —';
    if (elFromPreview) elFromPreview.textContent = footer;

    if (elBadgePreview) elBadgePreview.classList.toggle('is-hidden', !badge);

    elPreview.style.setProperty('--card-alpha', String(alpha));
    elPreview.style.setProperty('--card-blur', `${blur}px`);
    elPreview.style.setProperty('--card-align', align);

    panel?.classList.toggle('is-custom', customMode);

    elPreview.classList.remove('style-classic', 'style-cozy', 'style-night');
    elPreview.classList.add(`style-${style}`);
  }

  function buildShareUrl({ to, from, msgId, msgText, style, align, badge, alpha, blur, customMode }) {
    const url = new URL(window.location.href);
    // Keep URLs short: only store what matters.
    if (to) url.searchParams.set('to', to);
    else url.searchParams.delete('to');

    if (from) url.searchParams.set('from', from);
    else url.searchParams.delete('from');

    url.searchParams.set('msg', String(msgId ?? '0'));
    if (customMode) url.searchParams.set('cmsg', msgText || '');
    else url.searchParams.delete('cmsg');

    if (style && style !== 'classic') url.searchParams.set('style', style);
    else url.searchParams.delete('style');

    if (align && align !== 'left') url.searchParams.set('align', align);
    else url.searchParams.delete('align');

    if (!badge) url.searchParams.set('badge', '0');
    else url.searchParams.delete('badge');

    if (Math.abs(Number(alpha) - 0.35) > 1e-6) url.searchParams.set('alpha', String(alpha));
    else url.searchParams.delete('alpha');

    if (Number(blur) !== 12) url.searchParams.set('blur', String(blur));
    else url.searchParams.delete('blur');

    // Legacy param (old links): no longer needed.
    url.searchParams.delete('custom');
    return url.toString();
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    ta.style.top = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }

  function setStatus(text) {
    if (!elStatus) return;
    elStatus.textContent = text;
    window.clearTimeout(setStatus._t);
    setStatus._t = window.setTimeout(() => {
      elStatus.textContent = '';
    }, 1800);
  }

  function getStateFromUI() {
    const to = clampStr(elTo?.value, 40);
    const from = clampStr(elFrom?.value, 40);

    const selected = String(elMsg?.value ?? '0');
    const customMode = selected === '__custom__';

    let msgId = '0';
    let msgText = wishes[0];
    if (customMode) {
      msgId = 'c';
      msgText = clampStr(elCustom?.value || '', 220) || wishes[0];
    } else {
      const idx = Number(selected);
      if (Number.isFinite(idx) && idx >= 0 && idx < wishes.length) {
        msgId = String(idx);
        msgText = wishes[idx];
      } else {
        // Fallback if something odd gets selected.
        msgId = '0';
        msgText = wishes[0];
      }
    }

    const style = String(elStyle?.value || 'classic');
    const align = String(elAlign?.value || 'left');
    const badge = Boolean(elBadge?.checked);

    const alpha = Math.max(0.22, Math.min(0.72, Number(elAlpha?.value ?? 0.35)));
    const blur = Math.max(0, Math.min(22, Number(elBlur?.value ?? 12)));

    return { to, from, msgId, msgText, style, align, badge, alpha, blur, customMode };
  }

  function syncFromUI() {
    const st = getStateFromUI();
    applyPreview({
      to: st.to,
      from: st.from,
      msg: st.msgText,
      style: st.style,
      align: st.align,
      badge: st.badge,
      alpha: st.alpha,
      blur: st.blur,
      customMode: st.customMode,
    });

    // Keep URL in sync so users can copy from address bar too.
    const url = buildShareUrl(st);
    window.history.replaceState({}, '', url);
  }

  function initOptions() {
    elMsg.innerHTML = '';
    for (let i = 0; i < wishes.length; i++) {
      const text = wishes[i];
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = text;
      elMsg.appendChild(opt);
    }

    const sep = document.createElement('option');
    sep.disabled = true;
    sep.textContent = '──────────';
    elMsg.appendChild(sep);

    const custom = document.createElement('option');
    custom.value = '__custom__';
    custom.textContent = 'Tự nhập lời chúc…';
    elMsg.appendChild(custom);
  }

  function initFromQuery() {
    const p = new URLSearchParams(window.location.search);
    const to = clampStr(p.get('to') || '', 40);
    const msgRaw = clampStr(p.get('msg') || '', 220);
    const cmsg = clampStr(p.get('cmsg') || '', 220);
    const style = clampStr(p.get('style') || 'classic', 24) || 'classic';
    const from = clampStr(p.get('from') || '', 40);

    const align = clampStr(p.get('align') || 'left', 12) || 'left';
    const badge = (p.get('badge') ?? '1') !== '0';
    const alpha = Math.max(0.22, Math.min(0.72, Number(p.get('alpha') ?? 0.35)));
    const blur = Math.max(0, Math.min(22, Number(p.get('blur') ?? 12)));
    const legacyCustomMode = (p.get('custom') ?? '0') === '1';

    // msg is now an id (index) to keep URL short.
    // Backward compatible: if msg looks like full text, map it to preset or treat as custom.
    let customMode = false;
    let msgId = '0';
    let msgText = wishes[0];

    if (!msgRaw) {
      msgId = '0';
      msgText = wishes[0];
      customMode = false;
    } else if (msgRaw === 'c' || legacyCustomMode) {
      customMode = true;
      msgId = 'c';
      msgText = cmsg || wishes[0];
    } else {
      const asNum = Number(msgRaw);
      if (Number.isFinite(asNum) && String(asNum) === msgRaw && asNum >= 0 && asNum < wishes.length) {
        msgId = String(asNum);
        msgText = wishes[asNum];
        customMode = false;
      } else {
        // Legacy: msg was the full text.
        const matchIdx = wishes.findIndex((w) => w === msgRaw);
        if (matchIdx >= 0) {
          msgId = String(matchIdx);
          msgText = wishes[matchIdx];
          customMode = false;
        } else {
          customMode = true;
          msgId = 'c';
          msgText = cmsg || msgRaw || wishes[0];
        }
      }
    }

    if (elTo) elTo.value = to;
    if (elFrom) elFrom.value = from;

    if (customMode) {
      elMsg.value = '__custom__';
      if (elCustom) elCustom.value = msgText;
    } else {
      elMsg.value = msgId;
      if (elCustom) elCustom.value = '';
    }

    if (elStyle) {
      const allowed = new Set(['classic', 'cozy', 'night']);
      elStyle.value = allowed.has(style) ? style : 'classic';
    }

    if (elAlign) {
      elAlign.value = align === 'center' ? 'center' : 'left';
    }

    if (elBadge) elBadge.checked = badge;
    if (elAlpha) elAlpha.value = String(alpha);
    if (elBlur) elBlur.value = String(blur);
    if (elAlphaVal) elAlphaVal.textContent = `${alpha.toFixed(2)}`;
    if (elBlurVal) elBlurVal.textContent = `${Math.round(blur)}px`;

    const resolvedMsg = customMode ? clampStr(elCustom?.value || msgText, 220) || wishes[0] : msgText;

    applyPreview({
      to,
      from,
      msg: resolvedMsg,
      style: String(elStyle?.value || 'classic'),
      align: String(elAlign?.value || 'left'),
      badge: Boolean(elBadge?.checked),
      alpha: Number(elAlpha?.value ?? alpha),
      blur: Number(elBlur?.value ?? blur),
      customMode: String(elMsg?.value) === '__custom__',
    });

    // Ensure URL normalized (in case msg empty/invalid style)
    syncFromUI();
  }

  function bind() {
    elTo?.addEventListener('input', syncFromUI);
    elFrom?.addEventListener('input', syncFromUI);
    elMsg?.addEventListener('change', () => {
      // show/hide custom box
      panel?.classList.toggle('is-custom', String(elMsg.value) === '__custom__');
      syncFromUI();
    });
    elCustom?.addEventListener('input', syncFromUI);
    elStyle?.addEventListener('change', syncFromUI);
    elAlign?.addEventListener('change', syncFromUI);
    elBadge?.addEventListener('change', syncFromUI);

    elAlpha?.addEventListener('input', () => {
      if (elAlphaVal) elAlphaVal.textContent = `${Number(elAlpha.value).toFixed(2)}`;
      syncFromUI();
    });

    elBlur?.addEventListener('input', () => {
      if (elBlurVal) elBlurVal.textContent = `${Math.round(Number(elBlur.value))}px`;
      syncFromUI();
    });

    elCopy?.addEventListener('click', async () => {
      const st = getStateFromUI();
      const url = buildShareUrl(st);
      try {
        await copyText(url);
        setStatus('Đã copy link!');
      } catch {
        setStatus('Không copy được (thử copy từ thanh địa chỉ).');
      }
    });
  }

  initOptions();
  // Shared UI: corner panel collapse
  window.CD_UI?.initCornerPanel({
    panelSelector: '.card-ui__panel',
    toggleSelector: '#card-panel-toggle',
    storageKey: 'christmas.cardPanelCollapsedV2',
    defaultCollapsed: true,
  });
  initFromQuery();
  bind();
})();
