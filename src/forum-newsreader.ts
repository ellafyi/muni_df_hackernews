(() => {
  const storage = chrome.storage?.sync;
  const initialDiscussion = document.querySelector<HTMLElement>('#discussion');
  if (!storage || !initialDiscussion) return;
  let discussion: HTMLElement = initialDiscussion;
  let mediaSequence = 0;

  type PageRecord = { source: HTMLElement; parentId: string };

  const asElement = (target: EventTarget | null): Element | null =>
    target instanceof Element ? target : null;

  function setCollapsed(post: HTMLElement, collapsed: boolean): void {
    if (!post.id) return;
    const toggle = post.querySelector<HTMLButtonElement>(':scope > .obsah .fnr-collapse-toggle');
    post.dataset.fnrCollapsed = String(collapsed);
    if (toggle) {
      const count = post.querySelectorAll('.odpovede .prispevek[id]').length + 1;
      toggle.textContent = collapsed ? '[+' + count + ']' : '[-]';
      toggle.setAttribute('aria-expanded', String(!collapsed));
      toggle.setAttribute('aria-label', collapsed ? 'Expand replies' : 'Collapse replies');
    }
  }

  function preparePost(post: HTMLElement): void {
    if (post.dataset.fnrPrepared) return;
    const author = post.querySelector<HTMLElement>('.autor');
    if (!author || !post.id) return;
    post.dataset.fnrPrepared = 'true';

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'fnr-collapse-toggle';
    toggle.title = 'Collapse replies';
    toggle.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      setCollapsed(post, post.dataset.fnrCollapsed !== 'true');
    });
    author.prepend(toggle);
    author.classList.add('fnr-collapsible-header');
    author.addEventListener('click', event => {
      if (asElement(event.target)?.closest('a, button, input, select, textarea')) return;
      setCollapsed(post, post.dataset.fnrCollapsed !== 'true');
    });
    setCollapsed(post, false);
  }

  function prepareMedia(): void {
    discussion.querySelectorAll<HTMLImageElement>('.prispevek .text img:not([data-fnr-media])').forEach(img => {
      img.dataset.fnrMedia = 'true';
      const parent = img.parentElement;
      const target = parent?.matches('a') && parent.children.length === 1 ? parent : img;
      if (target.closest('.fnr-media')) return;

      const wrapper = document.createElement('div');
      const body = document.createElement('div');
      const toggle = document.createElement('button');
      const bodyId = 'fnr-media-' + (++mediaSequence);
      wrapper.className = 'fnr-media';
      wrapper.dataset.fnrOpen = 'false';
      body.className = 'fnr-media-body';
      body.id = bodyId;
      toggle.type = 'button';
      toggle.className = 'fnr-media-toggle';
      toggle.textContent = '[+] obrázek';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-controls', bodyId);

      target.before(wrapper);
      wrapper.append(toggle, body);
      body.append(target);
      toggle.addEventListener('click', () => {
        const open = wrapper.dataset.fnrOpen !== 'true';
        wrapper.dataset.fnrOpen = String(open);
        toggle.textContent = open ? '[-] skrýt obrázek' : '[+] obrázek';
        toggle.setAttribute('aria-expanded', String(open));
      });
    });
  }

  function preparePosts(): void {
    discussion.querySelectorAll<HTMLElement>('.prispevek').forEach(preparePost);
    prepareMedia();
    discussion.querySelectorAll<HTMLElement>('.nastaveni > .menu_nastroje').forEach(menu => {
      if (menu.dataset.fnrTools) return;
      const trigger = menu.querySelector<HTMLAnchorElement>(':scope > li > a');
      if (!trigger) return;
      menu.dataset.fnrTools = 'true';
      trigger.setAttribute('aria-expanded', 'false');
      trigger.setAttribute('aria-label', 'Možnosti příspěvku');
      menu.addEventListener('click', event => {
        if (!trigger.contains(asElement(event.target))) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const open = menu.dataset.fnrOpen !== 'true';
        closeTools();
        menu.dataset.fnrOpen = String(open);
        trigger.setAttribute('aria-expanded', String(open));
      }, true);
    });
    discussion.querySelectorAll<HTMLElement>('.hodnoceni').forEach(rating => {
      const dropdown = rating.querySelector<HTMLElement>('[data-dropdown-menu]');
      const menu = dropdown?.querySelector<HTMLUListElement>('ul');
      if (!dropdown || !menu) return;
      // The native response indicates the saved reaction in the trigger icon,
      // not with a .selected class on the choices.
      const selectedIcon = dropdown.querySelector('.popisek i');
      const selectedType = [...(selectedIcon?.classList || [])].find(c => c.startsWith('isi-face-'));
      menu.className = 'fnr-reaction-list';
      menu.removeAttribute('role');
      menu.removeAttribute('aria-hidden');
      menu.removeAttribute('data-submenu');
      menu.querySelectorAll('.prvek').forEach(item => {
        item.className = 'prvek';
        item.classList.toggle('selected', !!selectedType && !!item.querySelector('i')?.classList.contains(selectedType));
        item.removeAttribute('role');
      });
      // Move the original choices OUT of Foundation's dropdown event boundary.
      // Their clicks still reach IS MU's delegated reaction handler on document.
      dropdown.before(menu);
      dropdown.hidden = true;
      dropdown.classList.add('fnr-reaction-shell');
      menu.addEventListener('click', event => event.preventDefault());
      menu.addEventListener('keydown', event => {
        const target = asElement(event.target);
        if (event.key === ' ' && target instanceof HTMLAnchorElement) {
          event.preventDefault();
          target.click();
        }
      });
    });
    discussion.querySelectorAll<HTMLAnchorElement>('.fnr-reaction-list .prvek a').forEach(link => {
      link.tabIndex = 0;
      link.setAttribute('role', 'button');
      link.setAttribute('aria-pressed', String(link.parentElement?.classList.contains('selected') ?? false));
      if (!link.hasAttribute('aria-label')) {
        link.setAttribute('aria-label', link.textContent.trim());
        link.title = link.textContent.trim();
      }
    });
  }

  function closeTools(): void {
    document.querySelectorAll<HTMLElement>('[data-fnr-tools][data-fnr-open="true"]').forEach(menu => {
      menu.dataset.fnrOpen = 'false';
      menu.querySelector(':scope > li > a')?.setAttribute('aria-expanded', 'false');
    });
  }
  document.addEventListener('click', event => {
    if (!asElement(event.target)?.closest('[data-fnr-tools] > li > a')) closeTools();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      const trigger = document.querySelector<HTMLElement>('[data-fnr-tools][data-fnr-open="true"] > li > a');
      closeTools();
      trigger?.focus();
    }
  });

  // Keep the original elements and data-id attributes: IS MU delegates reactions
  // and reply actions from document, including for posts inserted later.
  const pageLoads = new WeakMap<HTMLElement, Set<number>>();
  function addPageLoader(): void {
    if (discussion.querySelector('.fnr-load-pages') || !discussion.querySelector('.vlakno_prispevek')) return;
    const links = [...discussion.querySelectorAll<HTMLAnchorElement>('.pagination a[href]')];
    if (!links.length) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'fnr-load-pages';
    button.textContent = 'Načíst všechny stránky';
    button.addEventListener('click', () => loadPages(button));
    discussion.prepend(button);
  }

  async function loadPages(button: HTMLButtonElement): Promise<void> {
    const target = discussion;
    const root = target.querySelector<HTMLElement>('.vlakno_prispevek > .prispevek[id]');
    const thread = root?.closest<HTMLElement>('.vlakno');
    if (!root || !thread) return;
    const rootDataId = root.dataset.id;
    if (!rootDataId) throw new Error('Kořenový příspěvek nemá identifikátor.');
    const baseLink = [...target.querySelectorAll<HTMLAnchorElement>('.pagination a[href]')]
      .find(link => /\/\d+\/$/.test(new URL(link.href).pathname));
    const base = new URL(baseLink?.href || location.href);
    base.pathname = base.pathname.replace(/\/\d+\/?$/, '/');
    base.pathname = base.pathname.replace(/\/?$/, '/');
    const pages = new Map<number, string>([[1, base.href]]);
    const currentSuffix = location.pathname.slice(base.pathname.length);
    if (/^\d+\/$/.test(currentSuffix)) {
      pages.set(Number(currentSuffix.slice(0, -1)), location.href);
    }
    target.querySelectorAll<HTMLAnchorElement>('.pagination a[href]').forEach(a => {
      const url = new URL(a.href);
      if (url.origin !== location.origin || !url.pathname.startsWith(base.pathname)) return;
      const suffix = url.pathname.slice(base.pathname.length);
      if (/^\d+\/$/.test(suffix)) pages.set(Number(suffix.slice(0,-1)), url.href);
    });
    const loaded = pageLoads.get(target) ?? new Set<number>();
    pageLoads.set(target, loaded);
    button.disabled = true;
    try {
      const records = new Map<string, PageRecord>();
      for (const [number, url] of [...pages].sort((a,b) => a[0]-b[0])) {
        button.textContent = 'Načítání stránky ' + number + ' / ' + pages.size;
        const response = await fetch(url, {credentials:'same-origin'});
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
        const sourceRoot = doc.getElementById(root.id);
        if (!sourceRoot) throw new Error('Diskuse není dostupná (zkontrolujte přihlášení).');
        if (!target.isConnected || !document.documentElement.classList.contains('forum-newsreader-active')) return;
        const sourceThread = sourceRoot.closest<HTMLElement>('.vlakno');
        if (!sourceThread) throw new Error('Na stránce chybí vlákno diskuse.');
        // Page boundaries can flatten a reply whose parent is on another page.
        // data-rodic is authoritative; the page-local DOM nesting is not.
        for (const source of sourceThread.querySelectorAll<HTMLElement>('.prispevek[id]')) {
          if (source.id === root.id) continue;
          const parentId = source.querySelector<HTMLElement>(':scope > .preview_trigger')?.dataset.rodic
            || source.parentElement?.closest<HTMLElement>('.prispevek[id]')?.dataset.id || rootDataId;
          if (!records.has(source.id)) records.set(source.id, {source, parentId});
        }
        loaded.add(number);
      }
      // Validate before touching the displayed tree, so failures leave it usable.
      for (const [id, record] of records) {
        const seen = new Set([id]);
        let parentId = record.parentId;
        while (parentId !== rootDataId) {
          const key = 'prispevek_' + parentId;
          if (seen.has(key) || !records.has(key)) throw new Error('Chybí rodič příspěvku nebo je strom neplatný.');
          seen.add(key);
          parentId = records.get(key)!.parentId;
        }
      }
      const nodes = new Map<string, HTMLElement>();
      for (const [id, {source}] of records) {
        let node = target.querySelector<HTMLElement>('#' + CSS.escape(id));
        if (!node) {
          node = source.cloneNode(true) as HTMLElement;
          node.querySelectorAll('.odpovede .prispevek[id],script').forEach(child => child.remove());
        }
        nodes.set(id, node);
      }
      for (const [id, {parentId}] of records) {
        const parent = nodes.get('prispevek_' + parentId);
        const destination = parentId === rootDataId ? thread : parent?.querySelector<HTMLElement>(':scope > .odpovede');
        if (!destination) throw new Error('Chybí kontejner odpovědí.');
        const node = nodes.get(id);
        if (!node) throw new Error('Chybí příspěvek při sestavování vlákna.');
        destination.append(node);
      }
      button.textContent = 'Načteny všechny stránky (' + pages.size + ')';
    } catch (error) {
      button.textContent = 'Načítání selhalo — zkusit znovu';
      button.title = error instanceof Error ? error.message : String(error);
      button.disabled = false;
    }
  }

  function addThreadControls(): void {
    if (discussion.querySelector('#fnr-thread-controls') || !discussion.querySelector('.vlakno_prispevek > .prispevek[id]')) return;
    const controls = document.createElement('span');
    controls.id = 'fnr-thread-controls';
    controls.innerHTML = '<button type="button" data-fnr-action="collapse">sbalit vše</button><span> | </span><button type="button" data-fnr-action="expand">rozbalit vše</button>';
    controls.addEventListener('click', event => {
      const action = asElement(event.target) instanceof HTMLElement
        ? asElement(event.target)?.getAttribute('data-fnr-action')
        : null;
      if (!action) return;
      discussion.querySelectorAll<HTMLElement>('.prispevek').forEach(post => setCollapsed(post, action === 'collapse'));
    });
    const toolbar = discussion.querySelector('.vlakno_header') || discussion.querySelector('.forum_nastroje');
    toolbar?.append(controls);
  }

  function apply(): void {
    const currentDiscussion = document.querySelector<HTMLElement>('#discussion');
    if (!currentDiscussion) return;
    discussion = currentDiscussion;
    document.documentElement.classList.add('forum-newsreader-active');
    if (!document.querySelector('#fnr-masthead')) {
      const header = document.createElement('nav');
      header.id = 'fnr-masthead';
      header.setAttribute('aria-label', 'Diskuse');
      header.innerHTML = '<span class="fnr-logo" aria-hidden="true">M</span><strong><a href="/auth/discussion/">MUNI News</a></strong><span class="fnr-navlinks"><a href="/auth/discussion/MU/">univerzita</a> | <a href="/auth/discussion/moje/">sledované</a> | <a href="/auth/discussion/predmetove/">předmětové</a> | <a href="/auth/discussion/oblibene/">oblíbené</a></span><button id="fnr-original" type="button">původní IS</button>';
      const content = document.querySelector<HTMLElement>('#content');
      const originalButton = header.querySelector<HTMLButtonElement>('button');
      if (!content || !originalButton) return;
      content.prepend(header);
      originalButton.addEventListener('click', () => {
        observer.disconnect();
        document.documentElement.classList.remove('forum-newsreader-active');
        header.remove();
        discussion.querySelectorAll('.fnr-collapse-toggle,#fnr-thread-controls').forEach(node => node.remove());
      });
    }
    preparePosts();
    addThreadControls();
    addPageLoader();
  }

  const observer = new MutationObserver(() => {
    observer.disconnect();
    apply();
    const appContent = document.querySelector('#app_content');
    if (appContent) observer.observe(appContent, { childList: true, subtree: true });
  });
  storage.get({ enabledHosts: [] }, result => {
    const enabledHosts = Array.isArray(result.enabledHosts)
      ? result.enabledHosts.filter((host): host is string => typeof host === 'string')
      : [];
    if (!enabledHosts.includes(location.hostname)) return;
    apply();
    const appContent = document.querySelector('#app_content');
    if (appContent) observer.observe(appContent, { childList: true, subtree: true });
  });
})();
